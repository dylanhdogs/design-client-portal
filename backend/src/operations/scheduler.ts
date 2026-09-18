import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../utils/prisma';
import { createEncryptedBackup, pruneExpiredBackups } from './backup';
import { recordOperationalAlert } from '../utils/operations';
import { getDatabasePath } from '../utils/database';
import { getUploadDirectory } from '../utils/storage';

const outputDirectory=()=>path.resolve(process.cwd(),process.env.BACKUP_DIR||'backups');

export async function runScheduledBackup(){const output=outputDirectory();const snapshot=path.join(output,`.snapshot-${process.pid}-${Date.now()}.db`);try{
  await fs.mkdir(output,{recursive:true});const sqlPath=snapshot.replace(/'/g,"''").replace(/\\/g,'/');await prisma.$executeRawUnsafe(`VACUUM INTO '${sqlPath}'`);
  const result=await createEncryptedBackup({databasePath:snapshot,uploadDirectory:getUploadDirectory(),outputDirectory:output,secret:process.env.BACKUP_ENCRYPTION_KEY||''});const pruned=await pruneExpiredBackups(output,Number(process.env.BACKUP_RETENTION_DAYS||30));console.log(JSON.stringify({level:'info',event:'backup_complete',sourceDatabase:getDatabasePath(),...result,pruned}));return result;
}catch(error:any){const message=String(error?.message||error).slice(0,1000);console.error(JSON.stringify({level:'error',event:'backup_failure',message}));await recordOperationalAlert('BACKUP_FAILURE','Scheduled encrypted backup failed.',{severity:'CRITICAL',metadata:{message}}).catch(()=>undefined);throw error;}finally{await fs.rm(snapshot,{force:true}).catch(()=>undefined);}}

export function startBackupScheduler(){if(process.env.BACKUP_ENABLED!=='true'||process.env.BACKUP_SCHEDULER_MODE==='external')return;const intervalHours=Math.min(24,Math.max(1,Number(process.env.BACKUP_INTERVAL_HOURS||24)));void runScheduledBackup().catch(()=>undefined);const timer=setInterval(()=>void runScheduledBackup().catch(()=>undefined),intervalHours*3_600_000);timer.unref();}

export async function getBackupFreshness(){if(process.env.BACKUP_ENABLED!=='true')return{ok:true,detail:'Scheduled backups are disabled in this environment.'};const output=outputDirectory();const files=(await fs.readdir(output,{withFileTypes:true}).catch(()=>[])).filter((item)=>item.isFile()&&item.name.endsWith('.backup.json'));if(!files.length)return{ok:false,detail:'No encrypted backup is available.'};const stats=await Promise.all(files.map(async(item)=>({name:item.name,stat:await fs.stat(path.join(output,item.name))})));const latest=stats.sort((a,b)=>b.stat.mtimeMs-a.stat.mtimeMs)[0];const ageHours=(Date.now()-latest.stat.mtimeMs)/3_600_000;const maximumAgeHours=Number(process.env.BACKUP_MAX_AGE_HOURS||26);return{ok:ageHours<=maximumAgeHours,detail:`Latest backup ${latest.name} is ${ageHours.toFixed(2)} hours old.`};}
