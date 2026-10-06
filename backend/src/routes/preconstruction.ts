import express from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { authenticate, loadClientData, AuthRequest } from '../middleware/auth';
import { approvalLimiter } from '../middleware/rateLimits';
import { assertActiveAssignee, assertProjectAccess, requireInternal } from '../workflow/authorization';
import { writeAuditEvent } from '../workflow/audit';
import { calculateReadiness, ensureReadinessItems, READINESS_CATEGORIES } from '../workflow/preconstruction';

const router = express.Router();
router.use(authenticate, loadClientData);

const itemSchema = z.object({
  category: z.enum(READINESS_CATEGORIES), title: z.string().trim().min(3).max(250), details: z.string().trim().max(5000).nullable().optional(),
  required: z.boolean().default(true), ownerId: z.string().uuid().nullable().optional(), reviewerId: z.string().uuid().nullable().optional(),
  dueAt: z.coerce.date().nullable().optional(), clientVisible: z.boolean().default(false), responsibilityParty: z.enum(['INTERNAL', 'CLIENT', 'VENDOR', 'SHARED']).nullable().optional(),
  costCode: z.string().trim().max(50).nullable().optional(), amountCents: z.number().int().min(0).nullable().optional(), allowanceCents: z.number().int().min(0).nullable().optional(),
  currencyCode: z.string().regex(/^[A-Z]{3}$/).default('USD'), startAt: z.coerce.date().nullable().optional(), endAt: z.coerce.date().nullable().optional(),
  longLead: z.boolean().default(false), sourceReference: z.string().trim().max(500).nullable().optional(), targetReference: z.string().trim().max(500).nullable().optional(),
});
const itemStatuses = ['NOT_STARTED', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'READY', 'BLOCKED', 'NOT_APPLICABLE'] as const;
const exceptionSchema = z.object({ reason: z.string().trim().min(10).max(5000), risk: z.string().trim().min(3).max(5000), mitigation: z.string().trim().min(3).max(5000), ownerId: z.string().uuid(), dueAt: z.coerce.date(), highRisk: z.boolean().default(false) });

async function findItem(req: AuthRequest, id: string) {
  const item = await prisma.preconstructionItem.findUnique({ where: { id }, include: { project: true, exceptions: true } });
  if (!item) throw new AppError('Pre-Construction item not found.', 404, 'NOT_FOUND');
  await assertProjectAccess(req.user, item.projectId);
  if (req.user?.role === 'CLIENT' && !item.clientVisible) throw new AppError('Pre-Construction item not found.', 404, 'NOT_FOUND');
  return item;
}

async function staleReadiness(projectId: string) {
  await prisma.readinessReview.updateMany({ where: { projectId, status: 'APPROVED' }, data: { status: 'STALE', result: 'Project readiness changed after approval.' } });
  await prisma.projectGate.updateMany({ where: { projectId, fromStage: 'PRE_CONSTRUCTION', status: 'APPROVED' }, data: { status: 'PENDING', approvedAt: null, approvedBy: null } });
}

async function notifyOverdue(projectId: string) {
  const overdue = await prisma.preconstructionItem.findMany({ where: { projectId, required: true, dueAt: { lt: new Date() }, status: { notIn: ['READY', 'NOT_APPLICABLE'] } }, include: { project: { include: { client: { include: { users: true } } } } } });
  for (const item of overdue) {
    const recipients = new Set([item.ownerId, item.reviewerId, ...(item.clientVisible && item.responsibilityParty === 'CLIENT' ? item.project.client.users.map((user) => user.id) : [])].filter(Boolean) as string[]);
    for (const userId of recipients) {
      if (!(await prisma.notification.findFirst({ where: { userId, type: 'PRECONSTRUCTION_OVERDUE', itemId: item.id } }))) {
        await prisma.notification.create({ data: { userId, type: 'PRECONSTRUCTION_OVERDUE', message: `Overdue Pre-Construction item: ${item.title}`, itemId: item.id, clientId: item.clientVisible ? item.project.clientId : null } });
      }
    }
  }
}

router.get('/projects/:projectId/preconstruction', async (req: AuthRequest, res, next) => {
  try {
    const project = await assertProjectAccess(req.user, req.params.projectId);
    if (req.user?.role !== 'CLIENT') { await ensureReadinessItems(prisma, project.id); await notifyOverdue(project.id); }
    const clientView = req.user?.role === 'CLIENT';
    const [items, reviews, assignments, calculation] = await Promise.all([
      prisma.preconstructionItem.findMany({ where: { projectId: project.id, ...(clientView ? { clientVisible: true } : {}) }, include: { owner: { select: { id: true, name: true } }, reviewer: { select: { id: true, name: true } }, exceptions: true, evidenceLinks: { where: { isCurrent: true }, include: { document: true } } }, orderBy: [{ category: 'asc' }, { createdAt: 'asc' }] }),
      clientView ? Promise.resolve([]) : prisma.readinessReview.findMany({ where: { projectId: project.id }, include: { reviewer: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 10 }),
      clientView ? Promise.resolve([]) : prisma.projectAssignment.findMany({ where: { projectId: project.id, active: true }, include: { user: { select: { id: true, name: true, email: true, role: true } } } }),
      clientView ? Promise.resolve(null) : calculateReadiness(prisma, project.id),
    ]);
    res.json({ project: { id: project.id, clientId: project.clientId, currentLifecycleStage: project.currentLifecycleStage }, client: { id: project.client.id, name: project.client.name }, items, reviews, assignments, readiness: calculation ? { score: calculation.score, blockers: calculation.blockers, exceptionCount: calculation.exceptionCount } : null });
  } catch (error) { next(error); }
});

router.post('/projects/:projectId/preconstruction/items', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user); await assertProjectAccess(req.user, req.params.projectId); const data = itemSchema.parse(req.body);
    await assertActiveAssignee(data.ownerId, 'Pre-Construction owner');
    await assertActiveAssignee(data.reviewerId, 'Pre-Construction reviewer');
    const item = await prisma.preconstructionItem.create({ data: { ...data, projectId: req.params.projectId, organizationId: process.env.ORGANIZATION_ID || null } });
    await staleReadiness(item.projectId); await writeAuditEvent(prisma, { userId: req.user!.id, action: 'CREATE', entityType: 'PreconstructionItem', entityId: item.id, requestId: (req as any).requestId, after: item });
    res.status(201).json(item);
  } catch (error) { next(error); }
});

router.put('/preconstruction/items/:id', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user); const before = await findItem(req, req.params.id);
    const data = itemSchema.partial().extend({ status: z.enum(itemStatuses).optional() }).parse(req.body);
    await assertActiveAssignee(data.ownerId, 'Pre-Construction owner');
    await assertActiveAssignee(data.reviewerId, 'Pre-Construction reviewer');
    if (data.status && ['READY_FOR_REVIEW', 'READY'].includes(data.status)) throw new AppError('Use the completion or verification endpoint for readiness transitions.', 409, 'INVALID_TRANSITION');
    const item = await prisma.preconstructionItem.update({ where: { id: before.id }, data });
    await staleReadiness(item.projectId); await writeAuditEvent(prisma, { userId: req.user!.id, action: 'UPDATE', entityType: 'PreconstructionItem', entityId: item.id, requestId: (req as any).requestId, before, after: item });
    res.json(item);
  } catch (error) { next(error); }
});

router.post('/preconstruction/items/:id/complete', async (req: AuthRequest, res, next) => {
  try {
  const before = await findItem(req, req.params.id); const internal = req.user?.role === 'ADMIN';
    if (!internal && (!before.clientVisible || before.responsibilityParty !== 'CLIENT')) throw new AppError('You cannot complete this readiness item.', 403, 'FORBIDDEN');
    if (!['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED'].includes(before.status)) throw new AppError('This item cannot be completed from its current status.', 409, 'INVALID_TRANSITION');
    if (before.category === 'SCOPE_RECONCILIATION' && before.sourceReference && before.targetReference && before.sourceReference !== before.targetReference) throw new AppError('Contract and approved scope references do not match.', 409, 'GATE_BLOCKED', { blockers: [{ type: 'SCOPE_MISMATCH', id: before.id, title: 'Reconcile the contract and approved scope references.' }] });
    const status = before.reviewerId ? 'READY_FOR_REVIEW' : 'READY';
    const item = await prisma.preconstructionItem.update({ where: { id: before.id }, data: { status, completedAt: new Date() } });
    await staleReadiness(item.projectId); await writeAuditEvent(prisma, { userId: req.user!.id, action: 'COMPLETE', entityType: 'PreconstructionItem', entityId: item.id, requestId: (req as any).requestId, before, after: item });
    res.json(item);
  } catch (error) { next(error); }
});

router.post('/preconstruction/items/:id/evidence', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user);
    const item = await findItem(req, req.params.id);
    const data = z.object({ documentId: z.string().uuid(), purpose: z.string().trim().min(3).max(500) }).parse(req.body);
    const document = await prisma.document.findFirst({ where: { id: data.documentId, clientId: item.project.clientId, deletedAt: null } });
    if (!document) throw new AppError('Evidence document does not belong to this project.', 400, 'VALIDATION_ERROR');
    const link = await prisma.evidenceLink.create({ data: { documentId: data.documentId, projectId: item.projectId, preconstructionItemId: item.id, stage: 'PRE_CONSTRUCTION', purpose: data.purpose, createdBy: req.user!.id, organizationId: process.env.ORGANIZATION_ID || null } });
    await writeAuditEvent(prisma, { userId: req.user!.id, action: 'LINK', entityType: 'EvidenceLink', entityId: link.id, requestId: (req as any).requestId, after: link });
    res.status(201).json(link);
  } catch (error) { next(error); }
});

router.post('/preconstruction/items/:id/verify', approvalLimiter, async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user); const before = await findItem(req, req.params.id);
    if (before.status !== 'READY_FOR_REVIEW') throw new AppError('This item is not ready for verification.', 409, 'INVALID_TRANSITION');
    if (before.reviewerId && before.reviewerId !== req.user!.id && req.user!.role !== 'ADMIN') throw new AppError('Only the assigned reviewer can verify this item.', 403, 'FORBIDDEN');
    const item = await prisma.preconstructionItem.update({ where: { id: before.id }, data: { status: 'READY', verifiedAt: new Date() } });
    await staleReadiness(item.projectId); await writeAuditEvent(prisma, { userId: req.user!.id, action: 'VERIFY', entityType: 'PreconstructionItem', entityId: item.id, requestId: (req as any).requestId, before, after: item });
    res.json(item);
  } catch (error) { next(error); }
});

router.post('/preconstruction/items/:id/exceptions', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user); const item = await findItem(req, req.params.id); const data = exceptionSchema.parse(req.body);
    await assertActiveAssignee(data.ownerId, 'Readiness exception owner');
    const exception = await prisma.readinessException.create({ data: { ...data, projectId: item.projectId, itemId: item.id, organizationId: process.env.ORGANIZATION_ID || null } });
    await staleReadiness(item.projectId); await writeAuditEvent(prisma, { userId: req.user!.id, action: 'CREATE', entityType: 'ReadinessException', entityId: exception.id, requestId: (req as any).requestId, after: exception });
    res.status(201).json(exception);
  } catch (error) { next(error); }
});

router.post('/readiness-exceptions/:id/approve', approvalLimiter, async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user); const before = await prisma.readinessException.findUnique({ where: { id: req.params.id } });
    if (!before) throw new AppError('Readiness exception not found.', 404, 'NOT_FOUND'); await assertProjectAccess(req.user, before.projectId);
    if (before.highRisk && req.user!.role !== 'ADMIN') throw new AppError('Leadership approval is required for high-risk readiness exceptions.', 403, 'FORBIDDEN');
    const exception = await prisma.readinessException.update({ where: { id: before.id }, data: { status: 'APPROVED', approvedBy: req.user!.id, approvedAt: new Date() } });
    await writeAuditEvent(prisma, { userId: req.user!.id, action: 'APPROVE', entityType: 'ReadinessException', entityId: exception.id, requestId: (req as any).requestId, before, after: exception }); res.json(exception);
  } catch (error) { next(error); }
});

router.post('/projects/:projectId/readiness-review', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user); await assertProjectAccess(req.user, req.params.projectId); await ensureReadinessItems(prisma, req.params.projectId);
    const { reviewerId } = z.object({ reviewerId: z.string().uuid() }).parse(req.body); const selectedReviewer = reviewerId;
    if (selectedReviewer === req.user!.id) throw new AppError('A readiness review must be assigned to someone other than the person creating the snapshot.', 409, 'SEPARATION_OF_DUTIES');
    await assertActiveAssignee(selectedReviewer, 'Readiness reviewer');
    const calculation = await calculateReadiness(prisma, req.params.projectId);
    const review = await prisma.readinessReview.create({ data: { projectId: req.params.projectId, reviewerId: selectedReviewer, checklistJson: JSON.stringify(calculation.items), blockerCount: calculation.blockers.length, exceptionCount: calculation.exceptionCount, score: calculation.score, result: calculation.blockers.length ? 'BLOCKED' : 'READY', organizationId: process.env.ORGANIZATION_ID || null } });
    await writeAuditEvent(prisma, { userId: req.user!.id, action: 'CREATE', entityType: 'ReadinessReview', entityId: review.id, requestId: (req as any).requestId, after: review }); res.status(201).json(review);
  } catch (error) { next(error); }
});

router.post('/readiness-reviews/:id/submit', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user); const before = await prisma.readinessReview.findUnique({ where: { id: req.params.id } }); if (!before) throw new AppError('Readiness review not found.', 404, 'NOT_FOUND'); await assertProjectAccess(req.user, before.projectId);
    if (before.status !== 'DRAFT' && before.status !== 'BLOCKED') throw new AppError('Readiness review cannot be submitted from its current status.', 409, 'INVALID_TRANSITION');
    const calculation = await calculateReadiness(prisma, before.projectId); const status = calculation.blockers.length ? 'BLOCKED' : 'SUBMITTED';
    const review = await prisma.readinessReview.update({ where: { id: before.id }, data: { status, checklistJson: JSON.stringify(calculation.items), blockerCount: calculation.blockers.length, exceptionCount: calculation.exceptionCount, score: calculation.score, result: calculation.blockers.length ? 'BLOCKED' : 'READY_FOR_APPROVAL', submittedAt: new Date() } });
    await writeAuditEvent(prisma, { userId: req.user!.id, action: 'SUBMIT', entityType: 'ReadinessReview', entityId: review.id, requestId: (req as any).requestId, before, after: review });
    if (calculation.blockers.length) throw new AppError('Readiness review is blocked by incomplete conditions.', 409, 'GATE_BLOCKED', { blockers: calculation.blockers, reviewId: review.id, score: calculation.score }); res.json(review);
  } catch (error) { next(error); }
});

router.post('/readiness-reviews/:id/approve', approvalLimiter, async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user); const before = await prisma.readinessReview.findUnique({ where: { id: req.params.id } }); if (!before) throw new AppError('Readiness review not found.', 404, 'NOT_FOUND'); await assertProjectAccess(req.user, before.projectId);
    if (before.status !== 'SUBMITTED') throw new AppError('Readiness review is not awaiting approval.', 409, 'INVALID_TRANSITION');
    if (before.reviewerId === req.user!.id) throw new AppError('A readiness review cannot be approved by the person assigned to review it.', 409, 'SEPARATION_OF_DUTIES');
    if (before.reviewerId !== req.user!.id && req.user!.role !== 'ADMIN') throw new AppError('Only the assigned reviewer can approve this review.', 403, 'FORBIDDEN');
    const calculation = await calculateReadiness(prisma, before.projectId); if (calculation.blockers.length) throw new AppError('Readiness changed and is no longer complete.', 409, 'GATE_BLOCKED', { blockers: calculation.blockers });
    await prisma.readinessReview.updateMany({ where: { projectId: before.projectId, status: 'APPROVED' }, data: { status: 'SUPERSEDED' } });
    const review = await prisma.readinessReview.update({ where: { id: before.id }, data: { status: 'APPROVED', result: 'CONSTRUCTION_READY', reviewedAt: new Date(), score: calculation.score, blockerCount: 0 } });
    await writeAuditEvent(prisma, { userId: req.user!.id, action: 'APPROVE', entityType: 'ReadinessReview', entityId: review.id, requestId: (req as any).requestId, before, after: review }); res.json(review);
  } catch (error) { next(error); }
});

export default router;
