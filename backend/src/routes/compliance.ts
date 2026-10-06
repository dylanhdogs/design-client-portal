import express from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { authenticate, loadClientData, AuthRequest } from '../middleware/auth';
import { approvalLimiter } from '../middleware/rateLimits';
import { assertActiveAssignee, assertProjectAccess, requireInternal } from '../workflow/authorization';
import { writeAuditEvent } from '../workflow/audit';

const router = express.Router();
router.use(authenticate, loadClientData);
const categories = ['HOA', 'MUNICIPAL', 'PERMIT', 'ENGINEERING', 'ARCHITECTURAL', 'DRAINAGE', 'GRADING', 'UTILITIES', 'ACCESS', 'CONSTRUCTABILITY'] as const;
const statuses = ['NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'PENDING_EXTERNAL', 'APPROVED', 'REJECTED', 'BLOCKED', 'NOT_APPLICABLE'] as const;
const requirementSchema = z.object({
  propertyId: z.string().uuid().nullable().optional(), category: z.enum(categories),
  description: z.string().trim().min(3).max(5000), jurisdiction: z.string().trim().max(200).nullable().optional(),
  externalAgency: z.string().trim().max(200).nullable().optional(), required: z.boolean().default(true),
  ownerId: z.string().uuid().nullable().optional(), reviewerId: z.string().uuid().nullable().optional(),
  dueAt: z.coerce.date().nullable().optional(), evidenceRequired: z.boolean().default(false), clientVisible: z.boolean().default(false),
});
const exceptionSchema = z.object({ reason: z.string().trim().min(10).max(5000), risk: z.string().trim().min(3).max(5000), mitigation: z.string().trim().min(3).max(5000), ownerId: z.string().uuid(), dueAt: z.coerce.date() });

async function findRequirement(req: AuthRequest, id: string) {
  const requirement = await prisma.complianceRequirement.findUnique({
    where: { id }, include: { project: true, evidenceLinks: { where: { isCurrent: true }, include: { document: true } }, exceptions: true },
  });
  if (!requirement) throw new AppError('Compliance requirement not found.', 404, 'NOT_FOUND');
  await assertProjectAccess(req.user, requirement.projectId);
  if (req.user?.role === 'CLIENT' && !requirement.clientVisible) throw new AppError('Compliance requirement not found.', 404, 'NOT_FOUND');
  return requirement;
}

async function sendOverdueNotifications(projectId: string) {
  const overdue = await prisma.complianceRequirement.findMany({
    where: { projectId, required: true, dueAt: { lt: new Date() }, status: { notIn: ['APPROVED', 'NOT_APPLICABLE'] } },
  });
  for (const item of overdue) {
    for (const userId of [item.ownerId, item.reviewerId].filter(Boolean) as string[]) {
      const exists = await prisma.notification.findFirst({ where: { userId, type: 'COMPLIANCE_OVERDUE', itemId: item.id } });
      if (!exists) await prisma.notification.create({ data: { userId, type: 'COMPLIANCE_OVERDUE', message: `Overdue compliance item: ${item.description}`, itemId: item.id } });
    }
  }
}

router.get('/projects/:projectId/compliance', async (req: AuthRequest, res, next) => {
  try {
    const project = await assertProjectAccess(req.user, req.params.projectId);
    const clientView = req.user?.role === 'CLIENT';
    if (!clientView) await sendOverdueNotifications(project.id);
    const requirements = await prisma.complianceRequirement.findMany({
      where: { projectId: project.id, ...(clientView ? { clientVisible: true } : {}) },
      include: { property: true, owner: { select: { id: true, name: true } }, reviewer: { select: { id: true, name: true } }, evidenceLinks: { where: { isCurrent: true }, include: { document: true } }, exceptions: true },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
    });
    res.json({ project: { id: project.id, clientId: project.clientId, currentLifecycleStage: project.currentLifecycleStage }, client: { id: project.client.id, name: project.client.name }, requirements });
  } catch (error) { next(error); }
});

router.post('/projects/:projectId/compliance', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user); const project = await assertProjectAccess(req.user, req.params.projectId); const data = requirementSchema.parse(req.body);
    if (data.propertyId && !(await prisma.property.findFirst({ where: { id: data.propertyId, clientId: project.clientId } }))) throw new AppError('Property does not belong to this project.', 400, 'VALIDATION_ERROR');
    await assertActiveAssignee(data.ownerId, 'Compliance owner');
    await assertActiveAssignee(data.reviewerId, 'Compliance reviewer');
    const requirement = await prisma.complianceRequirement.create({ data: { ...data, projectId: project.id, organizationId: process.env.ORGANIZATION_ID || null } });
    await writeAuditEvent(prisma, { userId: req.user!.id, action: 'CREATE', entityType: 'ComplianceRequirement', entityId: requirement.id, requestId: (req as any).requestId, after: requirement });
    res.status(201).json(requirement);
  } catch (error) { next(error); }
});

router.put('/compliance/:id', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user); const before = await findRequirement(req, req.params.id);
    const data = requirementSchema.partial().extend({ status: z.enum(statuses).optional(), externalResponseAt: z.coerce.date().nullable().optional() }).parse(req.body);
    await assertActiveAssignee(data.ownerId, 'Compliance owner');
    await assertActiveAssignee(data.reviewerId, 'Compliance reviewer');
    if (data.status && ['APPROVED', 'REJECTED'].includes(data.status)) throw new AppError('Use the review endpoint for approval or rejection.', 409, 'INVALID_TRANSITION');
    const requirement = await prisma.complianceRequirement.update({ where: { id: before.id }, data });
    await writeAuditEvent(prisma, { userId: req.user!.id, action: 'UPDATE', entityType: 'ComplianceRequirement', entityId: requirement.id, requestId: (req as any).requestId, before, after: requirement });
    res.json(requirement);
  } catch (error) { next(error); }
});

router.post('/compliance/:id/submit', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user); const before = await findRequirement(req, req.params.id);
    if (!['NOT_STARTED', 'IN_PROGRESS', 'REJECTED', 'BLOCKED'].includes(before.status)) throw new AppError('Requirement cannot be submitted from its current status.', 409, 'INVALID_TRANSITION');
    if (before.evidenceRequired && !before.evidenceLinks.length) throw new AppError('Required evidence is missing.', 409, 'GATE_BLOCKED', { blockers: [{ type: 'EVIDENCE', id: before.id, title: 'Attach required evidence.' }] });
    const requirement = await prisma.complianceRequirement.update({ where: { id: before.id }, data: { status: before.externalAgency ? 'PENDING_EXTERNAL' : 'SUBMITTED', submittedAt: new Date(), rejectionReason: null } });
    await writeAuditEvent(prisma, { userId: req.user!.id, action: 'SUBMIT', entityType: 'ComplianceRequirement', entityId: requirement.id, requestId: (req as any).requestId, before, after: requirement });
    res.json(requirement);
  } catch (error) { next(error); }
});

router.post('/compliance/:id/review', approvalLimiter, async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user); const before = await findRequirement(req, req.params.id);
    const data = z.object({ approved: z.boolean(), reason: z.string().trim().max(5000).optional() }).parse(req.body);
    if (!['SUBMITTED', 'PENDING_EXTERNAL'].includes(before.status)) throw new AppError('Requirement is not ready for review.', 409, 'INVALID_TRANSITION');
    if (before.reviewerId && before.reviewerId !== req.user!.id && req.user!.role !== 'ADMIN') throw new AppError('Only the assigned reviewer can review this requirement.', 403, 'FORBIDDEN');
    if (!data.approved && !data.reason) throw new AppError('A rejection reason is required.', 400, 'VALIDATION_ERROR');
    const requirement = await prisma.complianceRequirement.update({ where: { id: before.id }, data: { status: data.approved ? 'APPROVED' : 'REJECTED', rejectionReason: data.approved ? null : data.reason, externalResponseAt: before.externalResponseAt || (before.externalAgency ? new Date() : null) } });
    await writeAuditEvent(prisma, { userId: req.user!.id, action: data.approved ? 'APPROVE' : 'REJECT', entityType: 'ComplianceRequirement', entityId: requirement.id, requestId: (req as any).requestId, before, after: requirement });
    res.json(requirement);
  } catch (error) { next(error); }
});

router.post('/compliance/:id/evidence', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user); const requirement = await findRequirement(req, req.params.id);
    const data = z.object({ documentId: z.string().uuid(), purpose: z.string().trim().min(3).max(500) }).parse(req.body);
    const document = await prisma.document.findFirst({ where: { id: data.documentId, clientId: requirement.project.clientId, deletedAt: null } });
    if (!document) throw new AppError('Evidence document does not belong to this project.', 400, 'VALIDATION_ERROR');
    const link = await prisma.evidenceLink.create({ data: { documentId: data.documentId, projectId: requirement.projectId, requirementId: requirement.id, stage: 'COMPLIANCE', purpose: data.purpose, createdBy: req.user!.id, organizationId: process.env.ORGANIZATION_ID || null } });
    res.status(201).json(link);
  } catch (error) { next(error); }
});

router.post('/compliance/:id/exceptions', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user); const requirement = await findRequirement(req, req.params.id); const data = exceptionSchema.parse(req.body);
    await assertActiveAssignee(data.ownerId, 'Compliance exception owner');
    const exception = await prisma.complianceException.create({ data: { ...data, projectId: requirement.projectId, requirementId: requirement.id, organizationId: process.env.ORGANIZATION_ID || null } });
    await writeAuditEvent(prisma, { userId: req.user!.id, action: 'CREATE', entityType: 'ComplianceException', entityId: exception.id, requestId: (req as any).requestId, after: exception });
    res.status(201).json(exception);
  } catch (error) { next(error); }
});

router.post('/compliance-exceptions/:id/approve', approvalLimiter, async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user); const exception = await prisma.complianceException.findUnique({ where: { id: req.params.id } });
    if (!exception) throw new AppError('Compliance exception not found.', 404, 'NOT_FOUND');
    await assertProjectAccess(req.user, exception.projectId);
    if (req.user!.role !== 'ADMIN') throw new AppError('Leadership approval is required for compliance exceptions.', 403, 'FORBIDDEN');
    const updated = await prisma.complianceException.update({ where: { id: exception.id }, data: { status: 'APPROVED', approvedBy: req.user!.id, approvedAt: new Date() } });
    await writeAuditEvent(prisma, { userId: req.user!.id, action: 'APPROVE', entityType: 'ComplianceException', entityId: updated.id, requestId: (req as any).requestId, before: exception, after: updated });
    res.json(updated);
  } catch (error) { next(error); }
});

export default router;
