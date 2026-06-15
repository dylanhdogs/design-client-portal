import express from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { authenticate, authorize, restrictToOwnClient } from '../middleware/auth';

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
    
    const communications = await prisma.communication.findMany({
      where: { clientId },
      orderBy: { date: 'desc' },
      include: { user: { select: { name: true } } }
    });
    
    res.json(communications);
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
    await prisma.communication.delete({ where: { id } });
    res.json({ message: 'Communication deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

export default router;
