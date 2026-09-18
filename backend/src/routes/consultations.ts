import express from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { assertDeletionAllowed } from '../utils/operations';
import { authenticate, authorize, restrictToOwnClient, AuthRequest } from '../middleware/auth';
import { getPaginationParams, getPaginationResult } from '../utils/pagination';
import { logActivity } from '../utils/activity';

const router = express.Router({ mergeParams: true });

const consultationSchema = z.object({
  title: z.string().min(1),
  date: z.string().datetime().or(z.string().min(1)),
  notes: z.string().optional(),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']).default('SCHEDULED'),
  inquiryId: z.string().uuid().nullable().optional(),
  outcome: z.string().trim().max(5000).nullable().optional()
});

router.get('/', authenticate, restrictToOwnClient, async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { includeDeleted } = req.query;
    const pagination = getPaginationParams(req.query);
    if (includeDeleted === 'true' && (req as AuthRequest).user?.role === 'CLIENT') {
      throw new AppError('Archived consultations are available only to internal users.', 403, 'FORBIDDEN');
    }
    
    const where: any = { clientId };
    if (includeDeleted !== 'true') where.deletedAt = null;
    
    const [consultations, total] = await Promise.all([
      prisma.consultation.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
        include: { user: { select: { name: true } } }
      }),
      prisma.consultation.count({ where })
    ]);
    
    res.json({ data: consultations, pagination: getPaginationResult(total, pagination) });
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const data = consultationSchema.parse(req.body);
    const userId = (req as any).user.id;
    if (data.inquiryId) {
      const inquiry = await prisma.inquiry.findFirst({ where: { id: data.inquiryId, clientId } });
      if (!inquiry) throw new AppError('Inquiry not found for this client.', 404);
    }
    
    const consultation = await prisma.consultation.create({
      data: {
        clientId,
        userId,
        title: data.title,
        date: new Date(data.date),
        notes: data.notes || null,
        status: data.status,
        inquiryId: data.inquiryId,
        outcome: data.outcome
      }
    });

    logActivity(userId, 'CREATE', 'Consultation', consultation.id, { title: consultation.title });
    
    res.status(201).json(consultation);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { clientId, id } = req.params;
    const data = consultationSchema.partial().parse(req.body);

    const existing = await prisma.consultation.findFirst({ where: { id, clientId, deletedAt: null } });
    if (!existing) throw new AppError('Consultation not found.', 404);
    if (data.inquiryId) {
      const inquiry = await prisma.inquiry.findFirst({ where: { id: data.inquiryId, clientId } });
      if (!inquiry) throw new AppError('Inquiry not found for this client.', 404);
    }
    
    const consultation = await prisma.consultation.update({
      where: { id },
      data: {
        ...data,
        date: data.date ? new Date(data.date) : undefined,
        notes: data.notes || null,
        outcome: data.outcome === undefined ? undefined : data.outcome || null
      }
    });

    logActivity((req as any).user.id, 'UPDATE', 'Consultation', id, { title: consultation.title });
    
    res.json(consultation);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { clientId, id } = req.params;
    const cons = await prisma.consultation.findFirst({ where: { id, clientId, deletedAt: null } });
    if (!cons) throw new AppError('Consultation not found.', 404);
    await assertDeletionAllowed('Consultation', id, clientId);

    await prisma.consultation.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    logActivity((req as any).user.id, 'DELETE', 'Consultation', id);
    res.json({ message: 'Consultation deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/restore', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { clientId, id } = req.params;
    const cons = await prisma.consultation.findFirst({ where: { id, clientId, deletedAt: { not: null } } });
    if (!cons) throw new AppError('Deleted consultation not found.', 404);

    await prisma.consultation.update({
      where: { id },
      data: { deletedAt: null }
    });

    logActivity((req as any).user.id, 'RESTORE', 'Consultation', id);
    res.json({ message: 'Consultation restored successfully.' });
  } catch (err) {
    next(err);
  }
});

export default router;
