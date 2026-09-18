import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { createEncryptedBackup, pruneExpiredBackups } from '../src/operations/backup';
import { getDatabasePath, initializeDatabase } from '../src/utils/database';
import { getUploadDirectory } from '../src/utils/storage';
import { prisma } from '../src/utils/prisma';

const databasePath = getDatabasePath();
const uploadDirectory = getUploadDirectory();
const outputDirectory = path.resolve(process.cwd(), process.env.BACKUP_DIR || 'backups');

async function main() {
  try {
    await initializeDatabase();
    await prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(FULL)');
    await prisma.$disconnect();
    const result = await createEncryptedBackup({ databasePath, uploadDirectory, outputDirectory, secret: process.env.BACKUP_ENCRYPTION_KEY || '' });
    const pruned = await pruneExpiredBackups(outputDirectory, Number(process.env.BACKUP_RETENTION_DAYS || 30));
    console.log(JSON.stringify({ event: 'backup_complete', ...result, pruned }));
  } catch (error: any) {
    await prisma.$disconnect().catch(() => undefined);
    await fs.mkdir(outputDirectory, { recursive: true });
    await fs.appendFile(path.join(outputDirectory, 'backup-failures.ndjson'), `${JSON.stringify({ event: 'backup_failure', at: new Date().toISOString(), message: String(error?.message || error).slice(0, 1000) })}\n`);
    throw error;
  }
}

main().catch((error) => {
  console.error(String(error?.message || error));
  process.exitCode = 1;
});
