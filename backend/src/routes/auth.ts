import crypto from 'crypto';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';
import { getJwtSecret } from '../utils/env';
import { clearSessionCookies, issueSessionCookies } from '../utils/cookies';
import { passwordSchema } from '../utils/password';
import { parseAuditValue, writeAuditEvent } from '../workflow/audit';
import { getSessionDuration } from '../utils/session';
import { Prisma } from '@prisma/client';
import { getPaginationParams, getPaginationResult } from '../utils/pagination';

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({
    error: {
      code: 'CONFLICT',
      message: 'Too many login attempts. Please try again in 15 minutes.',
    },
  }),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128)
});

const registerSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  name: z.string().min(1),
  role: z.enum(['ADMIN', 'CLIENT']).default('CLIENT')
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: { client: { select: { deletedAt: true } } },
    });
    
    if (!user || !user.active || !['ADMIN', 'CLIENT'].includes(user.role) || (user.role === 'CLIENT' && (!user.clientId || !user.client || user.client.deletedAt !== null))) {
      throw new AppError('Invalid credentials.', 401);
    }
    
    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) {
      throw new AppError('Invalid credentials.', 401);
    }
    
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name, clientId: user.clientId, sessionVersion: user.sessionVersion },
      getJwtSecret(),
      { expiresIn: getSessionDuration().jwtValue as any }
    );
    
    await writeAuditEvent(prisma, {
      userId: user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
      requestId: (req as any).requestId,
      details: { role: user.role },
    });
    issueSessionCookies(res, token);
    res.json({
      ...(req.header('x-auth-mode') === 'bearer' ? { token } : {}),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        clientId: user.clientId,
        active: user.active,
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', authenticate, (req, res) => {
  clearSessionCookies(res);
  res.json({ message: 'Logged out.' });
});

router.post('/register', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    
    const existing = await prisma.user.findUnique({
      where: { email: data.email }
    });
    
    if (existing) {
      throw new AppError('User already exists.', 409);
    }
    
    const passwordHash = await bcrypt.hash(data.password, 12);
    
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        role: data.role
      }
    });
    
    res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: (req as any).user.id },
      select: { id: true, email: true, name: true, role: true, clientId: true, active: true, createdAt: true }
    });
    
    if (!user) {
      throw new AppError('User not found.', 404);
    }
    
    res.json(user);
  } catch (err) {
    next(err);
  }
});

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  currentPassword: z.string().min(1).max(128).optional(),
  newPassword: passwordSchema.optional(),
}).refine((data) => {
  if (data.newPassword && !data.currentPassword) {
    return false;
  }
  return true;
}, { message: 'Current password is required to set a new password.' });

router.put('/me', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const data = updateProfileSchema.parse(req.body);

    if (data.newPassword) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new AppError('User not found.', 404);

      const valid = await bcrypt.compare(data.currentPassword!, user.passwordHash);
      if (!valid) throw new AppError('Current password is incorrect.', 401);
    }

    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.email) updateData.email = data.email;
    if (data.newPassword) {
      updateData.passwordHash = await bcrypt.hash(data.newPassword, 12);
      updateData.sessionVersion = { increment: 1 };
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, email: true, name: true, role: true, clientId: true, active: true, createdAt: true }
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.get('/users', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const paginated = ['page', 'limit', 'search', 'role', 'status', 'clientId'].some((key) => req.query[key] !== undefined);
    const pagination = getPaginationParams(req.query);
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 120) : '';
    const role = req.query.role === 'ADMIN' || req.query.role === 'CLIENT' ? req.query.role : undefined;
    const status = req.query.status === 'active' ? true : req.query.status === 'suspended' ? false : undefined;
    const clientId = typeof req.query.clientId === 'string' ? req.query.clientId : undefined;
    const where: Prisma.UserWhereInput = {
      role: role || { in: ['ADMIN', 'CLIENT'] },
      ...(status !== undefined ? { active: status } : {}),
      ...(clientId ? { clientId } : {}),
      ...(search ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] } : {}),
    };
    const select = {
      id: true, email: true, name: true, role: true, active: true, clientId: true, createdAt: true,
      client: { select: { id: true, name: true, company: true, deletedAt: true } },
    } as const;
    if (!paginated) {
      const users = await prisma.user.findMany({ where, select, orderBy: { createdAt: 'desc' } });
      return res.json(users);
    }
    const [data, total] = await Promise.all([
      prisma.user.findMany({ where, select, orderBy: { createdAt: 'desc' }, skip: pagination.skip, take: pagination.limit }),
      prisma.user.count({ where }),
    ]);
    res.json({ data, pagination: getPaginationResult(total, pagination) });
  } catch (err) {
    next(err);
  }
});

const userIdentitySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()).optional(),
  role: z.enum(['ADMIN', 'CLIENT']).optional(),
  clientId: z.string().trim().min(1).nullable().optional(),
}).strict().refine((data) => Object.keys(data).length > 0, 'Provide a name or email to update.');

router.patch('/users/:id', authenticate, authorize('ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const data = userIdentitySchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, name: true, email: true, role: true, clientId: true, active: true } });
    if (!existing) throw new AppError('User not found.', 404, 'NOT_FOUND');
    const role = data.role || existing.role;
    const clientId = role === 'CLIENT'
      ? (data.clientId !== undefined ? data.clientId : existing.clientId)
      : null;
    if (role === 'CLIENT' && !clientId) throw new AppError('Choose a client for a client account.', 400, 'VALIDATION_ERROR');
    if (clientId) {
      const client = await prisma.client.findFirst({ where: { id: clientId, deletedAt: null }, select: { id: true } });
      if (!client) throw new AppError('Choose an active client.', 400, 'VALIDATION_ERROR');
      const duplicate = await prisma.user.findFirst({ where: { id: { not: existing.id }, clientId, role: 'CLIENT' }, select: { id: true } });
      if (duplicate) throw new AppError('That client already has a linked login. Resolve the existing account before changing access.', 409, 'CONFLICT');
    }
    const accessChanged = role !== existing.role || clientId !== existing.clientId;
    const changes = [
      ...(data.name !== undefined && data.name !== existing.name ? [{ field: 'name', before: existing.name, after: data.name }] : []),
      ...(data.email !== undefined && data.email !== existing.email ? [{ field: 'email', before: existing.email, after: data.email }] : []),
      ...(accessChanged ? [{ field: 'accessProfile', before: { role: existing.role, clientId: existing.clientId }, after: { role, clientId } }] : []),
    ];
    if (!changes.length) return res.json(existing);
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id: existing.id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.email !== undefined ? { email: data.email } : {}),
          ...(accessChanged ? { role, clientId, sessionVersion: { increment: 1 } } : {}),
        },
        select: { id: true, name: true, email: true, role: true, clientId: true, active: true, createdAt: true },
      });
      const assignments = accessChanged
        ? await tx.projectAssignment.updateMany({ where: { userId: existing.id, active: true }, data: { active: false } })
        : { count: 0 };
      await writeAuditEvent(tx, {
        userId: req.user!.id, action: 'USER_PROFILE_UPDATED', entityType: 'User', entityId: existing.id,
        requestId: (req as any).requestId,
        details: { changes, deactivatedAssignments: assignments.count },
        before: { name: existing.name, email: existing.email, role: existing.role, clientId: existing.clientId },
        after: { name: result.name, email: result.email, role: result.role, clientId: result.clientId },
      });
      return { ...result, deactivatedAssignments: assignments.count };
    });
    res.json(updated);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return next(new AppError('That email address is already assigned to another account.', 409, 'CONFLICT'));
    }
    if (String((err as any)?.message || err).includes('last_active_administrator')) {
      return next(new AppError('The last active administrator cannot be changed to a client account.', 409, 'CONFLICT'));
    }
    next(err);
  }
});

router.get('/users/:id/activity', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const exists = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!exists) throw new AppError('User not found.', 404, 'NOT_FOUND');
    const pagination = getPaginationParams(req.query);
    const where = { OR: [{ entityType: 'User', entityId: req.params.id }, { userId: req.params.id }] };
    const [events, total] = await Promise.all([
      prisma.activityLog.findMany({
        where, skip: pagination.skip, take: pagination.limit, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true, userId: true, actorName: true, actorRole: true, action: true, entityType: true, entityId: true, details: true, beforeState: true, afterState: true, createdAt: true, user: { select: { name: true, role: true } } },
      }),
      prisma.activityLog.count({ where }),
    ]);
    res.json({
      data: events.map(({ user, details, beforeState, afterState, ...event }) => ({
        ...event, actorName: event.actorName || user?.name || 'Unknown user', actorRole: event.actorRole || user?.role || 'UNKNOWN',
        details: parseAuditValue(details), before: parseAuditValue(beforeState), after: parseAuditValue(afterState),
      })),
      pagination: getPaginationResult(total, pagination),
    });
  } catch (err) { next(err); }
});

const accessProfileSchema = z.object({
  role: z.enum(['ADMIN', 'CLIENT']),
  clientId: z.string().trim().min(1).nullable().optional(),
}).strict();

router.put('/users/:id/access-profile', authenticate, authorize('ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const data = accessProfileSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, name: true, email: true, role: true, clientId: true, active: true } });
    if (!existing) throw new AppError('User not found.', 404, 'NOT_FOUND');
    const clientId = data.role === 'CLIENT' ? data.clientId || null : null;
    if (data.role === 'CLIENT' && !clientId) throw new AppError('Choose a client for a client account.', 400, 'VALIDATION_ERROR');
    if (clientId) {
      const client = await prisma.client.findFirst({ where: { id: clientId, deletedAt: null }, select: { id: true } });
      if (!client) throw new AppError('Choose an active client.', 400, 'VALIDATION_ERROR');
      const duplicate = await prisma.user.findFirst({ where: { id: { not: existing.id }, clientId, role: 'CLIENT' }, select: { id: true } });
      if (duplicate) throw new AppError('That client already has a linked login. Resolve the existing account before changing access.', 409, 'CONFLICT');
    }
    if (existing.role === data.role && existing.clientId === clientId) return res.json(existing);

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id: existing.id },
        data: { role: data.role, clientId, sessionVersion: { increment: 1 } },
        select: { id: true, name: true, email: true, role: true, clientId: true, active: true, createdAt: true },
      });
      const assignments = existing.clientId !== clientId || existing.role !== data.role
        ? await tx.projectAssignment.updateMany({ where: { userId: existing.id, active: true }, data: { active: false } })
        : { count: 0 };
      await writeAuditEvent(tx, {
        userId: req.user!.id, action: 'USER_ACCESS_PROFILE_CHANGED', entityType: 'User', entityId: existing.id,
        requestId: (req as any).requestId,
        before: { role: existing.role, clientId: existing.clientId },
        after: { role: result.role, clientId: result.clientId, deactivatedAssignments: assignments.count },
      });
      return { ...result, deactivatedAssignments: assignments.count };
    });
    res.json(updated);
  } catch (err) {
    if (String((err as any)?.message || err).includes('last_active_administrator')) {
      return next(new AppError('The last active administrator cannot be changed to a client account.', 409, 'CONFLICT'));
    }
    next(err);
  }
});

router.put('/users/:id/access', authenticate, authorize('ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const { active } = z.object({ active: z.boolean() }).parse(req.body);
    const actorId = (req as any).user.id;
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, email: true, name: true, role: true, active: true, clientId: true, client: { select: { deletedAt: true } } } });
    if (!user) throw new AppError('User not found.', 404, 'NOT_FOUND');
    if (user.id === actorId && !active) throw new AppError('You cannot suspend your own account.', 409, 'CONFLICT');
    if (active && user.role === 'CLIENT' && (!user.clientId || !user.client || user.client.deletedAt !== null)) {
      throw new AppError('Restore the linked client before reactivating this account.', 409, 'CONFLICT');
    }
    if (user.role === 'ADMIN' && user.active && !active) {
      const otherAdministrators = await prisma.user.count({ where: { role: 'ADMIN', active: true, id: { not: user.id } } });
      if (otherAdministrators === 0) throw new AppError('The last active administrator cannot be suspended.', 409, 'CONFLICT');
    }
    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
        const updated = await tx.user.update({
          where: { id: user.id },
          data: { active, sessionVersion: { increment: 1 } },
          select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
        });
        const assignments = !active
          ? await tx.projectAssignment.updateMany({ where: { userId: user.id, active: true }, data: { active: false } })
          : { count: 0 };
        await writeAuditEvent(tx, {
          userId: actorId,
          action: active ? 'USER_ACCESS_RESTORED' : 'USER_ACCESS_SUSPENDED',
          entityType: 'User',
          entityId: user.id,
          requestId: (req as any).requestId,
          before: { active: user.active },
          after: { active: updated.active, deactivatedAssignments: assignments.count },
        });
        return { updated, deactivatedAssignments: assignments.count };
      });
    } catch (error) {
      if (String(error).includes('last_active_administrator') || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003')) {
        throw new AppError('The last active administrator cannot be suspended.', 409, 'CONFLICT');
      }
      throw error;
    }
    const { updated, deactivatedAssignments } = result;
    res.json({ ...updated, deactivatedAssignments });
  } catch (err) {
    next(err);
  }
});

router.post('/users/:id/password-reset', authenticate, authorize('ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, email: true, active: true } });
    if (!user) throw new AppError('User not found.', 404, 'NOT_FOUND');
    if (!user.active) throw new AppError('Reactivate this account before issuing a password reset link.', 409, 'CONFLICT');
    const token = crypto.randomBytes(32).toString('hex');
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { resetToken: crypto.createHash('sha256').update(token).digest('hex'), resetTokenExpires: expiresAt } });
      await writeAuditEvent(tx, {
        userId: req.user!.id, action: 'USER_PASSWORD_RESET_REQUESTED', entityType: 'User', entityId: user.id,
        requestId: (req as any).requestId, details: { expiresAt },
      });
    });
    res.status(201).json({ message: 'One-time password reset link created. Share it with the user through a private channel; it expires in one hour.', resetLink, expiresAt });
  } catch (err) { next(err); }
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({
    error: {
      code: 'CONFLICT',
      message: 'Too many password reset requests. Please try again in 15 minutes.',
    },
  }),
});

router.post('/forgot-password', forgotPasswordLimiter, async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    const notificationMode = process.env.EXTERNAL_NOTIFICATION_MODE || 'disabled';
    const user = await prisma.user.findUnique({ where: { email } });
    let resetLink: string | undefined;
    if (user && notificationMode !== 'disabled') {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken: crypto.createHash('sha256').update(token).digest('hex'), resetTokenExpires: expires }
      });

      resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
      if (notificationMode === 'console' && process.env.NODE_ENV !== 'production') {
        console.info(`[Password Reset] A reset request was created for ${email}.`);
      }
    }

    if (notificationMode === 'disabled') {
      return res.json({ message: 'Password reset email is not configured. Contact an administrator for account recovery.' });
    }
    res.json({
      message: 'If an account with that email exists, a password reset request has been created.',
      ...(notificationMode === 'console' && process.env.NODE_ENV !== 'production' && resetLink ? { resetLink } : {}),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = z.object({
      token: z.string().min(1),
      newPassword: passwordSchema
    }).parse(req.body);

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await prisma.user.findFirst({
      where: { OR: [{ resetToken: hashedToken }, { resetToken: token }], resetTokenExpires: { gt: new Date() } }
    });

    if (!user) {
      throw new AppError('Invalid or expired reset token.', 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash, resetToken: null, resetTokenExpires: null, sessionVersion: { increment: 1 } }
      });
      await writeAuditEvent(tx, {
        userId: user.id,
        action: 'USER_PASSWORD_RESET_COMPLETED',
        entityType: 'User',
        entityId: user.id,
      });
    });

    res.json({ message: 'Password reset successful. You can now log in with your new password.' });
  } catch (err) {
    next(err);
  }
});

export default router;
