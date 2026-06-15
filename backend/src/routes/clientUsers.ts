import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router({ mergeParams: true });

const createClientUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1)
});

// Create a CLIENT user account for a client (ADMIN only)
router.post('/create-login', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const data = createClientUserSchema.parse(req.body);
    
    // Check if client exists
    const client = await prisma.client.findUnique({
      where: { id: clientId }
    });
    
    if (!client) {
      throw new AppError('Client not found.', 404);
    }
    
    // Check if client already has a user account
    const existing = await prisma.user.findFirst({
      where: { clientId }
    });
    
    if (existing) {
      throw new AppError('Client already has a login account.', 409);
    }
    
    // Check if email is already used
    const emailExists = await prisma.user.findUnique({
      where: { email: data.email }
    });
    
    if (emailExists) {
      throw new AppError('Email address already in use.', 409);
    }
    
    const passwordHash = await bcrypt.hash(data.password, 10);
    
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        role: 'CLIENT',
        clientId: client.id
      }
    });
    
    res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      clientId: user.clientId
    });
  } catch (err) {
    next(err);
  }
});

// Get client login info (ADMIN only)
router.get('/login-info', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { clientId } = req.params;
    
    const user = await prisma.user.findFirst({
      where: { clientId },
      select: { id: true, email: true, name: true, role: true, createdAt: true }
    });
    
    res.json(user || null);
  } catch (err) {
    next(err);
  }
});

export default router;
