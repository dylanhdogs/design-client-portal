import express from 'express';
import path from 'path';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { authenticate, authorize, restrictToOwnClient } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { getPaginationParams, getPaginationResult } from '../utils/pagination';

const router = express.Router({ mergeParams: true });

router.get('/', authenticate, restrictToOwnClient, async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const pagination = getPaginationParams(req.query);
    
    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
        include: { user: { select: { name: true } }, consultation: { select: { title: true } } }
      }),
      prisma.document.count({ where: { clientId } })
    ]);
    
    res.json({ data: documents, pagination: getPaginationResult(total, pagination) });
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, restrictToOwnClient, upload.single('file'), async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { consultationId, description } = req.body;
    const userId = (req as any).user.id;
    
    if (!req.file) {
      throw new AppError('No file uploaded.', 400);
    }
    
    const document = await prisma.document.create({
      data: {
        clientId,
        consultationId: consultationId || null,
        userId,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        description: description || null
      }
    });
    
    res.status(201).json(document);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/download', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const document = await prisma.document.findUnique({
      where: { id }
    });
    
    if (!document) {
      throw new AppError('Document not found.', 404);
    }
    
    const filePath = path.join(process.cwd(), 'uploads', document.filename);
    res.download(filePath, document.originalName);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, authorize('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.document.delete({ where: { id } });
    res.json({ message: 'Document deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

export default router;
