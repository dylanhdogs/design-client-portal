import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

type PayloadFile = { path: string; data: string; sha256: string };
type BackupPayload = { version: 1; createdAt: string; database: PayloadFile; uploads: PayloadFile[] };
type Envelope = { version: 1; algorithm: 'aes-256-gcm'; salt: string; iv: string; authTag: string; ciphertext: string };

const hash = (data: Buffer) => crypto.createHash('sha256').update(data).digest('hex');
const deriveKey = (secret: string, salt: Buffer) => crypto.scryptSync(secret, salt, 32);
const safeRelative = (value: string) => {
  const normalized = value.replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || normalized.split('/').includes('..')) throw new Error(`Unsafe backup path: ${value}`);
  return normalized;
};

async function collectFiles(root: string, current = root): Promise<PayloadFile[]> {
  const entries = await fs.readdir(current, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => error.code === 'ENOENT' ? [] : Promise.reject(error));
  const files: PayloadFile[] = [];
  for (const entry of entries) {
    const absolute = path.join(current, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) files.push(...await collectFiles(root, absolute));
    if (entry.isFile()) { const data = await fs.readFile(absolute); files.push({ path: safeRelative(path.relative(root, absolute)), data: data.toString('base64'), sha256: hash(data) }); }
  }
  return files;
}

export async function createEncryptedBackup(input: { databasePath: string; uploadDirectory: string; outputDirectory: string; secret: string }) {
  if (input.secret.length < 32) throw new Error('BACKUP_ENCRYPTION_KEY must contain at least 32 characters.');
  const database = await fs.readFile(input.databasePath);
  const payload: BackupPayload = { version: 1, createdAt: new Date().toISOString(), database: { path: 'database.sqlite', data: database.toString('base64'), sha256: hash(database) }, uploads: await collectFiles(input.uploadDirectory) };
  const salt = crypto.randomBytes(16); const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(input.secret, salt), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final()]);
  const envelope: Envelope = { version: 1, algorithm: 'aes-256-gcm', salt: salt.toString('base64'), iv: iv.toString('base64'), authTag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
  await fs.mkdir(input.outputDirectory, { recursive: true });
  const backupName = `portal-${new Date().toISOString().replace(/[:.]/g,'-')}-${crypto.randomBytes(4).toString('hex')}.backup.json`;
  const backupPath = path.join(input.outputDirectory, backupName);
  const temporaryPath = `${backupPath}.tmp`;
  await fs.writeFile(temporaryPath, JSON.stringify(envelope), { mode: 0o600, flag: 'wx' });
  await fs.rename(temporaryPath, backupPath);
  return { backupPath, createdAt: payload.createdAt, databaseBytes: database.length, uploadFiles: payload.uploads.length, uploadBytes: payload.uploads.reduce((sum,item)=>sum+Buffer.from(item.data,'base64').length,0) };
}

export async function pruneExpiredBackups(outputDirectory: string, retentionDays: number) {
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) {
    throw new Error('BACKUP_RETENTION_DAYS must be an integer from 1 to 3650.');
  }
  const cutoff = Date.now() - retentionDays * 86_400_000;
  const entries = await fs.readdir(outputDirectory, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => error.code === 'ENOENT' ? [] : Promise.reject(error));
  let removed = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !/^portal-.*\.backup\.json$/.test(entry.name)) continue;
    const backupPath = path.join(outputDirectory, entry.name);
    if ((await fs.stat(backupPath)).mtimeMs < cutoff) {
      await fs.rm(backupPath);
      removed += 1;
    }
  }
  return removed;
}

export async function restoreEncryptedBackup(input: { backupPath: string; outputDirectory: string; secret: string }) {
  const startedAt = Date.now(); const envelope = JSON.parse(await fs.readFile(input.backupPath, 'utf8')) as Envelope;
  if (envelope.version !== 1 || envelope.algorithm !== 'aes-256-gcm') throw new Error('Unsupported backup format.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(input.secret, Buffer.from(envelope.salt,'base64')), Buffer.from(envelope.iv,'base64'));
  decipher.setAuthTag(Buffer.from(envelope.authTag,'base64'));
  const payload = JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext,'base64')),decipher.final()]).toString('utf8')) as BackupPayload;
  const restoreFile=async(file:PayloadFile,target:string)=>{const data=Buffer.from(file.data,'base64');if(hash(data)!==file.sha256)throw new Error(`Backup checksum failed: ${file.path}`);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,data);};
  await fs.mkdir(input.outputDirectory,{recursive:true}); await restoreFile(payload.database,path.join(input.outputDirectory,'database.sqlite'));
  for(const file of payload.uploads){const relative=safeRelative(file.path);const target=path.resolve(input.outputDirectory,'uploads',relative);const uploadRoot=path.resolve(input.outputDirectory,'uploads');if(target!==uploadRoot&&!target.startsWith(uploadRoot+path.sep))throw new Error('Backup path escaped restore directory.');await restoreFile(file,target);}
  return { createdAt: payload.createdAt, restoredAt: new Date().toISOString(), databaseSha256: payload.database.sha256, uploadFiles: payload.uploads.length, durationMs: Date.now()-startedAt };
}
