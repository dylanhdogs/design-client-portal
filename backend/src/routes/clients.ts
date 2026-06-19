import express from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { authenticate, authorize, restrictToOwnClient } from '../middleware/auth';
import { getPaginationParams, getPaginationResult } from '../utils/pagination';

const router = express.Router();

const clientSchema = z.object({
  name: z.string().min(1),
  company: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  status: z.enum(['LEAD', 'ACTIVE', 'INACTIVE']).default('LEAD'),
  notes: z.string().optional()
});

const updateClientSchema = clientSchema.partial();

router.get('/', authenticate, authorize('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { status, search, includeDeleted } = req.query;
    const pagination = getPaginationParams(req.query);
    
    const where: any = {};
    if (includeDeleted !== 'true') where.deletedAt = null;
    if (status) where.status = status as string;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { company: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } }
      ];
    }
    
    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          _count: {
            select: {
              consultations: true,
              documents: true,
              communications: true
            }
          },
          poolProject: {
            include: {
              phases: {
                orderBy: { order: 'asc' }
              }
            }
          }
        }
      }),
      prisma.client.count({ where })
    ]);
    
    res.json({ data: clients, pagination: getPaginationResult(total, pagination) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authenticate, restrictToOwnClient, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { includeDeleted } = req.query;
    
    const client = await prisma.client.findFirst({
      where: {
        id,
        ...(includeDeleted !== 'true' ? { deletedAt: null } : {})
      },
      include: {
        consultations: {
          orderBy: { date: 'desc' },
          include: { user: { select: { name: true } } }
        },
        documents: {
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { name: true } } }
        },
        communications: {
          orderBy: { date: 'desc' },
          include: { user: { select: { name: true } } }
        },
        poolProject: {
          include: {
            phases: {
              orderBy: { order: 'asc' },
              include: {
                checklistItems: {
                  orderBy: { order: 'asc' }
                }
              }
            }
          }
        }
      }
    });
    
    if (!client) {
      throw new AppError('Client not found.', 404);
    }
    
    res.json(client);
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, authorize('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const data = clientSchema.parse(req.body);
    
    const client = await prisma.client.create({
      data: {
        name: data.name,
        company: data.company || null,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        status: data.status,
        notes: data.notes || null
      }
    });
    
    res.status(201).json(client);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticate, authorize('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = updateClientSchema.parse(req.body);
    
    const client = await prisma.client.update({
      where: { id },
      data: {
        ...data,
        email: data.email || null,
        company: data.company || null,
        phone: data.phone || null,
        address: data.address || null,
        notes: data.notes || null
      }
    });
    
    res.json(client);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = await prisma.client.findFirst({ where: { id, deletedAt: null } });
    if (!client) throw new AppError('Client not found.', 404);

    await prisma.client.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    res.json({ message: 'Client deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/restore', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = await prisma.client.findFirst({ where: { id, deletedAt: { not: null } } });
    if (!client) throw new AppError('Deleted client not found.', 404);

    await prisma.client.update({
      where: { id },
      data: { deletedAt: null }
    });

    res.json({ message: 'Client restored successfully.' });
  } catch (err) {
    next(err);
  }
});

export default router;
