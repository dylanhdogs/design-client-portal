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
        completedBy: isCompleted ? userId : null
      }
    });
    
    res.json(item);
  } catch (err) {
    next(err);
  }
});

export default router;
