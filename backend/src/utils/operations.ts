import { prisma } from './prisma';
import { AppError } from './errors';

const redact = (value: unknown): unknown => {
  if (!value || typeof value !== 'object') return value;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    result[key] = /password|token|secret|authorization|cookie|email|phone|address/i.test(key) ? '[REDACTED]' : item;
  }
  return result;
};

export async function recordOperationalAlert(category: string, message: string, input: { severity?: string; requestId?: string; metadata?: unknown } = {}) {
  return prisma.operationalAlert.create({ data: { category, message: message.slice(0, 1000), severity: input.severity || 'WARNING', requestId: input.requestId, metadataJson: input.metadata ? JSON.stringify(redact(input.metadata)) : null } });
}

export async function assertDeletionAllowed(entityType: string, entityId: string, clientId?: string) {
  const hold = await prisma.legalHold.findFirst({ where: { active: true, OR: [{ entityType, entityId }, ...(clientId ? [{ entityType: 'Client', entityId: clientId }] : [])] } });
  if (hold) throw new AppError('This record is under legal hold and cannot be deleted.', 409, 'CONFLICT');
}
