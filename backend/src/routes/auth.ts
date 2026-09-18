import crypto from 'crypto';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { authenticate, authorize } from '../middleware/auth';
import { getJwtSecret } from '../utils/env';
import { clearSessionCookies, issueSessionCookies } from '../utils/cookies';
import { passwordSchema } from '../utils/password';
import { writeAuditEvent } from '../workflow/audit';
import { getSessionDuration } from '../utils/session';
import { Prisma } from '@prisma/client';

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
    const users = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'CLIENT'] } },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

router.put('/users/:id/access', authenticate, authorize('ADMIN'), async (req, res, next) => {
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
        return { updated, deactivatedAssignments: assignments.count };
      });
    } catch (error) {
      if (String(error).includes('last_active_administrator') || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003')) {
        throw new AppError('The last active administrator cannot be suspended.', 409, 'CONFLICT');
      }
      throw error;
    }
    const { updated, deactivatedAssignments } = result;
    await writeAuditEvent(prisma, {
      userId: actorId,
      action: active ? 'ENABLE_ACCESS' : 'SUSPEND_ACCESS',
      entityType: 'User',
      entityId: user.id,
      requestId: (req as any).requestId,
      before: { active: user.active },
      after: { active: updated.active, deactivatedAssignments },
    });
    res.json({ ...updated, deactivatedAssignments });
  } catch (err) {
    next(err);
  }
});

router.put('/users/:id/password', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { newPassword } = z.object({ newPassword: passwordSchema }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, email: true } });
    if (!user) throw new AppError('User not found.', 404);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 12),
        resetToken: null,
        resetTokenExpires: null,
        sessionVersion: { increment: 1 },
      },
    });
    await writeAuditEvent(prisma, {
      userId: (req as any).user.id,
      action: 'ADMIN_PASSWORD_RESET',
      entityType: 'User',
      entityId: user.id,
      requestId: (req as any).requestId,
    });
    res.json({ message: `Password updated for ${user.email}. Give the new password to the user through an approved private channel.` });
  } catch (err) {
    next(err);
  }
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
        data: { resetToken: token, resetTokenExpires: expires }
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

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpires: { gt: new Date() }
      }
    });

    if (!user) {
      throw new AppError('Invalid or expired reset token.', 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpires: null,
        sessionVersion: { increment: 1 },
      }
    });

    res.json({ message: 'Password reset successful. You can now log in with your new password.' });
  } catch (err) {
    next(err);
  }
});

export default router;
