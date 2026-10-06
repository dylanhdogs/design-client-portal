import express from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, loadClientData, AuthRequest } from '../middleware/auth';
import { requireInternal } from '../workflow/authorization';
import { z } from 'zod';
import { getFeatureFlags } from '../utils/features';
import { writeAuditEvent } from '../workflow/audit';
import { AppError } from '../utils/errors';
import { getDocumentRetentionDays } from '../utils/retention';

const router = express.Router();
router.use(authenticate, loadClientData);

const median = (values: number[]) => { if (!values.length) return null; const sorted = [...values].sort((a,b)=>a-b); const middle = Math.floor(sorted.length/2); return sorted.length%2 ? sorted[middle] : Math.round((sorted[middle-1]+sorted[middle])/2); };

router.get('/management/features', async (req: AuthRequest, res, next) => { try { requireInternal(req.user); res.json({ flags: getFeatureFlags(), legacyPathsRetained: true, decommissionRequiresParityApproval: true }); } catch (error) { next(error); } });
router.get('/management/alerts', async (req: AuthRequest, res, next) => { try { requireInternal(req.user); const data = await prisma.operationalAlert.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }); res.json({ data }); } catch (error) { next(error); } });
router.post('/management/alerts/:id/acknowledge', async (req: AuthRequest, res, next) => { try { requireInternal(req.user); const alert = await prisma.operationalAlert.update({ where: { id: req.params.id }, data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() } }); res.json(alert); } catch (error) { next(error); } });
router.get('/management/legal-holds', async (req: AuthRequest, res, next) => { try { requireInternal(req.user); const data = await prisma.legalHold.findMany({ orderBy: { createdAt: 'desc' }, include: { setter: { select: { id: true, name: true } } } }); res.json({ data, retentionDays: getDocumentRetentionDays() }); } catch (error) { next(error); } });
router.post('/management/legal-holds', async (req: AuthRequest, res, next) => { try { if (req.user?.role !== 'ADMIN') throw new AppError('Administrator access is required.', 403, 'FORBIDDEN'); const data = z.object({ entityType: z.enum(['Client','Document']), entityId: z.string().uuid(), reason: z.string().trim().min(10).max(2000) }).parse(req.body); const hold = await prisma.legalHold.create({ data: { ...data, setBy: req.user.id } }); await writeAuditEvent(prisma,{userId:req.user.id,action:'LEGAL_HOLD',entityType:data.entityType,entityId:data.entityId,requestId:(req as any).requestId,after:hold}); res.status(201).json(hold); } catch (error) { next(error); } });
router.post('/management/legal-holds/:id/release', async (req: AuthRequest, res, next) => { try { if (req.user?.role !== 'ADMIN') throw new AppError('Administrator access is required.', 403, 'FORBIDDEN'); const before=await prisma.legalHold.findUnique({where:{id:req.params.id}}); if(!before)throw new AppError('Legal hold not found.',404,'NOT_FOUND'); const hold=await prisma.legalHold.update({where:{id:before.id},data:{active:false,releasedAt:new Date()}}); await writeAuditEvent(prisma,{userId:req.user.id,action:'RELEASE_LEGAL_HOLD',entityType:before.entityType,entityId:before.entityId,requestId:(req as any).requestId,before,after:hold}); res.json(hold); } catch (error) { next(error); } });

router.get('/management/dashboard', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user); const now = new Date(); const thirtyDaysAgo = new Date(now.getTime()-30*86_400_000);
    const [operationalProjects, inquiries] = await Promise.all([
      prisma.poolProject.findMany({ where: { client: { deletedAt: null } }, include: { client: { select: { id: true, name: true } } } }),
      prisma.inquiry.findMany({ where: { client: { deletedAt: null } } }),
    ]);
    const projects = operationalProjects.filter((project) => project.workflowEnabled);
    const projectIds = operationalProjects.map((project) => project.id); const inquiryIds = inquiries.map((inquiry) => inquiry.id);
    const [stages, workItems, decisions, gates, compliance, reviews, readinessExceptions, procurement, deliveries, invoiceMatches, substitutions, acknowledgments, communications, automationRuns, suggestions, notificationDeliveries, operationalAlerts] = await Promise.all([
      prisma.lifecycleStage.findMany({ where: { projectId: { in: projectIds } } }), prisma.workItem.findMany({ where: { deletedAt: null, OR: [{ projectId: { in: projectIds } }, { inquiryId: { in: inquiryIds } }] } }), prisma.decision.findMany({ where: { projectId: { in: projectIds } } }), prisma.projectGate.findMany({ where: { projectId: { in: projectIds } } }),
      prisma.complianceRequirement.findMany({ where: { projectId: { in: projectIds } } }), prisma.readinessReview.findMany({ where: { projectId: { in: projectIds } }, orderBy: { createdAt: 'desc' } }), prisma.readinessException.findMany({ where: { projectId: { in: projectIds } } }),
      prisma.procurementRequest.findMany({ where: { projectId: { in: projectIds } }, include: { purchaseOrder: true } }),
      prisma.delivery.findMany({ where: { purchaseOrder: { request: { projectId: { in: projectIds } } } }, include: { purchaseOrder: { include: { request: true } } } }), prisma.invoiceMatch.findMany({ where: { purchaseOrder: { request: { projectId: { in: projectIds } } } } }), prisma.substitution.findMany({ where: { request: { projectId: { in: projectIds } } } }),
      prisma.notification.findMany({ where: { type: 'INQUIRY_ACKNOWLEDGED', inquiryId: { in: inquiryIds } } }), prisma.communication.findMany({ where: { deletedAt: null, date: { gte: thirtyDaysAgo }, client: { deletedAt: null } } }),
      prisma.automationRun.findMany({ orderBy: { startedAt: 'desc' }, take: 100 }), prisma.automationSuggestion.findMany(), prisma.notificationDelivery.findMany(), prisma.operationalAlert.findMany({ where: { status: 'OPEN' } }),
    ]);
    const stageAging = projects.map((project) => { const current = stages.find((stage)=>stage.projectId===project.id&&stage.stage===project.currentLifecycleStage); return { projectId: project.id, client: project.client.name, stage: project.currentLifecycleStage || project.status, status: current?.status || project.status, ageDays: current?.startedAt ? Math.floor((now.getTime()-current.startedAt.getTime())/86_400_000) : null }; }).sort((a,b)=>(b.ageDays||0)-(a.ageDays||0));
    const openWork = workItems.filter((item)=>!['VERIFIED','CLOSED','CANCELLED'].includes(item.status)); const pendingDecisions = decisions.filter((item)=>!['APPROVED','REJECTED','CANCELLED'].includes(item.status)); const unresolvedCompliance = compliance.filter((item)=>item.required&&!['APPROVED','NOT_APPLICABLE'].includes(item.status)); const unresolvedProcurement = procurement.filter((item)=>item.required&&item.status!=='CLOSED');
    const latestReviews = new Map<string, typeof reviews[number]>(); for(const review of reviews) if(!latestReviews.has(review.projectId)) latestReviews.set(review.projectId,review);
    const inquiryAckMinutes = inquiries.map((inquiry)=>{const ack=acknowledgments.find((item)=>item.inquiryId===inquiry.id);return ack?Math.round((ack.createdAt.getTime()-inquiry.createdAt.getTime())/60000):null;}).filter((value):value is number=>value!=null&&value>=0);
    const clientActions = workItems.filter((item)=>item.clientVisible); const completedClientActions=clientActions.filter((item)=>item.completedAt); const onTimeClientActions=completedClientActions.filter((item)=>!item.dueAt||item.completedAt!<=item.dueAt);
    const passedDeliveries=deliveries.filter((item)=>item.inspectionStatus==='PASSED'); const onTimeDeliveries=passedDeliveries.filter((item)=>item.receivedAt&&item.receivedAt<=item.purchaseOrder.request.requiredBy); const failedDeliveries=deliveries.filter((item)=>item.inspectionStatus==='FAILED');
    const report = {
      generatedAt: now,
      overview: { activeProjects: projects.length, openWorkItems: openWork.length, pendingDecisions: pendingDecisions.length, gateBlockers: gates.reduce((sum,gate)=>sum+gate.blockerCount,0), automationFailures: automationRuns.filter((run)=>['FAILED','COMPLETED_WITH_ERRORS'].includes(run.status)).length },
      stageAging,
      blockers: { workItems: openWork.length, overdueWorkItems: openWork.filter((item)=>item.dueAt&&item.dueAt<now).length, pendingDecisions: pendingDecisions.length, blockedGates: gates.filter((gate)=>gate.status==='BLOCKED').length, compliance: unresolvedCompliance.length, readiness: Array.from(latestReviews.values()).filter((review)=>review.blockerCount>0).length, procurement: unresolvedProcurement.length },
      compliance: { total: compliance.length, required: compliance.filter((item)=>item.required).length, approved: compliance.filter((item)=>item.status==='APPROVED').length, overdue: unresolvedCompliance.filter((item)=>item.dueAt&&item.dueAt<now).length, evidenceMissing: compliance.filter((item)=>item.required&&item.evidenceRequired&&!['APPROVED','NOT_APPLICABLE'].includes(item.status)).length, byStatus: Object.fromEntries([...new Set(compliance.map((item)=>item.status))].map((status)=>[status,compliance.filter((item)=>item.status===status).length])) },
      readiness: { latestReviews: latestReviews.size, passRate: latestReviews.size ? Math.round(Array.from(latestReviews.values()).filter((item)=>item.status==='APPROVED').length/latestReviews.size*100) : 0, averageScore: latestReviews.size ? Math.round(Array.from(latestReviews.values()).reduce((sum,item)=>sum+item.score,0)/latestReviews.size) : 0, openExceptions: readinessExceptions.filter((item)=>item.status!=='APPROVED'||item.dueAt<now).length },
      procurement: { requests: procurement.length, openRequests: unresolvedProcurement.length, ordered: procurement.filter((item)=>item.purchaseOrder).length, onTimeDeliveryRate: passedDeliveries.length ? Math.round(onTimeDeliveries.length/passedDeliveries.length*100) : 0, inspectionExceptionRate: deliveries.length ? Math.round(failedDeliveries.length/deliveries.length*100) : 0, amountVariances: invoiceMatches.filter((item)=>item.status==='VARIANCE').length, totalVarianceCents: invoiceMatches.reduce((sum,item)=>sum+item.varianceAmountCents,0), substitutions: substitutions.length },
      clientExperience: { medianInquiryAcknowledgmentMinutes: median(inquiryAckMinutes), openClientActions: clientActions.filter((item)=>!['VERIFIED','CLOSED','CANCELLED'].includes(item.status)).length, overdueClientActions: clientActions.filter((item)=>item.dueAt&&item.dueAt<now&&!['VERIFIED','CLOSED','CANCELLED'].includes(item.status)).length, onTimeActionRate: completedClientActions.length ? Math.round(onTimeClientActions.length/completedClientActions.length*100) : 0, pendingClientDecisions: decisions.filter((item)=>item.decisionMakerId&&!['APPROVED','REJECTED','CANCELLED'].includes(item.status)).length, communicationsLast30Days: communications.length, satisfaction: null },
      automation: { runs: automationRuns.length, failedRuns: automationRuns.filter((run)=>run.status==='FAILED').length, partialRuns: automationRuns.filter((run)=>run.status==='COMPLETED_WITH_ERRORS').length, pendingSuggestions: suggestions.filter((item)=>item.status==='PENDING_REVIEW').length, acceptedSuggestions: suggestions.filter((item)=>item.status==='ACCEPTED').length, rejectedSuggestions: suggestions.filter((item)=>item.status==='REJECTED').length, failedDeliveries: notificationDeliveries.filter((item)=>item.status==='FAILED').length, pendingDeliveries: notificationDeliveries.filter((item)=>item.status==='PENDING').length, sentDeliveries: notificationDeliveries.filter((item)=>item.status==='SENT').length, openOperationalAlerts: operationalAlerts.length },
    };
    res.json(report);
  } catch(error){next(error);}
});

export default router;
