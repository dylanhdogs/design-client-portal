import express from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { resolveStoredFile } from '../utils/storage';
import { AuthRequest, authenticate } from '../middleware/auth';

const router = express.Router();

const inlineDisposition = (filename: string): string => {
  const fallback = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_').slice(0, 150) || 'document';
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`;
};

router.get('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = req.user!;

    const doc = await prisma.document.findFirst({
      where: { id: req.params.id, deletedAt: null },
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

    if (user.role !== 'ADMIN') {
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

    const filePath = resolveStoredFile(doc.filename);

    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', inlineDisposition(doc.originalName));
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
});

export default router;
