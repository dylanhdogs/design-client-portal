import express from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { authenticate, authorize, restrictToOwnClient } from '../middleware/auth';

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
    const { status, search } = req.query;
    
    const where: any = {};
    if (status) where.status = status as string;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { company: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } }
      ];
    }
    
    const clients = await prisma.client.findMany({
      where,
      orderBy: { createdAt: 'desc' },
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
    });
    
    res.json(clients);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authenticate, restrictToOwnClient, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const client = await prisma.client.findUnique({
      where: { id },
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
    await prisma.client.delete({ where: { id } });
    res.json({ message: 'Client deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

export default router;
