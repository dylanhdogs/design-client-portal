export const LIFECYCLE_STAGES = [
  'INQUIRY',
  'DESIGN',
  'COMPLIANCE',
  'PRE_CONSTRUCTION',
  'PROCUREMENT',
] as const;

export type LifecycleStageName = typeof LIFECYCLE_STAGES[number];

export const LIFECYCLE_STATUSES = [
  'NOT_STARTED', 'IN_PROGRESS', 'WAITING_ON_CLIENT', 'WAITING_ON_EXTERNAL',
  'BLOCKED', 'READY_FOR_REVIEW', 'APPROVED', 'REJECTED', 'SKIPPED', 'CLOSED',
] as const;

export const INQUIRY_STATUSES = [
  'NEW', 'IN_REVIEW', 'QUALIFIED', 'DECLINED', 'NURTURED', 'CONVERTED',
] as const;

export const WORK_ITEM_STATUSES = [
  'OPEN', 'IN_PROGRESS', 'WAITING', 'BLOCKED', 'READY_FOR_REVIEW',
  'COMPLETED', 'VERIFIED', 'CLOSED', 'CANCELLED',
] as const;

export const DECISION_STATUSES = [
  'DRAFT', 'REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED',
] as const;

export const GATE_STATUSES = [
  'PENDING', 'BLOCKED', 'READY_FOR_REVIEW', 'APPROVED', 'OVERRIDDEN', 'STALE', 'REOPENED',
] as const;

export const ASSIGNMENT_SCOPES = [
  'PROJECT_OWNER', 'DESIGN_REVIEWER', 'COMPLIANCE_REVIEWER',
  'READINESS_REVIEWER', 'PROCUREMENT_OWNER', 'LEADERSHIP_APPROVER',
] as const;

export const WORK_ITEM_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

export const APPROVAL_RESULTS = ['APPROVED', 'REJECTED', 'OVERRIDDEN'] as const;

export const LEGACY_PHASE_STAGE: Record<string, LifecycleStageName> = {
  INTAKE: 'INQUIRY',
  SITE_EVALUATION: 'DESIGN',
  DESIGN: 'DESIGN',
  CONTRACT: 'COMPLIANCE',
  PROPOSAL: 'PRE_CONSTRUCTION',
  PRE_CONSTRUCTION: 'PRE_CONSTRUCTION',
};

export const STAGE_TRANSITIONS = LIFECYCLE_STAGES.slice(0, -1).map((fromStage, index) => ({
  fromStage,
  toStage: LIFECYCLE_STAGES[index + 1],
}));

export function isAllowedValue<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === 'string' && values.includes(value as T[number]);
}
