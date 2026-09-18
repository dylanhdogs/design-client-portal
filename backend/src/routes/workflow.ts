import express from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { authenticate, loadClientData, AuthRequest } from '../middleware/auth';
import { approvalLimiter } from '../middleware/rateLimits';
import { assertActiveAssignee, assertProjectAccess, canOverrideGate, requireInternal } from '../workflow/authorization';
import { advanceStage, evaluateGate } from '../workflow/gates';
import { writeAuditEvent } from '../workflow/audit';
import {
  ASSIGNMENT_SCOPES, DECISION_STATUSES, LIFECYCLE_STAGES,
  WORK_ITEM_PRIORITIES, WORK_ITEM_STATUSES,
} from '../workflow/constants';

const router = express.Router();
router.use(authenticate, loadClientData);

const workItemCreateSchema = z.object({
  stage: z.enum(LIFECYCLE_STAGES),
  type: z.string().trim().min(1).max(50).default('TASK'),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  priority: z.enum(WORK_ITEM_PRIORITIES).default('NORMAL'),
  ownerId: z.string().uuid().nullable().optional(),
  reviewerId: z.string().uuid().nullable().optional(),
  dueAt: z.coerce.date().nullable().optional(),
  clientVisible: z.boolean().default(false),
});

const workItemUpdateSchema = workItemCreateSchema.partial().omit({ stage: true }).extend({
  status: z.enum(WORK_ITEM_STATUSES).optional(),
});

const decisionCreateSchema = z.object({
  stage: z.enum(LIFECYCLE_STAGES),
  workItemId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  options: z.array(z.string().trim().min(1).max(500)).min(1),
  decisionMakerId: z.string().uuid().nullable().optional(),
  costImpact: z.coerce.number().finite().nullable().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  scheduleImpact: z.string().trim().max(1000).optional(),
  dueAt: z.coerce.date().nullable().optional(),
});

const decisionResultSchema = z.object({
  selectedOption: z.string().trim().min(1).max(500).optional(),
  comment: z.string().trim().min(1).max(5000).optional(),
  idempotencyKey: z.string().trim().min(8).max(200).optional(),
});

const assignmentSchema = z.object({
  userId: z.string().uuid(),
  scope: z.enum(ASSIGNMENT_SCOPES),
});

const advancementSchema = z.object({
  expectedVersion: z.number().int().min(0),
  idempotencyKey: z.string().trim().min(8).max(200).optional(),
});

const overrideSchema = advancementSchema.extend({
  reason: z.string().trim().min(10).max(5000),
  risk: z.string().trim().min(3).max(5000),
  mitigation: z.string().trim().min(3).max(5000),
  ownerId: z.string().uuid(),
  dueAt: z.coerce.date(),
});

async function assertWorkItemAccess(req: AuthRequest, item: { projectId: string | null; inquiryId: string | null; clientVisible: boolean }) {
  if (item.projectId) return assertProjectAccess(req.user, item.projectId);
  if (!item.inquiryId) throw new AppError('Work item has no valid parent.', 409, 'CONFLICT');
  const inquiry = await prisma.inquiry.findUnique({ where: { id: item.inquiryId }, select: { clientId: true } });
  if (!inquiry) throw new AppError('Inquiry not found.', 404, 'NOT_FOUND');
  if (req.user?.role === 'CLIENT' && (req.user.clientId !== inquiry.clientId || !item.clientVisible)) {
    throw new AppError('Work item not found.', 404, 'NOT_FOUND');
  }
  if (!req.user || !['ADMIN', 'CLIENT'].includes(req.user.role)) throw new AppError('Access denied.', 403, 'FORBIDDEN');
}

router.get('/projects/:projectId/command-center', async (req: AuthRequest, res, next) => {
  try {
    const project = await assertProjectAccess(req.user, req.params.projectId);
    const clientView = req.user?.role === 'CLIENT';
    const [lifecycle, gates, workItems, decisions, assignments] = await Promise.all([
      prisma.lifecycleStage.findMany({ where: { projectId: project.id }, orderBy: { createdAt: 'asc' } }),
      prisma.projectGate.findMany({ where: { projectId: project.id }, orderBy: { createdAt: 'asc' } }),
      prisma.workItem.findMany({
        where: { projectId: project.id, deletedAt: null, ...(clientView ? { clientVisible: true } : {}) },
        include: { owner: { select: { id: true, name: true } }, reviewer: { select: { id: true, name: true } } },
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.decision.findMany({
        where: { projectId: project.id, ...(clientView ? { decisionMakerId: req.user?.id } : {}) },
        include: { decisionMaker: { select: { id: true, name: true } } },
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      }),
      clientView ? Promise.resolve([]) : prisma.projectAssignment.findMany({
        where: { projectId: project.id, active: true },
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      }),
    ]);
    const activityEntityIds = [
      project.id,
      ...gates.map((item) => item.id),
      ...workItems.map((item) => item.id),
      ...decisions.map((item) => item.id),
      ...assignments.map((item) => item.id),
    ];
    const activity = clientView ? [] : await prisma.activityLog.findMany({
      where: { entityId: { in: activityEntityIds } },
      orderBy: { createdAt: 'desc' }, take: 25,
      include: { user: { select: { name: true, role: true } } },
    });
    const currentGate = gates.find((gate) => gate.fromStage === project.currentLifecycleStage) || null;
    const blockers = currentGate ? (await evaluateGate(prisma, project.id, currentGate.fromStage)).blockers : [];
    const receptionInquiry = clientView ? null : await prisma.inquiry.findFirst({
      where: { projectId: project.id, qualificationStatus: 'CONVERTED' },
      select: { id: true },
    });
    res.json({
      project: { ...project, client: undefined },
      client: { id: project.client.id, name: project.client.name },
      receptionInquiry,
      lifecycle,
      legacyPhases: await prisma.projectPhase.findMany({ where: { projectId: project.id, name: { not: 'INTAKE' } }, orderBy: { order: 'asc' } }),
      currentGate,
      blockers,
      openWorkItems: workItems,
      pendingDecisions: decisions,
      assignments,
      recentActivity: activity,
    });
  } catch (error) { next(error); }
});

router.get('/projects/:projectId/work-items', async (req: AuthRequest, res, next) => {
  try {
    await assertProjectAccess(req.user, req.params.projectId);
    const data = await prisma.workItem.findMany({
      where: {
        projectId: req.params.projectId, deletedAt: null,
        ...(req.user?.role === 'CLIENT' ? { clientVisible: true } : {}),
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({ data, pagination: { page: 1, limit: data.length, total: data.length, totalPages: 1 } });
  } catch (error) { next(error); }
});

router.post('/projects/:projectId/work-items', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user);
    const project = await assertProjectAccess(req.user, req.params.projectId);
    const data = workItemCreateSchema.parse(req.body);
    const owner = await assertActiveAssignee(data.ownerId, 'Work item owner', ['ADMIN', 'CLIENT']);
    if (owner?.role === 'CLIENT' && owner.clientId !== project.clientId) {
      throw new AppError('Work item owner must belong to this project client.', 400, 'VALIDATION_ERROR');
    }
    await assertActiveAssignee(data.reviewerId, 'Work item reviewer');
    const item = await prisma.workItem.create({
      data: { ...data, projectId: req.params.projectId, createdBy: req.user!.id },
    });
    await writeAuditEvent(prisma, { userId: req.user!.id, action: 'CREATE', entityType: 'WorkItem', entityId: item.id, requestId: (req as any).requestId, after: item });
    res.status(201).json(item);
  } catch (error) { next(error); }
});

router.get('/work-items/:id', async (req: AuthRequest, res, next) => {
  try {
    const item = await prisma.workItem.findFirst({ where: { id: req.params.id, deletedAt: null } });
    if (!item) throw new AppError('Work item not found.', 404, 'NOT_FOUND');
    await assertWorkItemAccess(req, item);
    if (req.user?.role === 'CLIENT' && !item.clientVisible) throw new AppError('Work item not found.', 404, 'NOT_FOUND');
    res.json(item);
  } catch (error) { next(error); }
});

router.put('/work-items/:id', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user);
    const before = await prisma.workItem.findFirst({ where: { id: req.params.id, deletedAt: null } });
    if (!before) throw new AppError('Work item not found.', 404, 'NOT_FOUND');
    await assertWorkItemAccess(req, before);
    const data = workItemUpdateSchema.parse(req.body);
    const owner = await assertActiveAssignee(data.ownerId, 'Work item owner', ['ADMIN', 'CLIENT']);
    if (owner?.role === 'CLIENT') {
      const parent = before.projectId
        ? await prisma.poolProject.findUnique({ where: { id: before.projectId }, select: { clientId: true } })
        : await prisma.inquiry.findUnique({ where: { id: before.inquiryId! }, select: { clientId: true } });
      if (!parent || owner.clientId !== parent.clientId) {
        throw new AppError('Work item owner must belong to the parent client.', 400, 'VALIDATION_ERROR');
      }
    }
    await assertActiveAssignee(data.reviewerId, 'Work item reviewer');
    if (data.status && ['COMPLETED', 'VERIFIED', 'CLOSED'].includes(data.status)) {
      throw new AppError('Use the completion or verification endpoint for this transition.', 409, 'INVALID_TRANSITION');
    }
    const item = await prisma.workItem.update({ where: { id: before.id }, data });
    await writeAuditEvent(prisma, { userId: req.user!.id, action: 'UPDATE', entityType: 'WorkItem', entityId: item.id, requestId: (req as any).requestId, before, after: item });
    res.json(item);
  } catch (error) { next(error); }
});

router.post('/work-items/:id/complete', async (req: AuthRequest, res, next) => {
  try {
    const before = await prisma.workItem.findFirst({ where: { id: req.params.id, deletedAt: null } });
    if (!before) throw new AppError('Work item not found.', 404, 'NOT_FOUND');
    await assertWorkItemAccess(req, before);
    const internal = req.user?.role === 'ADMIN';
    if (!internal && (!before.clientVisible || before.ownerId !== req.user?.id)) throw new AppError('You cannot complete this work item.', 403, 'FORBIDDEN');
    if (['COMPLETED', 'READY_FOR_REVIEW', 'VERIFIED', 'CLOSED'].includes(before.status)) return res.json(before);
    const status = before.reviewerId ? 'READY_FOR_REVIEW' : 'COMPLETED';
    const item = await prisma.$transaction(async (tx) => {
      const updated = await tx.workItem.update({ where: { id: before.id }, data: { status, completedAt: new Date() } });
      await writeAuditEvent(tx, { userId: req.user!.id, action: 'COMPLETE', entityType: 'WorkItem', entityId: updated.id, requestId: (req as any).requestId, before, after: updated });
      if (!internal && before.reviewerId && before.inquiryId) {
        const inquiry = await tx.inquiry.findUnique({ where: { id: before.inquiryId }, select: { clientId: true } });
        if (inquiry) await tx.notification.create({
          data: {
            userId: before.reviewerId,
            type: 'INQUIRY_INFORMATION_PROVIDED',
            message: `Client information is ready for review: ${before.title}`,
            clientId: inquiry.clientId,
            inquiryId: before.inquiryId,
            itemId: before.id,
          },
        });
      }
      return updated;
    });
    res.json(item);
  } catch (error) { next(error); }
});

router.post('/work-items/:id/verify', approvalLimiter, async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user);
    const before = await prisma.workItem.findFirst({ where: { id: req.params.id, deletedAt: null } });
    if (!before) throw new AppError('Work item not found.', 404, 'NOT_FOUND');
    await assertWorkItemAccess(req, before);
    if (before.status === 'VERIFIED' || before.status === 'CLOSED') return res.json(before);
    if (!['READY_FOR_REVIEW', 'COMPLETED'].includes(before.status)) throw new AppError('Work item is not ready for verification.', 409, 'INVALID_TRANSITION');
    if (before.reviewerId && before.reviewerId !== req.user!.id && req.user!.role !== 'ADMIN') throw new AppError('Only the assigned reviewer can verify this work item.', 403, 'FORBIDDEN');
    const item = await prisma.workItem.update({ where: { id: before.id }, data: { status: 'VERIFIED', verifiedAt: new Date() } });
    await writeAuditEvent(prisma, { userId: req.user!.id, action: 'VERIFY', entityType: 'WorkItem', entityId: item.id, requestId: (req as any).requestId, before, after: item });
    res.json(item);
  } catch (error) { next(error); }
});

router.get('/projects/:projectId/decisions', async (req: AuthRequest, res, next) => {
  try {
    await assertProjectAccess(req.user, req.params.projectId);
    const data = await prisma.decision.findMany({
      where: { projectId: req.params.projectId, ...(req.user?.role === 'CLIENT' ? { decisionMakerId: req.user.id } : {}) },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({ data, pagination: { page: 1, limit: data.length, total: data.length, totalPages: 1 } });
  } catch (error) { next(error); }
});

router.post('/projects/:projectId/decisions', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user);
    const project = await assertProjectAccess(req.user, req.params.projectId);
    const data = decisionCreateSchema.parse(req.body);
    const decisionMaker = await assertActiveAssignee(data.decisionMakerId, 'Decision-maker', ['ADMIN', 'CLIENT']);
    if (decisionMaker?.role === 'CLIENT' && decisionMaker.clientId !== project.clientId) {
      throw new AppError('Decision-maker must belong to this project client.', 400, 'VALIDATION_ERROR');
    }
    if (data.workItemId) {
      const workItem = await prisma.workItem.findFirst({ where: { id: data.workItemId, projectId: req.params.projectId, deletedAt: null } });
      if (!workItem) throw new AppError('Work item does not belong to this project.', 400, 'VALIDATION_ERROR');
    }
    const decision = await prisma.decision.create({
      data: {
        ...data,
        optionsJson: JSON.stringify(data.options),
        options: undefined,
        costImpact: data.costImpact,
        projectId: req.params.projectId,
        requestedBy: req.user!.id,
        status: data.decisionMakerId ? 'REQUESTED' : 'DRAFT',
      } as any,
    });
    await writeAuditEvent(prisma, { userId: req.user!.id, action: 'CREATE', entityType: 'Decision', entityId: decision.id, requestId: (req as any).requestId, after: decision });
    res.status(201).json(decision);
  } catch (error) { next(error); }
});

async function resolveDecision(req: AuthRequest, result: 'APPROVED' | 'REJECTED') {
  const data = decisionResultSchema.parse(req.body);
  const before = await prisma.decision.findUnique({ where: { id: req.params.id } });
  if (!before) throw new AppError('Decision not found.', 404, 'NOT_FOUND');
  await assertProjectAccess(req.user, before.projectId);
  if (before.status === result) return before;
  if (['APPROVED', 'REJECTED', 'CANCELLED'].includes(before.status)) throw new AppError('This decision is already final.', 409, 'INVALID_TRANSITION');
  if (before.decisionMakerId && before.decisionMakerId !== req.user!.id && req.user!.role !== 'ADMIN') throw new AppError('Only the assigned decision-maker can decide this item.', 403, 'FORBIDDEN');
  if (result === 'REJECTED' && !data.comment) throw new AppError('A rejection reason is required.', 400, 'VALIDATION_ERROR');
  if (result === 'APPROVED' && (!data.selectedOption || !JSON.parse(before.optionsJson || '[]').includes(data.selectedOption))) {
    throw new AppError('Select one of the available options.', 400, 'VALIDATION_ERROR');
  }
  const idempotencyKey = data.idempotencyKey || req.header('idempotency-key') || undefined;
  if (idempotencyKey) {
    const existing = await prisma.approval.findUnique({ where: { idempotencyKey } });
    if (existing) return prisma.decision.findUnique({ where: { id: before.id } });
  }
  return prisma.$transaction(async (tx) => {
    const decision = await tx.decision.update({
      where: { id: before.id },
      data: { status: result, selectedOption: data.selectedOption || null, decidedAt: new Date() },
    });
    await tx.approval.create({
      data: { projectId: before.projectId, decisionId: before.id, approvalType: 'DECISION', approverId: req.user!.id, result, comment: data.comment, idempotencyKey },
    });
    await writeAuditEvent(tx, { userId: req.user!.id, action: result, entityType: 'Decision', entityId: decision.id, requestId: (req as any).requestId, before, after: decision });
    return decision;
  });
}

router.post('/decisions/:id/approve', approvalLimiter, async (req: AuthRequest, res, next) => {
  try { res.json(await resolveDecision(req, 'APPROVED')); } catch (error) { next(error); }
});
router.post('/decisions/:id/reject', approvalLimiter, async (req: AuthRequest, res, next) => {
  try { res.json(await resolveDecision(req, 'REJECTED')); } catch (error) { next(error); }
});

router.get('/projects/:projectId/assignments', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user); await assertProjectAccess(req.user, req.params.projectId);
    res.json(await prisma.projectAssignment.findMany({ where: { projectId: req.params.projectId, active: true }, include: { user: { select: { id: true, name: true, email: true, role: true } } } }));
  } catch (error) { next(error); }
});
router.post('/projects/:projectId/assignments', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user); await assertProjectAccess(req.user, req.params.projectId);
    const data = assignmentSchema.parse(req.body);
    await assertActiveAssignee(data.userId, 'Assignment');
    const assignment = await prisma.projectAssignment.upsert({
      where: { projectId_userId_scope: { projectId: req.params.projectId, ...data } },
      update: { active: true }, create: { projectId: req.params.projectId, ...data },
    });
    await writeAuditEvent(prisma, { userId: req.user!.id, action: 'ASSIGN', entityType: 'ProjectAssignment', entityId: assignment.id, requestId: (req as any).requestId, after: assignment });
    res.status(201).json(assignment);
  } catch (error) { next(error); }
});
router.delete('/assignments/:id', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user);
    const before = await prisma.projectAssignment.findUnique({ where: { id: req.params.id } });
    if (!before) throw new AppError('Assignment not found.', 404, 'NOT_FOUND');
    await assertProjectAccess(req.user, before.projectId);
    const assignment = await prisma.projectAssignment.update({ where: { id: before.id }, data: { active: false } });
    await writeAuditEvent(prisma, { userId: req.user!.id, action: 'UNASSIGN', entityType: 'ProjectAssignment', entityId: assignment.id, requestId: (req as any).requestId, before, after: assignment });
    res.json(assignment);
  } catch (error) { next(error); }
});

router.post('/projects/:projectId/stages/:stage/advance', approvalLimiter, async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user); await assertProjectAccess(req.user, req.params.projectId);
    if (!LIFECYCLE_STAGES.includes(req.params.stage as any)) throw new AppError('Unknown lifecycle stage.', 400, 'VALIDATION_ERROR');
    const data = advancementSchema.parse(req.body);
    const project = await prisma.$transaction((tx) => advanceStage(tx, {
      projectId: req.params.projectId, stage: req.params.stage, userId: req.user!.id,
      expectedVersion: data.expectedVersion, idempotencyKey: data.idempotencyKey || req.header('idempotency-key') || undefined,
      requestId: (req as any).requestId,
    }));
    res.json(project);
  } catch (error) { next(error); }
});

router.post('/projects/:projectId/stages/:stage/override', approvalLimiter, async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user); await assertProjectAccess(req.user, req.params.projectId);
    if (!(await canOverrideGate(req.user!, req.params.projectId))) throw new AppError('Gate override permission is required.', 403, 'FORBIDDEN');
    if (!LIFECYCLE_STAGES.includes(req.params.stage as any)) throw new AppError('Unknown lifecycle stage.', 400, 'VALIDATION_ERROR');
    const data = overrideSchema.parse(req.body);
    await assertActiveAssignee(data.ownerId, 'Override risk owner');
    const project = await prisma.$transaction((tx) => advanceStage(tx, {
      projectId: req.params.projectId, stage: req.params.stage, userId: req.user!.id,
      expectedVersion: data.expectedVersion, idempotencyKey: data.idempotencyKey || req.header('idempotency-key') || undefined,
      requestId: (req as any).requestId,
      override: { reason: data.reason, risk: data.risk, mitigation: data.mitigation, ownerId: data.ownerId, dueAt: data.dueAt },
    }));
    res.json(project);
  } catch (error) { next(error); }
});

export default router;
