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
  activityType: z.enum(['SITE_MEETING', 'PHONE_CALL', 'VIDEO_CALL', 'HOA_ARC', 'MUNICIPAL', 'OTHER']).default('SITE_MEETING'),
  subject: z.string().trim().max(500).nullable().optional(),
  date: z.string().datetime().or(z.string().min(1)),
  endAt: z.string().datetime().or(z.string().min(1)).nullable().optional(),
  notes: z.string().optional(),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']).default('SCHEDULED'),
  inquiryId: z.string().uuid().nullable().optional(),
  outcome: z.string().trim().max(5000).nullable().optional(),
  participants: z.string().trim().max(2000).nullable().optional(),
  internalFollowers: z.string().trim().max(2000).nullable().optional(),
  nextAction: z.string().trim().max(1000).nullable().optional(),
  nextActionDueAt: z.string().datetime().or(z.string().min(1)).nullable().optional(),
  cancellationReason: z.string().trim().max(1000).nullable().optional(),
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
    if (data.status === 'CANCELLED' && !data.cancellationReason) throw new AppError('A cancellation reason is required.', 400, 'VALIDATION_ERROR');
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
        activityType: data.activityType,
        subject: data.subject || null,
        date: new Date(data.date),
        endAt: data.endAt ? new Date(data.endAt) : null,
        notes: data.notes || null,
        status: data.status,
        inquiryId: data.inquiryId,
        outcome: data.outcome || null,
        participants: data.participants || null,
        internalFollowers: data.internalFollowers || null,
        nextAction: data.nextAction || null,
        nextActionDueAt: data.nextActionDueAt ? new Date(data.nextActionDueAt) : null,
        cancellationReason: data.cancellationReason || null,
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
    if (data.status === 'CANCELLED' && !data.cancellationReason) throw new AppError('A cancellation reason is required.', 400, 'VALIDATION_ERROR');

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
        activityType: data.activityType,
        subject: data.subject === undefined ? undefined : data.subject || null,
        date: data.date ? new Date(data.date) : undefined,
        endAt: data.endAt === undefined ? undefined : data.endAt ? new Date(data.endAt) : null,
        notes: data.notes || null,
        outcome: data.outcome === undefined ? undefined : data.outcome || null,
        participants: data.participants === undefined ? undefined : data.participants || null,
        internalFollowers: data.internalFollowers === undefined ? undefined : data.internalFollowers || null,
        nextAction: data.nextAction === undefined ? undefined : data.nextAction || null,
        nextActionDueAt: data.nextActionDueAt === undefined ? undefined : data.nextActionDueAt ? new Date(data.nextActionDueAt) : null,
        cancellationReason: data.cancellationReason === undefined ? undefined : data.cancellationReason || null,
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
