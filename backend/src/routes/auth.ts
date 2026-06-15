import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { authenticate, authorize } from '../middleware/auth';
import { getJwtSecret } from '../utils/env';

const router = express.Router();

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

router.post('/login', async (req, res, next) => {
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

export default router;
