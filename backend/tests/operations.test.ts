import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { createEncryptedBackup, pruneExpiredBackups, restoreEncryptedBackup } from '../src/operations/backup';

test('encrypted backup restores database and uploaded files with verified checksums', async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'portal-backup-test-')); const databasePath=path.join(root,'source.db');const uploads=path.join(root,'uploads');const backups=path.join(root,'backups');const restored=path.join(root,'restored');
  await fs.mkdir(path.join(uploads,'nested'),{recursive:true});await fs.writeFile(databasePath,Buffer.from('sqlite-test-content'));await fs.writeFile(path.join(uploads,'nested','permit.pdf'),Buffer.from('%PDF-test-content'));
  const secret='test-only-backup-key-that-is-longer-than-thirty-two-characters';const created=await createEncryptedBackup({databasePath,uploadDirectory:uploads,outputDirectory:backups,secret});const result=await restoreEncryptedBackup({backupPath:created.backupPath,outputDirectory:restored,secret});
  assert.equal((await fs.readFile(path.join(restored,'database.sqlite'),'utf8')),'sqlite-test-content');assert.equal((await fs.readFile(path.join(restored,'uploads','nested','permit.pdf'),'utf8')),'%PDF-test-content');assert.equal(result.uploadFiles,1);assert.ok(result.durationMs<4*60*60*1000);
  await fs.rm(root,{recursive:true,force:true});
});

test('encrypted backup rejects an incorrect encryption key',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'portal-backup-key-test-'));const databasePath=path.join(root,'source.db');await fs.writeFile(databasePath,'db');const created=await createEncryptedBackup({databasePath,uploadDirectory:path.join(root,'uploads'),outputDirectory:path.join(root,'backups'),secret:'correct-key-that-is-at-least-thirty-two-characters'});
  await assert.rejects(()=>restoreEncryptedBackup({backupPath:created.backupPath,outputDirectory:path.join(root,'restore'),secret:'incorrect-key-that-is-at-least-thirty-two-chars'}));await fs.rm(root,{recursive:true,force:true});
});

test('backup retention removes only expired portal backups',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'portal-backup-retention-test-'));const expired=path.join(root,'portal-expired.backup.json');const current=path.join(root,'portal-current.backup.json');const unrelated=path.join(root,'keep.txt');await Promise.all([fs.writeFile(expired,'expired'),fs.writeFile(current,'current'),fs.writeFile(unrelated,'keep')]);const old=new Date(Date.now()-40*86_400_000);await fs.utimes(expired,old,old);assert.equal(await pruneExpiredBackups(root,30),1);await assert.rejects(()=>fs.access(expired));await fs.access(current);await fs.access(unrelated);await fs.rm(root,{recursive:true,force:true});
});
