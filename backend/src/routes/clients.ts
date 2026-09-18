import express from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { authenticate, authorize, restrictToOwnClient, AuthRequest } from '../middleware/auth';
import { getPaginationParams, getPaginationResult } from '../utils/pagination';
import { logActivity } from '../utils/activity';

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

router.get('/', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { status, search, archived } = req.query;
    const pagination = getPaginationParams(req.query);
    
    const where: any = {};
    if (archived === 'true') {
      if ((req as AuthRequest).user?.role !== 'ADMIN') throw new AppError('Administrator access is required to view archived clients.', 403, 'FORBIDDEN');
      where.deletedAt = { not: null };
    } else {
      where.deletedAt = null;
    }
    // Clients is the established-customer directory. Reception explicitly
    // requests LEAD records when it needs to work the intake queue.
    where.status = status ? status as string : 'ACTIVE';
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { company: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } },
        { address: { contains: search as string, mode: 'insensitive' } }
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
    const client = await prisma.client.findFirst({
      where: {
        id,
        deletedAt: null,
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
        inquiries: {
          where: { qualificationStatus: 'CONVERTED' },
          orderBy: { convertedAt: 'desc' },
          select: { id: true, projectId: true, qualificationStatus: true, convertedAt: true }
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

router.post('/', authenticate, authorize('ADMIN'), async (req, res, next) => {
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

    logActivity((req as any).user.id, 'CREATE', 'Client', client.id, { name: client.name });
    
    res.status(201).json(client);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
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

    logActivity((req as any).user.id, 'UPDATE', 'Client', id, { name: client.name });
    
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
    const result = await prisma.$transaction(async (tx) => {
      const hold = await tx.legalHold.findFirst({ where: { active: true, entityType: 'Client', entityId: id } });
      if (hold) throw new AppError('This record is under legal hold and cannot be deleted.', 409, 'CONFLICT');
      const linkedUsers = await tx.user.findMany({ where: { clientId: id }, select: { id: true } });
      const linkedUserIds = linkedUsers.map((user) => user.id);
      const assignments = linkedUserIds.length
        ? await tx.projectAssignment.updateMany({ where: { userId: { in: linkedUserIds }, active: true }, data: { active: false } })
        : { count: 0 };
      const users = await tx.user.updateMany({
        where: { clientId: id },
        data: { active: false, sessionVersion: { increment: 1 }, resetToken: null, resetTokenExpires: null },
      });
      const invitations = await tx.invitation.updateMany({
        where: { clientId: id, status: 'PENDING' },
        data: { status: 'REVOKED' },
      });
      await tx.client.update({ where: { id }, data: { deletedAt: new Date() } });
      return { revokedUsers: users.count, revokedInvitations: invitations.count, deactivatedAssignments: assignments.count };
    });

    await logActivity((req as any).user.id, 'DELETE', 'Client', id, result);
    res.json({ message: 'Client deleted and linked access revoked successfully.', ...result });
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

    logActivity((req as any).user.id, 'RESTORE', 'Client', id);
    res.json({ message: 'Client restored successfully.' });
  } catch (err) {
    next(err);
  }
});

export default router;
