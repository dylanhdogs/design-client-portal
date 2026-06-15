import express from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { authenticate, authorize, restrictToOwnClient } from '../middleware/auth';

const router = express.Router({ mergeParams: true });

const noteSchema = z.object({
  content: z.string().min(1)
});

// Get all pool notes for a project
router.get('/', authenticate, restrictToOwnClient, async (req, res, next) => {
  try {
    const { clientId } = req.params;
    
    const project = await prisma.poolProject.findUnique({
      where: { clientId }
    });
    
    if (!project) {
      throw new AppError('Pool project not found.', 404);
    }
    
    const notes = await prisma.poolNote.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, role: true } } }
    });
    
    res.json(notes);
  } catch (err) {
    next(err);
  }
});

// Create a pool note (ADMIN, STAFF, or CLIENT own)
router.post('/', authenticate, restrictToOwnClient, async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const data = noteSchema.parse(req.body);
    const userId = (req as any).user.id;
    
    const project = await prisma.poolProject.findUnique({
      where: { clientId }
    });
    
    if (!project) {
      throw new AppError('Pool project not found.', 404);
    }
    
    const note = await prisma.poolNote.create({
      data: {
        projectId: project.id,
        userId,
        content: data.content
      },
      include: {
        user: { select: { name: true, role: true } }
      }
    });
    
    res.status(201).json(note);
  } catch (err) {
    next(err);
  }
});

// Delete a pool note (ADMIN only, or the creator)
router.delete('/:noteId', authenticate, async (req, res, next) => {
  try {
    const { noteId } = req.params;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;
    
    const note = await prisma.poolNote.findUnique({
      where: { id: noteId }
    });
    
    if (!note) {
      throw new AppError('Note not found.', 404);
    }
    
    if (userRole !== 'ADMIN' && note.userId !== userId) {
      throw new AppError('Not authorized to delete this note.', 403);
    }
    
    await prisma.poolNote.delete({ where: { id: noteId } });
    res.json({ message: 'Note deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

export default router;
