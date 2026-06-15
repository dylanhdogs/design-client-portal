import express from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// GET /api/my-project - for CLIENT users to get their own project
router.get('/', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { client: { include: { poolProject: true } } }
    });
    
    if (!user || !user.clientId || !user.client?.poolProject) {
      throw new AppError('No pool project found.', 404);
    }
    
    const project = await prisma.poolProject.findUnique({
      where: { id: user.client.poolProject.id },
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
    
    res.json(project);
  } catch (err) {
    next(err);
  }
});

export default router;
