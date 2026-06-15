import express from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { authenticate, authorize, restrictToOwnClient } from '../middleware/auth';
import { createPoolProjectWithPhases } from '../utils/poolProject';

const router = express.Router({ mergeParams: true });

const projectSchema = z.object({
  poolType: z.string().optional(),
  poolShape: z.string().optional(),
  dimensions: z.string().optional(),
  estimatedBudget: z.string().optional(),
  notes: z.string().optional()
});

const updateProjectSchema = z.object({
  poolType: z.string().optional(),
  poolShape: z.string().optional(),
  dimensions: z.string().optional(),
  estimatedBudget: z.string().optional(),
  notes: z.string().optional(),
  currentPhase: z.number().int().min(1).max(6).optional(),
  status: z.string().optional()
});

// Create pool project for a client (ADMIN/STAFF only)
router.post('/', authenticate, authorize('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const data = projectSchema.parse(req.body);
    
    // Check if client already has a project
    const existing = await prisma.poolProject.findUnique({
      where: { clientId }
    });
    
    if (existing) {
      throw new AppError('Client already has a pool project.', 409);
    }
    
    const project = await createPoolProjectWithPhases(clientId, data);
    
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
});

// Get pool project for a client (ADMIN/STAFF or CLIENT own)
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
        },
        poolNotes: {
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { name: true, role: true } } }
        }
      }
    });
    
    if (!project) {
      throw new AppError('Pool project not found.', 404);
    }
    
    res.json(project);
  } catch (err) {
    next(err);
  }
});

// Update pool project (ADMIN/STAFF only)
router.put('/', authenticate, authorize('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const data = updateProjectSchema.parse(req.body);
    
    const project = await prisma.poolProject.update({
      where: { clientId },
      data: {
        ...data,
        poolType: data.poolType || null,
        poolShape: data.poolShape || null,
        dimensions: data.dimensions || null,
        estimatedBudget: data.estimatedBudget || null,
        notes: data.notes || null
      }
    });
    
    res.json(project);
  } catch (err) {
    next(err);
  }
});

// Delete pool project (ADMIN only)
router.delete('/', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { clientId } = req.params;
    await prisma.poolProject.delete({ where: { clientId } });
    res.json({ message: 'Pool project deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

export default router;
