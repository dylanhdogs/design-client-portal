import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { restoreEncryptedBackup } from '../src/operations/backup';

const backupPath=process.argv[2]; const output=process.argv[3];
if(!backupPath||!output)throw new Error('Usage: npm run backup:restore -- <backup-file> <empty-output-directory>');
async function main(){const resolvedBackup=path.resolve(backupPath);const resolvedOutput=path.resolve(output);const root=path.parse(resolvedOutput).root;if(resolvedOutput===root)throw new Error('Restore output cannot be a filesystem root.');const entries=await fs.readdir(resolvedOutput).catch((error:NodeJS.ErrnoException)=>error.code==='ENOENT'?[]:Promise.reject(error));if(entries.length)throw new Error('Restore output directory must be empty.');const result=await restoreEncryptedBackup({backupPath:resolvedBackup,outputDirectory:resolvedOutput,secret:process.env.BACKUP_ENCRYPTION_KEY||''});const restoredDatabase=path.join(resolvedOutput,'database.sqlite');const verification=new PrismaClient({datasourceUrl:`file:${restoredDatabase.replace(/\\/g,'/')}`});try{const integrity=await verification.$queryRawUnsafe<Array<{integrity_check:string}>>('PRAGMA integrity_check');if(integrity[0]?.integrity_check!=='ok')throw new Error('Restored SQLite integrity check failed.');}finally{await verification.$disconnect();}console.log(JSON.stringify({event:'restore_complete',verified:true,...result}));}
main().catch((error)=>{console.error(String(error?.message||error));process.exitCode=1;});
