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

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.enum(['ADMIN', 'STAFF', 'CLIENT']).default('STAFF')
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    
    const user = await prisma.user.findUnique({
      where: { email: data.email }
    });
    
    if (!user) {
      throw new AppError('Invalid credentials.', 401);
    }
    
    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) {
      throw new AppError('Invalid credentials.', 401);
    }
    
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name, clientId: user.clientId },
      getJwtSecret(),
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        clientId: user.clientId
      }
    });
  } catch (err) {
    next(err);
  }
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
    
    const passwordHash = await bcrypt.hash(data.password, 10);
    
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
      select: { id: true, email: true, name: true, role: true, clientId: true, createdAt: true }
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
  currentPassword: z.string().min(6).optional(),
  newPassword: z.string().min(6).optional(),
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
      updateData.passwordHash = await bcrypt.hash(data.newPassword, 10);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, email: true, name: true, role: true, clientId: true, createdAt: true }
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.get('/users', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many password reset requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/forgot-password', forgotPasswordLimiter, async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken: token, resetTokenExpires: expires }
      });

      console.log(`\n[Password Reset] ${email}`);
      console.log(`Reset link: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}\n`);
    }

    res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = z.object({
      token: z.string().min(1),
      newPassword: z.string().min(6)
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

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpires: null
      }
    });

    res.json({ message: 'Password reset successful. You can now log in with your new password.' });
  } catch (err) {
    next(err);
  }
});

export default router;
