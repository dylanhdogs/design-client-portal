import express from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { authenticate, loadClientData, AuthRequest } from '../middleware/auth';
import { requireInternal } from '../workflow/authorization';
import { writeAuditEvent } from '../workflow/audit';
import { recordOperationalAlert } from '../utils/operations';

const router = express.Router();
router.use(authenticate, loadClientData);

export const NOTIFICATION_TRIGGER_MATRIX = [
  { trigger: 'Inquiry submitted', type: 'INQUIRY_RECEIVED', recipients: 'Lead coordinator', delivery: ['IN_APP', 'EMAIL'] },
  { trigger: 'Information/action due', type: 'ACTION_REQUIRED', recipients: 'Owner/client', delivery: ['IN_APP', 'EMAIL'] },
  { trigger: 'Decision requested or updated', type: 'DECISION_REQUIRED', recipients: 'Decision maker/owner', delivery: ['IN_APP', 'EMAIL'] },
  { trigger: 'Compliance overdue', type: 'COMPLIANCE_OVERDUE', recipients: 'Owner/reviewer', delivery: ['IN_APP', 'EMAIL'] },
  { trigger: 'Readiness responsibility overdue', type: 'PRECONSTRUCTION_OVERDUE', recipients: 'Owner/reviewer/client', delivery: ['IN_APP', 'EMAIL'] },
  { trigger: 'Gate blocked or approved', type: 'GATE_UPDATE', recipients: 'Project owner/reviewer', delivery: ['IN_APP', 'EMAIL'] },
  { trigger: 'Procurement approval or exception', type: 'PROCUREMENT_EXCEPTION', recipients: 'Procurement owner/approver', delivery: ['IN_APP', 'EMAIL'] },
  { trigger: 'Delivery exception', type: 'DELIVERY_EXCEPTION', recipients: 'Procurement owner/project manager', delivery: ['IN_APP', 'EMAIL'] },
  { trigger: 'Client-impacting substitution', type: 'SUBSTITUTION_AUTHORIZATION', recipients: 'Client/designated approver', delivery: ['IN_APP', 'EMAIL'] },
  { trigger: 'Lead-time risk', type: 'LEAD_TIME_ALERT', recipients: 'Procurement owner/project owner', delivery: ['IN_APP', 'EMAIL'] },
] as const;

async function notify(userId: string, type: string, message: string, itemId: string, clientId?: string | null) {
  const user = await prisma.user.findFirst({ where: { id: userId, active: true }, select: { email: true } });
  if (!user) return null;
  let notification = await prisma.notification.findFirst({ where: { userId, type, itemId } });
  if (!notification) notification = await prisma.notification.create({ data: { userId, type, message, itemId, clientId: clientId || null } });
  if (user.email) await prisma.notificationDelivery.upsert({ where: { notificationId_channel: { notificationId: notification.id, channel: 'EMAIL' } }, update: {}, create: { notificationId: notification.id, channel: 'EMAIL', destination: user.email } });
  return notification;
}

async function suggestion(input: { projectId?: string | null; inquiryId?: string | null; type: string; sourceEntityType: string; sourceEntityId: string; title: string; value: unknown; rationale: string }) {
  const where = { type_sourceEntityType_sourceEntityId: { type: input.type, sourceEntityType: input.sourceEntityType, sourceEntityId: input.sourceEntityId } };
  const existing = await prisma.automationSuggestion.findUnique({ where });
  if (existing && existing.status !== 'PENDING_REVIEW') return existing;
  if (existing) return prisma.automationSuggestion.update({ where, data: { title: input.title, suggestionJson: JSON.stringify(input.value), rationale: input.rationale } });
  return prisma.automationSuggestion.create({ data: { projectId: input.projectId || null, inquiryId: input.inquiryId || null, type: input.type, sourceEntityType: input.sourceEntityType, sourceEntityId: input.sourceEntityId, title: input.title, suggestionJson: JSON.stringify(input.value), rationale: input.rationale, organizationId: process.env.ORGANIZATION_ID || null } });
}

async function processDelivery(id: string) {
  const delivery = await prisma.notificationDelivery.findUnique({ where: { id }, include: { notification: { include: { user: { select: { active: true } } } } } });
  if (!delivery) throw new AppError('Notification delivery not found.', 404, 'NOT_FOUND');
  const attempt = delivery.attemptCount + 1; const now = new Date();
  if (!delivery.notification.user.active) return prisma.notificationDelivery.update({ where: { id }, data: { status: 'CANCELLED', attemptCount: attempt, lastAttemptAt: now, nextAttemptAt: null, lastError: 'Recipient account is inactive.' } });
  if (process.env.EXTERNAL_NOTIFICATION_MODE === 'test-success') return prisma.notificationDelivery.update({ where: { id }, data: { status: 'SENT', attemptCount: attempt, lastAttemptAt: now, sentAt: now, lastError: null, providerMessageId: `test-${delivery.notificationId}` } });
  const nextAttemptAt = new Date(now.getTime() + Math.min(24, 2 ** Math.min(attempt, 5)) * 3_600_000);
  return prisma.notificationDelivery.update({ where: { id }, data: { status: 'FAILED', attemptCount: attempt, lastAttemptAt: now, nextAttemptAt, lastError: 'External notification provider is not configured; in-app notification remains authoritative.' } });
}

router.get('/automation/notification-matrix', async (req: AuthRequest, res, next) => { try { requireInternal(req.user); res.json({ data: NOTIFICATION_TRIGGER_MATRIX }); } catch (error) { next(error); } });

router.post('/automation/run', async (req: AuthRequest, res, next) => {
  let run: any;
  try {
    requireInternal(req.user); run = await prisma.automationRun.create({ data: { type: 'WORKFLOW_SCAN', triggeredBy: req.user!.id } });
    const now = new Date(); const threeDaysAgo = new Date(now.getTime() - 3 * 86_400_000); let notificationCount = 0; let suggestionCount = 0;
    const overdueItems = await prisma.workItem.findMany({ where: { dueAt: { lt: now }, status: { notIn: ['VERIFIED', 'CLOSED', 'CANCELLED'] }, deletedAt: null, OR: [{ project: { client: { deletedAt: null } } }, { inquiry: { client: { deletedAt: null } } }] }, include: { project: true, inquiry: true } });
    for (const item of overdueItems) for (const userId of [item.ownerId, item.reviewerId].filter(Boolean) as string[]) { await notify(userId, item.dueAt! < threeDaysAgo ? 'ESCALATION' : 'OVERDUE_REMINDER', `${item.dueAt! < threeDaysAgo ? 'Escalated' : 'Overdue'} action: ${item.title}`, item.id, item.project?.clientId || item.inquiry?.clientId); notificationCount++; }
    const incompleteInquiries = await prisma.inquiry.findMany({ where: { qualificationStatus: { notIn: ['DECLINED', 'CONVERTED'] }, client: { deletedAt: null } }, include: { property: true } });
    for (const inquiry of incompleteInquiries) { const missing = [['preliminaryScope', inquiry.preliminaryScope], ['budgetExpectation', inquiry.budgetExpectation], ['desiredTiming', inquiry.desiredTiming], ['property', inquiry.property]].filter(([, value]) => !value).map(([field]) => field); if (missing.length) { await suggestion({ inquiryId: inquiry.id, type: 'MISSING_INFORMATION', sourceEntityType: 'Inquiry', sourceEntityId: inquiry.id, title: 'Complete inquiry information', value: { missingFields: missing }, rationale: `The inquiry is missing ${missing.join(', ')}.` }); suggestionCount++; } }
    const documents = await prisma.document.findMany({ where: { deletedAt: null, client: { deletedAt: null } } });
    for (const document of documents) { const lower = document.originalName.toLowerCase(); const documentType = lower.includes('permit') ? 'PERMIT' : lower.includes('contract') ? 'CONTRACT' : lower.includes('invoice') ? 'INVOICE' : lower.includes('plan') ? 'PLAN' : 'UNCLASSIFIED'; await suggestion({ type: 'DOCUMENT_EXTRACTION', sourceEntityType: 'Document', sourceEntityId: document.id, title: `Review extracted document classification: ${document.originalName}`, value: { documentType, extractedFields: {}, confidence: documentType === 'UNCLASSIFIED' ? 0.25 : 0.7 }, rationale: 'Filename and metadata classification only; content and fields require human review.' }); suggestionCount++; }
    const consultations = await prisma.consultation.findMany({ where: { deletedAt: null, notes: { not: null }, client: { deletedAt: null } } });
    for (const consultation of consultations) { await suggestion({ inquiryId: consultation.inquiryId, type: 'MEETING_SUMMARY', sourceEntityType: 'Consultation', sourceEntityId: consultation.id, title: `Review meeting summary: ${consultation.title}`, value: { summary: consultation.notes!.slice(0, 800), source: 'consultation notes' }, rationale: 'Drafted from recorded meeting notes and requires confirmation by an attendee.' }); suggestionCount++; }
    const gaps = await prisma.preconstructionItem.findMany({ where: { required: true, status: { notIn: ['READY', 'NOT_APPLICABLE'] }, project: { client: { deletedAt: null } } } });
    for (const gap of gaps) { await suggestion({ projectId: gap.projectId, type: 'READINESS_GAP', sourceEntityType: 'PreconstructionItem', sourceEntityId: gap.id, title: `Resolve readiness gap: ${gap.title}`, value: { category: gap.category, status: gap.status, dueAt: gap.dueAt }, rationale: 'A required Construction Readiness condition is unresolved.' }); suggestionCount++; }
    const requests = await prisma.procurementRequest.findMany({ where: { project: { client: { deletedAt: null } } }, include: { quotes: { include: { vendor: true } }, selectedQuote: true } });
    for (const request of requests) {
      if (request.quotes.length >= 2) { const price = [...request.quotes].sort((a,b)=>a.totalCents-b.totalCents)[0]; const lead = request.quotes.filter((item)=>item.leadTimeDays!=null).sort((a,b)=>a.leadTimeDays!-b.leadTimeDays!)[0]; await suggestion({ projectId: request.projectId, type: 'QUOTE_COMPARISON', sourceEntityType: 'ProcurementRequest', sourceEntityId: request.id, title: `Review quote comparison: ${request.description}`, value: { lowestPrice: { quoteId: price.id, vendor: price.vendor.name, totalCents: price.totalCents }, shortestLeadTime: lead ? { quoteId: lead.id, vendor: lead.vendor.name, leadTimeDays: lead.leadTimeDays } : null }, rationale: 'Price and lead-time comparison only; scope, quality, compliance, and authorization require human judgment.' }); suggestionCount++; }
      if (request.selectedQuote?.leadTimeDays != null && request.status !== 'CLOSED') { const orderDeadline = new Date(request.requiredBy.getTime() - request.selectedQuote.leadTimeDays * 86_400_000); if (orderDeadline <= now) { const recipients = request.ownerId ? [request.ownerId] : (await prisma.user.findMany({ where: { role: 'ADMIN', active: true }, select: { id: true } })).map((item)=>item.id); for (const userId of recipients) { await notify(userId, 'LEAD_TIME_ALERT', `Lead-time risk: ${request.description} requires action for ${request.requiredBy.toLocaleDateString()}.`, request.id); notificationCount++; } await suggestion({ projectId: request.projectId, type: 'LEAD_TIME_RISK', sourceEntityType: 'ProcurementRequest', sourceEntityId: request.id, title: `Mitigate lead-time risk: ${request.description}`, value: { requiredBy: request.requiredBy, leadTimeDays: request.selectedQuote.leadTimeDays, orderDeadline }, rationale: 'The selected quote lead time has reached or exceeded the ordering window.' }); suggestionCount++; } }
    }
    const notifications = await prisma.notification.findMany({ where: { user: { active: true } }, include: { user: { select: { email: true } } } });
    for (const item of notifications) if (item.user.email) await prisma.notificationDelivery.upsert({ where: { notificationId_channel: { notificationId: item.id, channel: 'EMAIL' } }, update: {}, create: { notificationId: item.id, channel: 'EMAIL', destination: item.user.email } });
    const dueDeliveries = await prisma.notificationDelivery.findMany({ where: { status: { in: ['PENDING', 'FAILED'] }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] }, take: 100 }); let deliveryFailures = 0;
    for (const item of dueDeliveries) if ((await processDelivery(item.id)).status === 'FAILED') deliveryFailures++;
    const metrics = { notificationCount, suggestionCount, deliveriesProcessed: dueDeliveries.length, deliveryFailures };
    if(deliveryFailures)await recordOperationalAlert('NOTIFICATION_FAILURE',`${deliveryFailures} external notification deliveries failed during automation.`,{metadata:metrics});
    const completed = await prisma.automationRun.update({ where: { id: run.id }, data: { status: deliveryFailures ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED', metricsJson: JSON.stringify(metrics), completedAt: new Date() } }); res.json({ run: completed, metrics });
  } catch (error: any) { if (run?.id) await prisma.automationRun.update({ where: { id: run.id }, data: { status: 'FAILED', errorMessage: String(error?.message || error).slice(0, 2000), completedAt: new Date() } }).catch(() => undefined); await recordOperationalAlert('AUTOMATION_FAILURE','Workflow automation scan failed.',{severity:'CRITICAL',requestId:(req as any).requestId}).catch(()=>undefined); next(error); }
});

router.get('/automation/suggestions', async (req: AuthRequest, res, next) => { try { requireInternal(req.user); const status = typeof req.query.status === 'string' ? req.query.status : undefined; const data = await prisma.automationSuggestion.findMany({ where: status ? { status } : {}, orderBy: { createdAt: 'desc' }, take: 200 }); res.json({ data, pagination: { page: 1, limit: 200, total: data.length, totalPages: 1 } }); } catch (error) { next(error); } });
router.post('/automation/suggestions/:id/review', async (req: AuthRequest, res, next) => {
  try { requireInternal(req.user); const data = z.object({ decision: z.enum(['ACCEPT', 'REJECT']), comment: z.string().trim().max(5000).optional(), createWorkItem: z.boolean().default(false) }).parse(req.body); const before = await prisma.automationSuggestion.findUnique({ where: { id: req.params.id } }); if (!before) throw new AppError('Automation suggestion not found.', 404, 'NOT_FOUND'); if (before.status !== 'PENDING_REVIEW') throw new AppError('Suggestion has already been reviewed.', 409, 'INVALID_TRANSITION'); let workItemId: string | null = null; if (data.decision === 'ACCEPT' && data.createWorkItem) { const project = before.projectId ? await prisma.poolProject.findUnique({ where: { id: before.projectId } }) : null; const item = await prisma.workItem.create({ data: { projectId: before.projectId, inquiryId: before.inquiryId, stage: project?.currentLifecycleStage || 'INQUIRY', type: `SUGGESTION_${before.type}`, title: before.title, description: before.rationale, createdBy: req.user!.id, clientVisible: false } }); workItemId = item.id; } const reviewed = await prisma.automationSuggestion.update({ where: { id: before.id }, data: { status: data.decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED', reviewedBy: req.user!.id, reviewedAt: new Date(), reviewComment: data.comment || null } }); await writeAuditEvent(prisma, { userId: req.user!.id, action: data.decision, entityType: 'AutomationSuggestion', entityId: reviewed.id, requestId: (req as any).requestId, before, after: { ...reviewed, workItemId } }); res.json({ suggestion: reviewed, workItemId }); } catch (error) { next(error); }
});

router.get('/automation/deliveries', async (req: AuthRequest, res, next) => { try { requireInternal(req.user); const data = await prisma.notificationDelivery.findMany({ include: { notification: true }, orderBy: { createdAt: 'desc' }, take: 200 }); res.json({ data, pagination: { page: 1, limit: 200, total: data.length, totalPages: 1 } }); } catch (error) { next(error); } });
router.post('/automation/deliveries/:id/retry', async (req: AuthRequest, res, next) => { try { requireInternal(req.user); res.json(await processDelivery(req.params.id)); } catch (error) { next(error); } });

export default router;
