import { Prisma, PrismaClient } from '@prisma/client';

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function writeAuditEvent(db: DbClient, event: {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  requestId?: string;
  details?: Record<string, unknown>;
  before?: unknown;
  after?: unknown;
}) {
  return db.activityLog.create({
    data: {
      userId: event.userId,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      requestId: event.requestId || null,
      details: event.details ? JSON.stringify(event.details) : null,
      beforeState: event.before === undefined ? null : JSON.stringify(event.before),
      afterState: event.after === undefined ? null : JSON.stringify(event.after),
    },
  });
}
