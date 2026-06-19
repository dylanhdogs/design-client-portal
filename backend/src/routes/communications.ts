import express from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { authenticate, authorize, restrictToOwnClient } from '../middleware/auth';
import { getPaginationParams, getPaginationResult } from '../utils/pagination';
import { logActivity } from '../utils/activity';

const router = express.Router({ mergeParams: true });

const communicationSchema = z.object({
  type: z.enum(['EMAIL', 'PHONE', 'IN_PERSON', 'SMS', 'OTHER']).default('EMAIL'),
  subject: z.string().optional(),
  body: z.string().min(1),
  direction: z.enum(['INBOUND', 'OUTBOUND']).default('OUTBOUND'),
  date: z.string().datetime().or(z.string().min(1)).optional()
});

router.get('/', authenticate, restrictToOwnClient, async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { includeDeleted } = req.query;
    const pagination = getPaginationParams(req.query);
    
    const where: any = { clientId };
    if (includeDeleted !== 'true') where.deletedAt = null;
    
    const [communications, total] = await Promise.all([
      prisma.communication.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
        include: { user: { select: { name: true } } }
      }),
      prisma.communication.count({ where })
    ]);
    
    res.json({ data: communications, pagination: getPaginationResult(total, pagination) });
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, restrictToOwnClient, async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const data = communicationSchema.parse(req.body);
    const userId = (req as any).user.id;
    
    const communication = await prisma.communication.create({
      data: {
        clientId,
        userId,
        type: data.type,
        subject: data.subject || null,
        body: data.body,
        direction: data.direction,
        date: data.date ? new Date(data.date) : new Date()
      }
    });

    logActivity(userId, 'CREATE', 'Communication', communication.id, { subject: communication.subject });
    
    res.status(201).json(communication);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticate, authorize('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = communicationSchema.partial().parse(req.body);
    
    const communication = await prisma.communication.update({
      where: { id },
      data: {
        ...data,
        subject: data.subject || null,
        date: data.date ? new Date(data.date) : undefined
      }
    });
    
    res.json(communication);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, authorize('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const comm = await prisma.communication.findFirst({ where: { id, deletedAt: null } });
    if (!comm) throw new AppError('Communication not found.', 404);

    await prisma.communication.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    logActivity((req as any).user.id, 'DELETE', 'Communication', id);
    res.json({ message: 'Communication deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/restore', authenticate, authorize('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const comm = await prisma.communication.findFirst({ where: { id, deletedAt: { not: null } } });
    if (!comm) throw new AppError('Deleted communication not found.', 404);

    await prisma.communication.update({
      where: { id },
      data: { deletedAt: null }
    });

    logActivity((req as any).user.id, 'RESTORE', 'Communication', id);
    res.json({ message: 'Communication restored successfully.' });
  } catch (err) {
    next(err);
  }
});

export default router;
