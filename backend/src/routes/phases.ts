import express from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { authenticate, authorize, restrictToOwnClient } from '../middleware/auth';

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

// Update a phase (ADMIN/STAFF only)
router.put('/:phaseId', authenticate, authorize('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { clientId, phaseId } = req.params;
    const data = phaseSchema.parse(req.body);
    
    const project = await prisma.poolProject.findUnique({
      where: { clientId }
    });
    
    if (!project) {
      throw new AppError('Pool project not found.', 404);
    }
    
    const phase = await prisma.projectPhase.update({
      where: { id: phaseId },
      data: {
        status: data.status,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        completedDate: data.completedDate ? new Date(data.completedDate) : undefined
      },
      include: {
        checklistItems: {
          orderBy: { order: 'asc' }
        }
      }
    });
    
    // Update project currentPhase if needed
    if (data.status === 'COMPLETED') {
      const completedPhase = await prisma.projectPhase.findUnique({
        where: { id: phaseId }
      });
      
      if (completedPhase && completedPhase.order > project.currentPhase) {
        await prisma.poolProject.update({
          where: { id: project.id },
          data: {
            currentPhase: completedPhase.order,
            status: completedPhase.name
          }
        });
      }
      
      // Auto-advance next phase to IN_PROGRESS
      const nextPhase = await prisma.projectPhase.findFirst({
        where: { projectId: project.id, order: completedPhase!.order + 1 }
      });
      
      if (nextPhase) {
        await prisma.projectPhase.update({
          where: { id: nextPhase.id },
          data: { status: 'IN_PROGRESS', startDate: new Date() }
        });
      }
    }
    
    res.json(phase);
  } catch (err) {
    next(err);
  }
});

// Toggle checklist item
router.put('/:phaseId/checklist/:itemId', authenticate, authorize('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { clientId, phaseId, itemId } = req.params;
    const userId = (req as any).user.id;
    
    const { isCompleted } = req.body;
    
    const project = await prisma.poolProject.findUnique({
      where: { clientId }
    });
    
    if (!project) {
      throw new AppError('Pool project not found.', 404);
    }
    
    const item = await prisma.checklistItem.update({
      where: { id: itemId },
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
    
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// Client submits a checklist item for admin verification
router.post('/:phaseId/checklist/:itemId/submit', authenticate, restrictToOwnClient, async (req, res, next) => {
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

    const phase = project.phases.find((phase) => phase.id === phaseId);
    const reviewers = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'STAFF'] } },
      select: { id: true }
    });

    await notifyUsers({
      userIds: reviewers.map((user) => user.id),
      type: 'SUBMITTED',
      message: `${project.client.name} submitted "${existing.description}" for review in ${phase?.displayName || 'a project phase'}.`,
      clientId,
      phaseId,
      itemId
    });

    res.json(item);
  } catch (err) {
    next(err);
  }
});

// Admin/staff approves or rejects a submitted checklist item
router.put('/:phaseId/checklist/:itemId/verify', authenticate, authorize('ADMIN', 'STAFF'), async (req, res, next) => {
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

    const phase = project.phases.find((phase) => phase.id === phaseId);
    const clientUsers = project.client.users.filter((user) => user.role === 'CLIENT');

    await notifyUsers({
      userIds: clientUsers.map((user) => user.id),
      type: data.approved ? 'APPROVED' : 'REJECTED',
      message: data.approved
        ? `"${existing.description}" was approved in ${phase?.displayName || 'your project phase'}.`
        : `"${existing.description}" needs revision in ${phase?.displayName || 'your project phase'}. ${data.rejectionReason || 'Please revisit and resubmit.'}`,
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
