import express from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { authenticate, authorize, restrictToOwnClient } from '../middleware/auth';
import { approvalLimiter } from '../middleware/rateLimits';
import { writeAuditEvent } from '../workflow/audit';

const router = express.Router({ mergeParams: true });

const phaseSchema = z.object({
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']),
  startDate: z.string().datetime().optional().or(z.string().min(1).optional()),
  completedDate: z.string().datetime().optional().or(z.string().min(1).optional()),
  reason: z.string().trim().max(1000).optional(),
});

const verifyChecklistSchema = z.object({
  approved: z.boolean(),
  rejectionReason: z.string().optional()
});

const notifyUsers = async (data: {
  userIds: string[];
  type: string;
  message: string;
  clientId?: string;
  phaseId?: string;
  itemId?: string;
}) => {
  const uniqueUserIds = Array.from(new Set(data.userIds)).filter(Boolean);
  if (uniqueUserIds.length === 0) return;

  await prisma.notification.createMany({
    data: uniqueUserIds.map((userId) => ({
      userId,
      type: data.type,
      message: data.message,
      clientId: data.clientId || null,
      phaseId: data.phaseId || null,
      itemId: data.itemId || null
    }))
  });
};

// List all phases for a project
router.get('/', authenticate, restrictToOwnClient, async (req, res, next) => {
  try {
    const { clientId } = req.params;
    
    const project = await prisma.poolProject.findUnique({
      where: { clientId },
      include: {
        phases: {
          orderBy: { order: 'asc' },
          include: {
            checklistItems: {
              orderBy: { order: 'asc' }
            }
          }
        }
      }
    });
    
    if (!project) {
      throw new AppError('Pool project not found.', 404);
    }
    
    const completerIds = Array.from(new Set(project.phases.map((phase) => phase.completedById).filter((id): id is string => Boolean(id))));
    const completers = completerIds.length
      ? await prisma.user.findMany({ where: { id: { in: completerIds } }, select: { id: true, name: true } })
      : [];
    const completerById = new Map(completers.map((user) => [user.id, user]));
    const checklistCompleterIds = Array.from(new Set(project.phases.flatMap((phase) => phase.checklistItems.map((item) => item.completedBy).filter((id): id is string => Boolean(id)))));
    const checklistCompleters = checklistCompleterIds.length
      ? await prisma.user.findMany({ where: { id: { in: checklistCompleterIds } }, select: { id: true, name: true } })
      : [];
    const checklistCompleterById = new Map(checklistCompleters.map((user) => [user.id, user]));
    res.json(project.phases.map((phase) => ({
      ...phase,
      completedByUser: phase.completedById ? completerById.get(phase.completedById) || null : null,
      checklistItems: phase.checklistItems.map((item) => ({
        ...item,
        completedByUser: item.completedBy ? checklistCompleterById.get(item.completedBy) || null : null,
      })),
    })));
  } catch (err) {
    next(err);
  }
});

// Update a phase (ADMIN only)
router.put('/:phaseId', authenticate, authorize('ADMIN'), approvalLimiter, async (req, res, next) => {
  try {
    const { clientId, phaseId } = req.params;
    const data = phaseSchema.parse(req.body);
    
    const project = await prisma.poolProject.findUnique({
      where: { clientId },
      select: { id: true, currentPhase: true }
    });
    
    if (!project) {
      throw new AppError('Pool project not found.', 404);
    }
    
    const existingPhase = await prisma.projectPhase.findFirst({
      where: { id: phaseId, projectId: project.id },
      include: {
        checklistItems: { orderBy: { order: 'asc' } },
        completedBy: { select: { id: true, name: true } },
      },
    });

    if (!existingPhase) {
      throw new AppError('Phase not found for this project.', 404);
    }

    if (existingPhase.status === 'COMPLETED' && data.status !== 'COMPLETED' && !data.reason?.trim()) {
      throw new AppError('A reason is required to reopen a completed phase.', 400, 'VALIDATION_ERROR');
    }

    const requestedStartDate = data.startDate ? new Date(data.startDate) : undefined;
    const sameStartDate = requestedStartDate
      ? existingPhase.startDate?.getTime() === requestedStartDate.getTime()
      : data.status !== 'IN_PROGRESS' || Boolean(existingPhase.startDate);
    if (existingPhase.status === data.status && sameStartDate) {
      const { completedBy, ...unchanged } = existingPhase;
      return res.json({ ...unchanged, completedByUser: completedBy });
    }

    if (data.status === 'COMPLETED') {
      const blockers = existingPhase.checklistItems
        .filter((item) => !item.isCompleted || item.verificationStatus !== 'APPROVED')
        .map((item) => ({ id: item.id, description: item.description }));
      if (blockers.length > 0) {
        throw new AppError(
          'The phase cannot be completed until all checklist items are approved.',
          409,
          'GATE_BLOCKED',
          { blockers },
        );
      }
    }

    const phase = await prisma.$transaction(async (tx) => {
      const updated = await tx.projectPhase.update({
        where: { id: existingPhase.id },
        data: {
          status: data.status,
          startDate: data.startDate
            ? new Date(data.startDate)
            : data.status === 'IN_PROGRESS' && !existingPhase.startDate
              ? new Date()
              : undefined,
          completedDate: data.status === 'COMPLETED'
            ? (existingPhase.status === 'COMPLETED' ? existingPhase.completedDate : new Date())
            : null,
          completedById: data.status === 'COMPLETED'
            ? (existingPhase.status === 'COMPLETED' ? existingPhase.completedById : (req as any).user.id)
            : null,
        },
        include: {
          checklistItems: { orderBy: { order: 'asc' } },
          completedBy: { select: { id: true, name: true } },
        },
      });

      if (data.status === 'COMPLETED') {
        const nextPhase = await tx.projectPhase.findFirst({
          where: { projectId: project.id, order: existingPhase.order + 1 },
        });

        if (nextPhase) {
          await tx.projectPhase.update({
            where: { id: nextPhase.id },
            data: {
              status: 'IN_PROGRESS',
              startDate: nextPhase.startDate || new Date(),
            },
          });
        }

        await tx.poolProject.update({
          where: { id: project.id },
          data: {
            currentPhase: nextPhase?.order || existingPhase.order,
            status: nextPhase?.name || 'COMPLETED',
          },
        });
        if (nextPhase && nextPhase.status !== 'IN_PROGRESS') {
          await writeAuditEvent(tx, {
            userId: (req as any).user.id, action: 'PHASE_STARTED', entityType: 'ProjectPhase', entityId: nextPhase.id,
            projectId: project.id, requestId: (req as any).requestId,
            before: { status: nextPhase.status }, after: { status: 'IN_PROGRESS' },
          });
        }
      }

      const wasCompleted = existingPhase.status === 'COMPLETED';
      const isCompleted = data.status === 'COMPLETED';
      await writeAuditEvent(tx, {
        userId: (req as any).user.id,
        action: !wasCompleted && isCompleted
          ? 'PHASE_COMPLETED'
          : wasCompleted && !isCompleted
            ? 'PHASE_REOPENED'
            : existingPhase.status !== 'IN_PROGRESS' && updated.status === 'IN_PROGRESS'
              ? 'PHASE_STARTED'
              : 'PHASE_UPDATED',
        entityType: 'ProjectPhase', entityId: updated.id, projectId: project.id, requestId: (req as any).requestId,
        details: wasCompleted && !isCompleted ? { reason: data.reason } : undefined,
        before: { status: existingPhase.status, completedDate: existingPhase.completedDate, completedById: existingPhase.completedById },
        after: { status: updated.status, completedDate: updated.completedDate, completedById: updated.completedById },
      });

      return { ...updated, completedByUser: updated.completedBy };
    });

    res.json(phase);
  } catch (err) {
    next(err);
  }
});

// Toggle checklist item
router.put('/:phaseId/checklist/:itemId', authenticate, authorize('ADMIN'), approvalLimiter, async (req, res, next) => {
  try {
    const { clientId, phaseId, itemId } = req.params;
    const userId = (req as any).user.id;
    
    const { isCompleted, reason } = z.object({ isCompleted: z.boolean(), reason: z.string().trim().max(1000).optional() }).strict().parse(req.body);
    
    const project = await prisma.poolProject.findUnique({
      where: { clientId }
    });
    
    if (!project) {
      throw new AppError('Pool project not found.', 404);
    }
    
    const phase = await prisma.projectPhase.findFirst({
      where: { id: phaseId, projectId: project.id },
      select: { id: true },
    });
    if (!phase) throw new AppError('Phase not found for this project.', 404);

    const existingItem = await prisma.checklistItem.findFirst({
      where: { id: itemId, phaseId: phase.id },
    });
    if (!existingItem) throw new AppError('Checklist item not found for this phase.', 404);
    if (existingItem.isCompleted === isCompleted) return res.json(existingItem);
    if (existingItem.isCompleted && !isCompleted && !reason?.trim()) throw new AppError('A reason is required to reopen a completed checklist item.', 400, 'VALIDATION_ERROR');

    const item = await prisma.$transaction(async (tx) => {
      const timestamp = new Date();
      const updated = await tx.checklistItem.update({
        where: { id: existingItem.id },
        data: {
          isCompleted,
          completedAt: isCompleted ? timestamp : null,
          completedBy: isCompleted ? userId : null,
          verificationStatus: isCompleted ? 'APPROVED' : 'NOT_SUBMITTED',
          verifiedAt: isCompleted ? timestamp : null,
          verifiedBy: isCompleted ? userId : null,
          rejectionReason: null,
        },
      });
      await writeAuditEvent(tx, {
        userId, action: isCompleted ? 'CHECKLIST_ITEM_COMPLETED' : 'CHECKLIST_ITEM_REOPENED',
        entityType: 'ChecklistItem', entityId: updated.id, projectId: project.id, requestId: (req as any).requestId,
        details: !isCompleted ? { reason } : undefined,
        before: { isCompleted: existingItem.isCompleted, completedAt: existingItem.completedAt, completedBy: existingItem.completedBy },
        after: { isCompleted: updated.isCompleted, completedAt: updated.completedAt, completedBy: updated.completedBy },
      });
      return updated;
    });
    
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// Client submits a checklist item for admin verification
router.post('/:phaseId/checklist/:itemId/submit', authenticate, restrictToOwnClient, approvalLimiter, async (req, res, next) => {
  try {
    const { clientId, phaseId, itemId } = req.params;
    const userId = (req as any).user.id;

    const project = await prisma.poolProject.findUnique({
      where: { clientId },
      include: { client: true, phases: true }
    });

    if (!project || !project.phases.some((phase) => phase.id === phaseId)) {
      throw new AppError('Phase not found.', 404);
    }

    const existing = await prisma.checklistItem.findFirst({
      where: { id: itemId, phaseId }
    });

    if (!existing) {
      throw new AppError('Checklist item not found.', 404);
    }

    if (existing.isCompleted || existing.verificationStatus === 'APPROVED') {
      throw new AppError('Checklist item is already approved.', 409);
    }

    const item = await prisma.$transaction(async (tx) => {
      const updated = await tx.checklistItem.update({
        where: { id: itemId },
        data: {
          verificationStatus: 'SUBMITTED', submittedAt: new Date(), submittedBy: userId,
          verifiedAt: null, verifiedBy: null, rejectionReason: null,
          isCompleted: false, completedAt: null, completedBy: null,
        },
      });
      await writeAuditEvent(tx, {
        userId, action: 'CHECKLIST_ITEM_SUBMITTED', entityType: 'ChecklistItem', entityId: updated.id,
        projectId: project.id, requestId: (req as any).requestId,
        before: { verificationStatus: existing.verificationStatus, isCompleted: existing.isCompleted },
        after: { verificationStatus: updated.verificationStatus, isCompleted: updated.isCompleted },
      });
      return updated;
    });

    const reviewers = await prisma.user.findMany({
      where: { role: 'ADMIN', active: true },
      select: { id: true }
    });

    await notifyUsers({
      userIds: reviewers.map((user) => user.id),
      type: 'SUBMITTED',
      message: 'Checklist item submitted',
      clientId,
      phaseId,
      itemId
    });

    res.json(item);
  } catch (err) {
    next(err);
  }
});

// Administrator approves or rejects a submitted checklist item
router.put('/:phaseId/checklist/:itemId/verify', authenticate, authorize('ADMIN'), approvalLimiter, async (req, res, next) => {
  try {
    const { clientId, phaseId, itemId } = req.params;
    const userId = (req as any).user.id;
    const data = verifyChecklistSchema.parse(req.body);

    const project = await prisma.poolProject.findUnique({
      where: { clientId },
      include: { client: { include: { users: true } }, phases: true }
    });

    if (!project || !project.phases.some((phase) => phase.id === phaseId)) {
      throw new AppError('Phase not found.', 404);
    }

    const existing = await prisma.checklistItem.findFirst({
      where: { id: itemId, phaseId }
    });

    if (!existing) {
      throw new AppError('Checklist item not found.', 404);
    }

    if (existing.verificationStatus !== 'SUBMITTED') {
      throw new AppError('Only submitted checklist items can be verified.', 409, 'INVALID_TRANSITION');
    }

    const item = await prisma.$transaction(async (tx) => {
      const updated = await tx.checklistItem.update({
        where: { id: itemId },
        data: data.approved
        ? {
            verificationStatus: 'APPROVED',
            isCompleted: true,
            completedAt: new Date(),
            completedBy: userId,
            verifiedAt: new Date(),
            verifiedBy: userId,
            rejectionReason: null
          }
        : {
            verificationStatus: 'REJECTED',
            isCompleted: false,
            completedAt: null,
            completedBy: null,
            verifiedAt: new Date(),
            verifiedBy: userId,
            rejectionReason: data.rejectionReason || 'Not approved. Please revisit and resubmit.'
        },
      });
      await writeAuditEvent(tx, {
        userId, action: data.approved ? 'CHECKLIST_ITEM_COMPLETED' : 'CHECKLIST_ITEM_REJECTED',
        entityType: 'ChecklistItem', entityId: updated.id, projectId: project.id, requestId: (req as any).requestId,
        details: data.approved ? undefined : { rejectionReason: updated.rejectionReason },
        before: { verificationStatus: existing.verificationStatus, isCompleted: existing.isCompleted },
        after: { verificationStatus: updated.verificationStatus, isCompleted: updated.isCompleted, completedAt: updated.completedAt, completedBy: updated.completedBy },
      });
      return updated;
    });

    const clientUsers = project.client.users.filter((user) => user.role === 'CLIENT');

    await notifyUsers({
      userIds: clientUsers.map((user) => user.id),
      type: data.approved ? 'APPROVED' : 'REJECTED',
      message: data.approved ? 'Checklist item approved' : 'Checklist item needs revision',
      clientId,
      phaseId,
      itemId
    });

    res.json(item);
  } catch (err) {
    next(err);
  }
});

export default router;
