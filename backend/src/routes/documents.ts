import fs from 'fs';
import express from 'express';
import path from 'path';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { authenticate, authorize, restrictToOwnClient } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { getPaginationParams, getPaginationResult } from '../utils/pagination';
import { logActivity } from '../utils/activity';

const router = express.Router({ mergeParams: true });

router.get('/', authenticate, restrictToOwnClient, async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { includeDeleted } = req.query;
    const pagination = getPaginationParams(req.query);
    
    const where: any = { clientId };
    if (includeDeleted !== 'true') where.deletedAt = null;
    
    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
        include: { user: { select: { name: true } }, consultation: { select: { title: true } } }
      }),
      prisma.document.count({ where })
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

    logActivity(userId, 'CREATE', 'Document', document.id, { originalName: document.originalName });
    
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

router.put('/:id', authenticate, restrictToOwnClient, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { description } = z.object({ description: z.string().optional() }).parse(req.body);

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) throw new AppError('Document not found.', 404);

    const updated = await prisma.document.update({
      where: { id },
      data: { description: description || null }
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, authorize('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await prisma.document.findFirst({ where: { id, deletedAt: null } });
    if (!doc) throw new AppError('Document not found.', 404);

    await prisma.document.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    logActivity((req as any).user.id, 'DELETE', 'Document', id);
    res.json({ message: 'Document deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/restore', authenticate, authorize('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await prisma.document.findFirst({ where: { id, deletedAt: { not: null } } });
    if (!doc) throw new AppError('Deleted document not found.', 404);

    await prisma.document.update({
      where: { id },
      data: { deletedAt: null }
    });

    logActivity((req as any).user.id, 'RESTORE', 'Document', id);
    res.json({ message: 'Document restored successfully.' });
  } catch (err) {
    next(err);
  }
});

export default router;
