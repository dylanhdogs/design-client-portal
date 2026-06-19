import express from 'express';
import path from 'path';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getJwtSecret } from '../utils/env';

const router = express.Router();

router.get('/:id', async (req, res, next) => {
  try {
    let user: any = null;

    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      if (token) {
        try {
          user = jwt.verify(token, getJwtSecret());
        } catch {
          // token invalid, continue without user
        }
      }
    }

    if (!user) {
      const queryToken = req.query.token as string;
      if (queryToken) {
        try {
          user = jwt.verify(queryToken, getJwtSecret());
        } catch {
          throw new AppError('Invalid or expired token.', 401);
        }
      }
    }

    if (!user) {
      throw new AppError('Access denied. No token provided.', 401);
    }

    const doc = await prisma.document.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        filename: true,
        originalName: true,
        mimeType: true,
        clientId: true
      }
    });

    if (!doc) {
      throw new AppError('File not found.', 404);
    }

    if (user.role !== 'ADMIN' && user.role !== 'STAFF') {
      if (user.role === 'CLIENT') {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { clientId: true }
        });

        if (!dbUser?.clientId || dbUser.clientId !== doc.clientId) {
          throw new AppError('Access denied.', 403);
        }
      } else {
        throw new AppError('Access denied.', 403);
      }
    }

    const filePath = path.join(process.cwd(), 'uploads', doc.filename);

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.originalName}"`);
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
});

export default router;
