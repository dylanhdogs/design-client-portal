import express from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { getPaginationParams, getPaginationResult } from '../utils/pagination';

const router = express.Router();

router.get('/', authenticate, authorize('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const pagination = getPaginationParams(req.query);
    const { entityType, entityId } = req.query;

    const where: any = {};
    if (entityType) where.entityType = entityType as string;
    if (entityId) where.entityId = entityId as string;

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
        include: { user: { select: { name: true, email: true } } }
      }),
      prisma.activityLog.count({ where })
    ]);

    const data = logs.map((log) => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null
    }));

    res.json({ data, pagination: getPaginationResult(total, pagination) });
  } catch (err) {
    next(err);
  }
});

export default router;
