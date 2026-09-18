import express from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { authenticate, authorize, restrictToOwnClient } from '../middleware/auth';
import { approvalLimiter } from '../middleware/rateLimits';
import { logActivity } from '../utils/activity';

const router = express.Router({ mergeParams: true });

const phaseSchema = z.object({
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']),
  startDate: z.string().datetime().optional().or(z.string().min(1).optional()),
  completedDate: z.string().datetime().optional().or(z.string().min(1).optional())
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
    
    res.json(project.phases);
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
      include: { checklistItems: { orderBy: { order: 'asc' } } },
    });

    if (!existingPhase) {
      throw new AppError('Phase not found for this project.', 404);
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
            ? (data.completedDate ? new Date(data.completedDate) : new Date())
            : null,
        },
        include: { checklistItems: { orderBy: { order: 'asc' } } },
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
      }

      return updated;
    });

    await logActivity((req as any).user.id, 'UPDATE', 'ProjectPhase', phase.id, {
      previousStatus: existingPhase.status,
      status: phase.status,
      projectId: project.id,
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
    
    const { isCompleted } = z.object({ isCompleted: z.boolean() }).parse(req.body);
    
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

    const item = await prisma.checklistItem.update({
      where: { id: existingItem.id },
      data: {
        isCompleted: !!isCompleted,
        completedAt: isCompleted ? new Date() : null,
        completedBy: isCompleted ? userId : null,
        verificationStatus: isCompleted ? 'APPROVED' : 'NOT_SUBMITTED',
        verifiedAt: isCompleted ? new Date() : null,
        verifiedBy: isCompleted ? userId : null,
        rejectionReason: null
      }
    });

    await logActivity(userId, 'UPDATE', 'ChecklistItem', item.id, {
      phaseId,
      projectId: project.id,
      isCompleted,
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

    const item = await prisma.checklistItem.update({
      where: { id: itemId },
      data: {
        verificationStatus: 'SUBMITTED',
        submittedAt: new Date(),
        submittedBy: userId,
        verifiedAt: null,
        verifiedBy: null,
        rejectionReason: null,
        isCompleted: false,
        completedAt: null,
        completedBy: null
      }
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

    await logActivity(userId, 'SUBMIT', 'ChecklistItem', item.id, { phaseId, projectId: project.id });

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

    const item = await prisma.checklistItem.update({
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
          }
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

    await logActivity(userId, 'VERIFY', 'ChecklistItem', item.id, {
      phaseId,
      projectId: project.id,
      approved: data.approved,
      rejectionReason: item.rejectionReason,
    });

    res.json(item);
  } catch (err) {
    next(err);
  }
});

export default router;
