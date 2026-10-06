import express from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { authenticate, authorize, restrictToOwnClient, AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { getPaginationParams, getPaginationResult } from '../utils/pagination';
import { logActivity } from '../utils/activity';
import { resolveStoredFile, removeStoredFile, validateStoredUpload } from '../utils/storage';
import { uploadLimiter } from '../middleware/rateLimits';
import { assertDeletionAllowed } from '../utils/operations';
import { getDocumentRetentionDays } from '../utils/retention';

const router = express.Router({ mergeParams: true });

router.get('/', authenticate, restrictToOwnClient, async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { includeDeleted } = req.query;
    const pagination = getPaginationParams(req.query);
    if (includeDeleted === 'true' && (req as AuthRequest).user?.role === 'CLIENT') {
      throw new AppError('Archived documents are available only to internal users.', 403, 'FORBIDDEN');
    }
    
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

router.post('/', authenticate, restrictToOwnClient, uploadLimiter, upload.single('file'), async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { consultationId, inquiryId, description } = req.body;
    const userId = (req as any).user.id;
    
    if (!req.file) {
      throw new AppError('No file uploaded.', 400);
    }

    validateStoredUpload(req.file);

    if (consultationId) {
      const consultation = await prisma.consultation.findFirst({
        where: { id: consultationId, clientId, deletedAt: null },
        select: { id: true },
      });
      if (!consultation) {
        throw new AppError('Consultation not found for this client.', 404);
      }
    }
    if (inquiryId) {
      const inquiry = await prisma.inquiry.findFirst({ where: { id: inquiryId, clientId } });
      if (!inquiry) throw new AppError('Inquiry not found for this client.', 404);
    }
    
    const document = await prisma.document.create({
      data: {
        clientId,
        consultationId: consultationId || null,
        inquiryId: inquiryId || null,
        userId,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        description: description || null,
        retentionUntil: new Date(Date.now() + getDocumentRetentionDays() * 86_400_000)
      }
    });

    logActivity(userId, 'CREATE', 'Document', document.id, { originalName: document.originalName });
    
    res.status(201).json(document);
  } catch (err) {
    removeStoredFile(req.file?.filename);
    next(err);
  }
});

router.get('/:id/download', authenticate, restrictToOwnClient, async (req, res, next) => {
  try {
    const { clientId, id } = req.params;
    
    const document = await prisma.document.findFirst({
      where: { id, clientId, deletedAt: null }
    });
    
    if (!document) {
      throw new AppError('Document not found.', 404);
    }
    
    const filePath = resolveStoredFile(document.filename);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Pragma', 'no-cache');
    res.download(filePath, document.originalName);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticate, restrictToOwnClient, async (req, res, next) => {
  try {
    const { clientId, id } = req.params;
    const { description } = z.object({ description: z.string().optional() }).parse(req.body);

    const doc = await prisma.document.findFirst({ where: { id, clientId, deletedAt: null } });
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

router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { clientId, id } = req.params;
    const doc = await prisma.document.findFirst({ where: { id, clientId, deletedAt: null } });
    if (!doc) throw new AppError('Document not found.', 404);
    await assertDeletionAllowed('Document', id, clientId);

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

router.post('/:id/restore', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { clientId, id } = req.params;
    const doc = await prisma.document.findFirst({ where: { id, clientId, deletedAt: { not: null } } });
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
