import { Prisma, PrismaClient } from '@prisma/client';

type DbClient = PrismaClient | Prisma.TransactionClient;

const REDACTED_KEY = /(password|token|secret|authorization|cookie|credential)/i;

function sanitizeAuditValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(sanitizeAuditValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !REDACTED_KEY.test(key))
        .map(([key, child]) => [key, sanitizeAuditValue(child)]),
    );
  }
  return value;
}

function serializeAuditValue(value: unknown): string | null {
  if (value === undefined) return null;
  return JSON.stringify(sanitizeAuditValue(value)) ?? null;
}

export function parseAuditValue(value: string | null | undefined): unknown {
  if (!value) return null;
  try { return sanitizeAuditValue(JSON.parse(value)); } catch { return null; }
}

export async function writeAuditEvent(db: DbClient, event: {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  requestId?: string;
  details?: Record<string, unknown>;
  before?: unknown;
  after?: unknown;
  actorName?: string;
  actorRole?: string;
  inquiryId?: string;
  projectId?: string;
}) {
  const inquiryId = event.inquiryId || (event.entityType === 'Inquiry' ? event.entityId : null);
  const [actor, inquiry] = await Promise.all([
    db.user.findUnique({ where: { id: event.userId }, select: { name: true, role: true } }),
    inquiryId ? db.inquiry.findUnique({ where: { id: inquiryId }, select: { projectId: true } }) : Promise.resolve(null),
  ]);
  return db.activityLog.create({
    data: {
      userId: event.userId,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      requestId: event.requestId || null,
      actorName: event.actorName || actor?.name || 'Unknown user',
      actorRole: event.actorRole || actor?.role || 'UNKNOWN',
      inquiryId,
      projectId: event.projectId || inquiry?.projectId || null,
      details: serializeAuditValue(event.details),
      beforeState: serializeAuditValue(event.before),
      afterState: serializeAuditValue(event.after),
    },
  });
}
