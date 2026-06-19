import express from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { authenticate, authorize } from '../middleware/auth';
import { getPaginationParams, getPaginationResult } from '../utils/pagination';

const router = express.Router({ mergeParams: true });

const consultationSchema = z.object({
  title: z.string().min(1),
  date: z.string().datetime().or(z.string().min(1)),
  notes: z.string().optional(),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']).default('SCHEDULED')
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { includeDeleted } = req.query;
    const pagination = getPaginationParams(req.query);
    
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

router.post('/', authenticate, authorize('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const data = consultationSchema.parse(req.body);
    const userId = (req as any).user.id;
    
    const consultation = await prisma.consultation.create({
      data: {
        clientId,
        userId,
        title: data.title,
        date: new Date(data.date),
        notes: data.notes || null,
        status: data.status
      }
    });
    
    res.status(201).json(consultation);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticate, authorize('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = consultationSchema.partial().parse(req.body);
    
    const consultation = await prisma.consultation.update({
      where: { id },
      data: {
        ...data,
        date: data.date ? new Date(data.date) : undefined,
        notes: data.notes || null
      }
    });
    
    res.json(consultation);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, authorize('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const cons = await prisma.consultation.findFirst({ where: { id, deletedAt: null } });
    if (!cons) throw new AppError('Consultation not found.', 404);

    await prisma.consultation.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    res.json({ message: 'Consultation deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/restore', authenticate, authorize('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const cons = await prisma.consultation.findFirst({ where: { id, deletedAt: { not: null } } });
    if (!cons) throw new AppError('Deleted consultation not found.', 404);

    await prisma.consultation.update({
      where: { id },
      data: { deletedAt: null }
    });

    res.json({ message: 'Consultation restored successfully.' });
  } catch (err) {
    next(err);
  }
});

export default router;
