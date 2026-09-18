import { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../utils/errors';
import { LIFECYCLE_STAGES, STAGE_TRANSITIONS } from './constants';
import { writeAuditEvent } from './audit';
import { calculateReadiness, ensureReadinessItems } from './preconstruction';

type DbClient = PrismaClient | Prisma.TransactionClient;

const LEGACY_PHASES_BY_COMPLETED_STAGE: Record<string, string[]> = {
  INQUIRY: ['INTAKE'],
  DESIGN: ['SITE_EVALUATION', 'DESIGN'],
  COMPLIANCE: ['CONTRACT'],
  PRE_CONSTRUCTION: ['PROPOSAL', 'PRE_CONSTRUCTION'],
  PROCUREMENT: [],
};

const LEGACY_PHASE_NUMBER_BY_STAGE: Record<string, number> = {
  INQUIRY: 1,
  DESIGN: 3,
  COMPLIANCE: 5,
  PRE_CONSTRUCTION: 6,
  PROCUREMENT: 6,
};

export async function synchronizeLegacyPhases(db: DbClient, projectId: string, completedStage: string, userId: string, at: Date) {
  const names = LEGACY_PHASES_BY_COMPLETED_STAGE[completedStage] || [];
  if (names.length) {
    const phases = await db.projectPhase.findMany({ where: { projectId, name: { in: names } }, select: { id: true } });
    for (const phase of phases) {
      await db.projectPhase.update({ where: { id: phase.id }, data: { status: 'COMPLETED', completedDate: at } });
      await db.checklistItem.updateMany({
        where: { phaseId: phase.id },
        data: { isCompleted: true, completedAt: at, completedBy: userId, verificationStatus: 'VERIFIED', submittedAt: at, submittedBy: userId, verifiedAt: at, verifiedBy: userId },
      });
    }
  }
  const phaseNumber = LEGACY_PHASE_NUMBER_BY_STAGE[completedStage];
  if (phaseNumber) await db.poolProject.update({ where: { id: projectId }, data: { currentPhase: phaseNumber } });
}

export interface GateBlocker {
  type: 'WORK_ITEM' | 'DECISION' | 'STAGE' | 'READINESS_ITEM' | 'EVIDENCE' | 'ASSIGNMENT' | 'REGISTER';
  id: string;
  title: string;
  status: string;
}

export async function evaluateGate(db: DbClient, projectId: string, fromStage: string) {
  const gate = await db.projectGate.findFirst({ where: { projectId, fromStage } });
  if (!gate) throw new AppError('Project gate not found.', 404, 'NOT_FOUND');

  const [stage, workItems, decisions, approvedDesign, approvedScope, complianceRequirements, approvedReadinessReview, readiness] = await Promise.all([
    db.lifecycleStage.findUnique({ where: { projectId_stage: { projectId, stage: fromStage } } }),
    db.workItem.findMany({
      where: {
        projectId, stage: fromStage, deletedAt: null,
        status: { notIn: ['VERIFIED', 'CLOSED', 'CANCELLED'] },
      },
      select: { id: true, title: true, status: true },
    }),
    db.decision.findMany({
      where: {
        projectId, stage: fromStage,
        status: { notIn: ['APPROVED', 'CANCELLED'] },
      },
      select: { id: true, title: true, status: true },
    }),
    fromStage === 'DESIGN' ? db.designVersion.findFirst({ where: { projectId, status: 'APPROVED' }, select: { id: true } }) : Promise.resolve({ id: 'not-required' }),
    fromStage === 'DESIGN' ? db.scopeVersion.findFirst({ where: { projectId, status: 'APPROVED' }, select: { id: true } }) : Promise.resolve({ id: 'not-required' }),
    fromStage === 'COMPLIANCE' ? db.complianceRequirement.findMany({ where: { projectId, required: true }, include: { evidenceLinks: { where: { isCurrent: true } }, exceptions: { where: { status: 'APPROVED', dueAt: { gte: new Date() } } } } }) : Promise.resolve([]),
    fromStage === 'PRE_CONSTRUCTION' ? db.readinessReview.findFirst({ where: { projectId, status: 'APPROVED' }, orderBy: { reviewedAt: 'desc' }, select: { id: true } }) : Promise.resolve({ id: 'not-required' }),
    fromStage === 'PRE_CONSTRUCTION' ? calculateReadiness(db, projectId) : Promise.resolve(null),
  ]);

  const blockers: GateBlocker[] = [
    ...workItems.map((item) => ({ type: 'WORK_ITEM' as const, ...item })),
    ...decisions.map((decision) => ({ type: 'DECISION' as const, ...decision })),
  ];
  if (fromStage === 'DESIGN' && !approvedDesign) blockers.push({ type: 'STAGE', id: 'approved-design', title: 'An approved design version is required', status: 'MISSING' });
  if (fromStage === 'DESIGN' && !approvedScope) blockers.push({ type: 'STAGE', id: 'approved-scope', title: 'An approved scope version is required', status: 'MISSING' });
  if (fromStage === 'COMPLIANCE') {
    if (!complianceRequirements.length) blockers.push({ type: 'REGISTER', id: 'compliance-requirements', title: 'At least one required compliance requirement must be recorded, or explicitly marked not applicable', status: 'MISSING' });
    for (const requirement of complianceRequirements) {
      const excepted = requirement.exceptions.length > 0;
      if (!['APPROVED', 'NOT_APPLICABLE'].includes(requirement.status) && !excepted) blockers.push({ type: 'STAGE', id: requirement.id, title: requirement.description, status: requirement.status });
      else if (requirement.evidenceRequired && !requirement.evidenceLinks.length && !excepted) blockers.push({ type: 'STAGE', id: requirement.id, title: `${requirement.description} requires evidence`, status: 'EVIDENCE_MISSING' });
    }
  }
  if (fromStage === 'PRE_CONSTRUCTION') {
    if (!approvedReadinessReview) blockers.push({ type: 'READINESS_ITEM', id: 'approved-readiness-review', title: 'An approved Construction Readiness Review is required', status: 'MISSING' });
    for (const blocker of readiness?.blockers || []) blockers.push(blocker as GateBlocker);
  }
  if (!stage || ['BLOCKED', 'REJECTED', 'WAITING_ON_CLIENT', 'WAITING_ON_EXTERNAL'].includes(stage.status)) {
    blockers.push({
      type: 'STAGE',
      id: stage?.id || fromStage,
      title: `${fromStage.replace(/_/g, ' ')} stage is not ready`,
      status: stage?.status || 'MISSING',
    });
  }

  return { gate, blockers, ready: blockers.length === 0 };
}

export async function advanceStage(db: Prisma.TransactionClient, input: {
  projectId: string;
  stage: string;
  userId: string;
  expectedVersion: number;
  idempotencyKey?: string;
  requestId?: string;
  override?: { reason: string; risk: string; mitigation: string; ownerId: string; dueAt: Date };
}) {
  const transition = STAGE_TRANSITIONS.find((item) => item.fromStage === input.stage);
  if (!transition) throw new AppError('This lifecycle stage has no next stage.', 409, 'INVALID_TRANSITION');

  const project = await db.poolProject.findUnique({ where: { id: input.projectId } });
  if (!project) throw new AppError('Project not found.', 404, 'NOT_FOUND');
  if (project.currentLifecycleStage !== input.stage) {
    if (project.currentLifecycleStage === transition.toStage) return { project, idempotent: true };
    throw new AppError('The project is not currently in the requested stage.', 409, 'INVALID_TRANSITION');
  }
  if (project.workflowVersion !== input.expectedVersion) {
    throw new AppError('The project changed while this request was being processed.', 409, 'CONFLICT', {
      currentVersion: project.workflowVersion,
    });
  }

  const evaluation = await evaluateGate(db, input.projectId, input.stage);
  if (!input.override && evaluation.blockers.length > 0) {
    await db.projectGate.update({
      where: { id: evaluation.gate.id },
      data: {
        status: 'BLOCKED',
        blockerCount: evaluation.blockers.length,
        requiredItems: JSON.stringify(evaluation.blockers),
      },
    });
    throw new AppError(
      'The project cannot advance until required conditions are resolved.',
      409,
      'GATE_BLOCKED',
      { blockers: evaluation.blockers },
    );
  }

  const now = new Date();
  const gateStatus = input.override ? 'OVERRIDDEN' : 'APPROVED';
  const updated = await db.poolProject.updateMany({
    where: { id: input.projectId, workflowVersion: input.expectedVersion },
    data: {
      currentLifecycleStage: transition.toStage,
      workflowVersion: { increment: 1 },
    },
  });
  if (updated.count !== 1) throw new AppError('Concurrent stage advancement detected.', 409, 'CONFLICT');

  await db.lifecycleStage.update({
    where: { projectId_stage: { projectId: input.projectId, stage: input.stage } },
    data: { status: 'APPROVED', completedAt: now },
  });
  await synchronizeLegacyPhases(db, input.projectId, input.stage, input.userId, now);
  if (transition.toStage === 'PRE_CONSTRUCTION') await ensureReadinessItems(db, input.projectId);
  if (transition.toStage === 'PROCUREMENT') {
    await db.projectGate.upsert({
      where: { projectId_fromStage_toStage: { projectId: input.projectId, fromStage: 'PROCUREMENT', toStage: 'FIELD_EXECUTION' } },
      update: {},
      create: { projectId: input.projectId, fromStage: 'PROCUREMENT', toStage: 'FIELD_EXECUTION', status: 'PENDING', organizationId: process.env.ORGANIZATION_ID || null },
    });
  }
  await db.lifecycleStage.update({
    where: { projectId_stage: { projectId: input.projectId, stage: transition.toStage } },
    data: { status: 'IN_PROGRESS', startedAt: now },
  });
  const gate = await db.projectGate.update({
    where: { id: evaluation.gate.id },
    data: {
      status: gateStatus,
      blockerCount: evaluation.blockers.length,
      requiredItems: JSON.stringify(evaluation.blockers),
      approvedBy: input.userId,
      approvedAt: now,
      overrideReason: input.override?.reason || null,
      overrideRisk: input.override?.risk || null,
      overrideMitigation: input.override?.mitigation || null,
      overrideOwnerId: input.override?.ownerId || null,
      overrideDueAt: input.override?.dueAt || null,
    },
  });
  await db.approval.create({
    data: {
      projectId: input.projectId,
      gateId: gate.id,
      approvalType: 'STAGE_GATE',
      approverId: input.userId,
      result: input.override ? 'OVERRIDDEN' : 'APPROVED',
      comment: input.override?.reason || null,
      idempotencyKey: input.idempotencyKey || null,
    },
  });
  await writeAuditEvent(db, {
    userId: input.userId,
    action: input.override ? 'OVERRIDE' : 'ADVANCE',
    entityType: 'ProjectGate',
    entityId: gate.id,
    requestId: input.requestId,
    before: { stage: input.stage, version: input.expectedVersion, blockers: evaluation.blockers },
    after: { stage: transition.toStage, version: input.expectedVersion + 1, gateStatus },
  });

  return db.poolProject.findUnique({ where: { id: input.projectId } });
}
