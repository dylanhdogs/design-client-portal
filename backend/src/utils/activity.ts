import { prisma } from './prisma';

type EntityType = 'Client' | 'Consultation' | 'Document' | 'Communication' | 'PoolProject' | 'ProjectPhase' | 'ChecklistItem';
type Action = 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE' | 'SUBMIT' | 'VERIFY';

export const logActivity = async (
  userId: string,
  action: Action,
  entityType: EntityType,
  entityId: string,
  details?: Record<string, any>,
) => {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        details: details ? JSON.stringify(details) : null,
      },
    });
  } catch {
    // silently fail — activity logging should never break the main operation
  }
};
