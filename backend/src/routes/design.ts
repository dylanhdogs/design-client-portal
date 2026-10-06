import express from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { authenticate, loadClientData, AuthRequest } from '../middleware/auth';
import { approvalLimiter } from '../middleware/rateLimits';
import { assertProjectAccess, requireInternal } from '../workflow/authorization';
import { writeAuditEvent } from '../workflow/audit';

const router = express.Router();
router.use(authenticate, loadClientData);

const impactFields = {
  materialChange: z.boolean().default(false),
  costImpact: z.coerce.number().finite().nullable().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  scheduleImpact: z.string().trim().max(1000).nullable().optional(),
  changeSummary: z.string().trim().max(5000).nullable().optional(),
};
const designSchema = z.object({
  summary: z.string().trim().min(3).max(5000),
  requirements: z.string().trim().max(10000).nullable().optional(),
  siteInformation: z.string().trim().max(10000).nullable().optional(),
  ...impactFields,
});
const scopeSchema = z.object({
  inclusions: z.string().trim().min(3).max(15000),
  exclusions: z.string().trim().max(10000).nullable().optional(),
  allowances: z.string().trim().max(10000).nullable().optional(),
  estimateAmount: z.coerce.number().nonnegative().nullable().optional(),
  ...impactFields,
});
const approvalSchema = z.object({ comment: z.string().trim().max(5000).optional() });
const evidenceSchema = z.object({
  documentId: z.string().uuid(),
  designVersionId: z.string().uuid().nullable().optional(),
  scopeVersionId: z.string().uuid().nullable().optional(),
  workItemId: z.string().uuid().nullable().optional(),
  purpose: z.string().trim().min(3).max(500),
}).refine((value) => [value.designVersionId, value.scopeVersionId, value.workItemId].filter(Boolean).length === 1, {
  message: 'Evidence must link to exactly one design, scope, or work-item record.',
});

async function staleDesignGate(tx: any, projectId: string, materialChange: boolean) {
  if (!materialChange) return;
  const approvedCount = await tx.approval.count({
    where: { projectId, approvalType: { in: ['DESIGN_DIRECTION', 'SCOPE_AUTHORIZATION'] }, result: 'APPROVED' },
  });
  if (!approvedCount) return;
  await tx.projectGate.updateMany({
    where: { projectId, fromStage: 'DESIGN', toStage: 'COMPLIANCE' },
    data: { status: 'STALE', approvedAt: null, approvedBy: null, evaluationVersion: { increment: 1 } },
  });
  await tx.lifecycleStage.updateMany({ where: { projectId, stage: 'DESIGN' }, data: { status: 'IN_PROGRESS', completedAt: null } });
  await tx.poolProject.update({ where: { id: projectId }, data: { currentLifecycleStage: 'DESIGN', workflowVersion: { increment: 1 } } });
}

router.get('/projects/:projectId/design', async (req: AuthRequest, res, next) => {
  try {
    const project = await assertProjectAccess(req.user, req.params.projectId);
    const clientView = req.user?.role === 'CLIENT';
    const [inquiry, properties, designVersions, scopeVersions, questions, evidence, decisions] = await Promise.all([
      prisma.inquiry.findFirst({ where: { projectId: project.id }, orderBy: { createdAt: 'desc' } }),
      prisma.property.findMany({ where: { clientId: project.clientId } }),
      prisma.designVersion.findMany({
        where: { projectId: project.id, ...(clientView ? { status: { in: ['IN_REVIEW', 'APPROVED', 'SUPERSEDED'] } } : {}) },
        include: { creator: { select: { name: true } }, approver: { select: { name: true } }, evidenceLinks: { include: { document: true } } },
        orderBy: { versionNumber: 'desc' },
      }),
      prisma.scopeVersion.findMany({
        where: { projectId: project.id, ...(clientView ? { status: { in: ['IN_REVIEW', 'APPROVED', 'SUPERSEDED'] } } : {}) },
        include: { creator: { select: { name: true } }, approver: { select: { name: true } }, evidenceLinks: { include: { document: true } } },
        orderBy: { versionNumber: 'desc' },
      }),
      prisma.workItem.findMany({
        where: { projectId: project.id, stage: 'DESIGN', type: 'OUTSTANDING_QUESTION', deletedAt: null, ...(clientView ? { clientVisible: true } : {}) },
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.evidenceLink.findMany({ where: { projectId: project.id, stage: 'DESIGN', isCurrent: true }, include: { document: true } }),
      prisma.decision.findMany({ where: { projectId: project.id, stage: 'DESIGN', ...(clientView ? { decisionMakerId: req.user?.id } : {}) }, orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }] }),
    ]);
    let inquiryForDesign: Record<string, unknown> | null = null;
    if (inquiry) {
      const { discoveryData, siteAssessmentData, ...inquiryFields } = inquiry;
      let discovery = null;
      let siteSurvey = null;
      if (!clientView && discoveryData) {
        try { discovery = JSON.parse(discoveryData); } catch { discovery = null; }
      }
      if (!clientView && siteAssessmentData) {
        try { siteSurvey = JSON.parse(siteAssessmentData); } catch { siteSurvey = null; }
      }
      inquiryForDesign = { ...inquiryFields, discovery, siteAssessmentData: siteSurvey };
    }
    res.json({ project: { id: project.id, clientId: project.clientId, currentLifecycleStage: project.currentLifecycleStage }, client: { id: project.client.id, name: project.client.name }, inquiry: inquiryForDesign, properties, designVersions, scopeVersions, outstandingQuestions: questions, evidence, decisions });
  } catch (error) { next(error); }
});

router.post('/projects/:projectId/design-versions', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user); await assertProjectAccess(req.user, req.params.projectId);
    const data = designSchema.parse(req.body);
    const version = await prisma.$transaction(async (tx) => {
      const latest = await tx.designVersion.findFirst({ where: { projectId: req.params.projectId }, orderBy: { versionNumber: 'desc' } });
      if (data.materialChange) await tx.designVersion.updateMany({ where: { projectId: req.params.projectId, status: 'APPROVED' }, data: { status: 'SUPERSEDED' } });
      await staleDesignGate(tx, req.params.projectId, data.materialChange);
      const created = await tx.designVersion.create({ data: { ...data, projectId: req.params.projectId, versionNumber: (latest?.versionNumber || 0) + 1, createdBy: req.user!.id, organizationId: process.env.ORGANIZATION_ID || null } });
      await writeAuditEvent(tx, { userId: req.user!.id, action: 'CREATE', entityType: 'DesignVersion', entityId: created.id, requestId: (req as any).requestId, after: created });
      return created;
    });
    res.status(201).json(version);
  } catch (error) { next(error); }
});

router.post('/projects/:projectId/scope-versions', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user); await assertProjectAccess(req.user, req.params.projectId);
    const data = scopeSchema.parse(req.body);
    const version = await prisma.$transaction(async (tx) => {
      const latest = await tx.scopeVersion.findFirst({ where: { projectId: req.params.projectId }, orderBy: { versionNumber: 'desc' } });
      if (data.materialChange) await tx.scopeVersion.updateMany({ where: { projectId: req.params.projectId, status: 'APPROVED' }, data: { status: 'SUPERSEDED' } });
      await staleDesignGate(tx, req.params.projectId, data.materialChange);
      const created = await tx.scopeVersion.create({ data: { ...data, projectId: req.params.projectId, versionNumber: (latest?.versionNumber || 0) + 1, createdBy: req.user!.id, organizationId: process.env.ORGANIZATION_ID || null } });
      await writeAuditEvent(tx, { userId: req.user!.id, action: 'CREATE', entityType: 'ScopeVersion', entityId: created.id, requestId: (req as any).requestId, after: created });
      return created;
    });
    res.status(201).json(version);
  } catch (error) { next(error); }
});

async function submitVersion(req: AuthRequest, kind: 'design' | 'scope') {
  requireInternal(req.user);
  const model: any = kind === 'design' ? prisma.designVersion : prisma.scopeVersion;
  const before = await model.findUnique({ where: { id: req.params.id } });
  if (!before) throw new AppError(`${kind === 'design' ? 'Design' : 'Scope'} version not found.`, 404, 'NOT_FOUND');
  await assertProjectAccess(req.user, before.projectId);
  if (before.status === 'IN_REVIEW') return before;
  if (before.status !== 'DRAFT') throw new AppError('Only draft versions can be submitted.', 409, 'INVALID_TRANSITION');
  const version = await model.update({ where: { id: before.id }, data: { status: 'IN_REVIEW' } });
  await writeAuditEvent(prisma, { userId: req.user!.id, action: 'SUBMIT', entityType: kind === 'design' ? 'DesignVersion' : 'ScopeVersion', entityId: version.id, requestId: (req as any).requestId, before, after: version });
  return version;
}
router.post('/design-versions/:id/submit', async (req: AuthRequest, res, next) => { try { res.json(await submitVersion(req, 'design')); } catch (error) { next(error); } });
router.post('/scope-versions/:id/submit', async (req: AuthRequest, res, next) => { try { res.json(await submitVersion(req, 'scope')); } catch (error) { next(error); } });

async function decideVersion(req: AuthRequest, kind: 'design' | 'scope', result: 'APPROVED' | 'REJECTED') {
  const data = approvalSchema.parse(req.body);
  const model: any = kind === 'design' ? prisma.designVersion : prisma.scopeVersion;
  const before = await model.findUnique({ where: { id: req.params.id } });
  if (!before) throw new AppError(`${kind === 'design' ? 'Design' : 'Scope'} version not found.`, 404, 'NOT_FOUND');
  await assertProjectAccess(req.user, before.projectId);
  if (before.status === result) return before;
  if (before.status !== 'IN_REVIEW') throw new AppError('The version is not awaiting approval.', 409, 'INVALID_TRANSITION');
  if (result === 'REJECTED' && !data.comment) throw new AppError('A rejection reason is required.', 400, 'VALIDATION_ERROR');
  return prisma.$transaction(async (tx) => {
    const txModel: any = kind === 'design' ? tx.designVersion : tx.scopeVersion;
    if (result === 'APPROVED') await txModel.updateMany({ where: { projectId: before.projectId, status: 'APPROVED' }, data: { status: 'SUPERSEDED' } });
    const version = await txModel.update({ where: { id: before.id }, data: { status: result, approvedAt: result === 'APPROVED' ? new Date() : null, approvedBy: result === 'APPROVED' ? req.user!.id : null } });
    await tx.approval.create({ data: { projectId: before.projectId, ...(kind === 'design' ? { designVersionId: before.id } : { scopeVersionId: before.id }), approvalType: kind === 'design' ? 'DESIGN_DIRECTION' : 'SCOPE_AUTHORIZATION', approverId: req.user!.id, result, comment: data.comment } });
    await writeAuditEvent(tx, { userId: req.user!.id, action: result, entityType: kind === 'design' ? 'DesignVersion' : 'ScopeVersion', entityId: version.id, requestId: (req as any).requestId, before, after: version });
    return version;
  });
}
for (const kind of ['design', 'scope'] as const) {
  const route = kind === 'design' ? 'design-versions' : 'scope-versions';
  router.post(`/${route}/:id/approve`, approvalLimiter, async (req: AuthRequest, res, next) => { try { res.json(await decideVersion(req, kind, 'APPROVED')); } catch (error) { next(error); } });
  router.post(`/${route}/:id/reject`, approvalLimiter, async (req: AuthRequest, res, next) => { try { res.json(await decideVersion(req, kind, 'REJECTED')); } catch (error) { next(error); } });
}

router.post('/projects/:projectId/evidence', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user); const project = await assertProjectAccess(req.user, req.params.projectId);
    const data = evidenceSchema.parse(req.body);
    const document = await prisma.document.findFirst({ where: { id: data.documentId, clientId: project.clientId, deletedAt: null } });
    if (!document) throw new AppError('Evidence document does not belong to this project.', 400, 'VALIDATION_ERROR');
    if (data.designVersionId && !(await prisma.designVersion.findFirst({ where: { id: data.designVersionId, projectId: project.id } }))) throw new AppError('Design version does not belong to this project.', 400, 'VALIDATION_ERROR');
    if (data.scopeVersionId && !(await prisma.scopeVersion.findFirst({ where: { id: data.scopeVersionId, projectId: project.id } }))) throw new AppError('Scope version does not belong to this project.', 400, 'VALIDATION_ERROR');
    if (data.workItemId && !(await prisma.workItem.findFirst({ where: { id: data.workItemId, projectId: project.id, deletedAt: null } }))) throw new AppError('Work item does not belong to this project.', 400, 'VALIDATION_ERROR');
    const link = await prisma.evidenceLink.create({ data: { ...data, projectId: project.id, stage: 'DESIGN', createdBy: req.user!.id, organizationId: process.env.ORGANIZATION_ID || null } });
    await writeAuditEvent(prisma, { userId: req.user!.id, action: 'LINK', entityType: 'EvidenceLink', entityId: link.id, requestId: (req as any).requestId, after: link });
    res.status(201).json(link);
  } catch (error) { next(error); }
});

export default router;
