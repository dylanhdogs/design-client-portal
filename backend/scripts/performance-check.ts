import 'dotenv/config';
import crypto from 'crypto';
import { prisma } from '../src/utils/prisma';

async function main(){const admin=await prisma.user.findFirstOrThrow({where:{role:'ADMIN'}});const marker=`performance-${Date.now()}`;const clientIds:string[]=[];const projectIds:string[]=[];try{
  for(let index=0;index<100;index++){const clientId=crypto.randomUUID();const projectId=crypto.randomUUID();clientIds.push(clientId);projectIds.push(projectId);await prisma.client.create({data:{id:clientId,name:`Performance ${index}`,email:`${marker}-${index}@example.invalid`,status:'ACTIVE'}});await prisma.poolProject.create({data:{id:projectId,clientId,status:'ACTIVE',workflowEnabled:true,currentLifecycleStage:'DESIGN'}});}
  const items=projectIds.flatMap((projectId,projectIndex)=>Array.from({length:50},(_,index)=>({id:crypto.randomUUID(),projectId,stage:'DESIGN',type:'PERFORMANCE',title:`Performance item ${projectIndex}-${index}`,status:index%5===0?'COMPLETED':'OPEN',createdBy:admin.id,clientVisible:index%3===0})));await prisma.workItem.createMany({data:items});
  const durations:number[]=[];for(let run=0;run<30;run++){const start=performance.now();await Promise.all([prisma.poolProject.findMany({where:{workflowEnabled:true},include:{client:{select:{id:true,name:true}}}}),prisma.workItem.findMany({where:{deletedAt:null},orderBy:[{dueAt:'asc'},{createdAt:'desc'}]}),prisma.workItem.count({where:{status:{notIn:['VERIFIED','CLOSED','CANCELLED']},deletedAt:null}})]);durations.push(performance.now()-start);}
  durations.sort((a,b)=>a-b);const p95=durations[Math.ceil(durations.length*.95)-1];const result={projects:100,workItems:5000,runs:30,p50Ms:Number(durations[14].toFixed(2)),p95Ms:Number(p95.toFixed(2)),thresholdMs:500,passed:p95<500};console.log(JSON.stringify(result));if(!result.passed)process.exitCode=1;
}finally{await prisma.workItem.deleteMany({where:{projectId:{in:projectIds}}});await prisma.poolProject.deleteMany({where:{id:{in:projectIds}}});await prisma.client.deleteMany({where:{id:{in:clientIds}}});await prisma.$disconnect();}}
void main();
