import express from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { authenticate } from '../middleware/auth';
import { getPaginationParams, getPaginationResult } from '../utils/pagination';

const router = express.Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const pagination = getPaginationParams(req.query);

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit
      }),
      prisma.notification.count({ where: { userId } })
    ]);

    res.json({ data: notifications, pagination: getPaginationResult(total, pagination) });
  } catch (err) {
    next(err);
  }
});

router.get('/unread-count', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const count = await prisma.notification.count({
      where: { userId, isRead: false }
    });

    res.json({ count });
  } catch (err) {
    next(err);
  }
});

router.put('/read-all', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });

    res.json({ message: 'Notifications marked as read.' });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/read', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const notification = await prisma.notification.findFirst({
      where: { id, userId }
    });

    if (!notification) {
      throw new AppError('Notification not found.', 404);
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
