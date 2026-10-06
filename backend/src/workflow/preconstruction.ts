import { Prisma, PrismaClient } from '@prisma/client';

type DbClient = PrismaClient | Prisma.TransactionClient;

export const READINESS_CATEGORIES = [
  'CONTRACT', 'SCOPE_RECONCILIATION', 'PLANS_SPECIFICATIONS', 'ENGINEERING_PERMITS',
  'INSURANCE_COMPLIANCE', 'BUDGET_COST_CODE', 'SCHEDULE_MILESTONE', 'CLIENT_RESPONSIBILITY',
  'SITE_LOGISTICS_ACCESS', 'SAFETY', 'EXISTING_CONDITIONS', 'UTILITIES', 'SELECTION_ALLOWANCE',
  'PROCUREMENT_PLAN', 'VENDOR_SUBCONTRACTOR', 'COMMUNICATION_PROTOCOL', 'BILLING',
  'TEAM_ASSIGNMENT', 'KICKOFF',
] as const;

export const DEFAULT_READINESS_ITEMS = [
  ['CONTRACT', 'Executed contract verified'],
  ['SCOPE_RECONCILIATION', 'Approved scope reconciled to the contract'],
  ['PLANS_SPECIFICATIONS', 'Plans and specifications reconciled and approved'],
  ['ENGINEERING_PERMITS', 'Engineering, permits, and HOA conditions confirmed'],
  ['INSURANCE_COMPLIANCE', 'Insurance and compliance requirements confirmed'],
  ['BUDGET_COST_CODE', 'Project budget and cost-code structure established'],
  ['SCHEDULE_MILESTONE', 'Construction schedule and milestones established'],
  ['CLIENT_RESPONSIBILITY', 'Client responsibilities and decision dates recorded'],
  ['SITE_LOGISTICS_ACCESS', 'Site access, logistics, staging, and protection planned'],
  ['SAFETY', 'Project-specific safety requirements established'],
  ['EXISTING_CONDITIONS', 'Existing site conditions documented'],
  ['UTILITIES', 'Utility locations and service requirements verified'],
  ['SELECTION_ALLOWANCE', 'Selections and allowances reconciled'],
  ['PROCUREMENT_PLAN', 'Procurement plan and long-lead needs established'],
  ['VENDOR_SUBCONTRACTOR', 'Vendor and subcontractor requirements established'],
  ['COMMUNICATION_PROTOCOL', 'Communication and change-order protocols established'],
  ['BILLING', 'Billing structure and payment schedule established'],
  ['TEAM_ASSIGNMENT', 'Project team and accountable roles assigned'],
  ['KICKOFF', 'Project kickoff completed'],
] as const;

export const READINESS_EVIDENCE_CATEGORIES = [
  'CONTRACT',
  'SCOPE_RECONCILIATION',
  'PLANS_SPECIFICATIONS',
  'ENGINEERING_PERMITS',
] as const;

const READINESS_EVIDENCE_CATEGORY_SET = new Set<string>(READINESS_EVIDENCE_CATEGORIES);

export type ReadinessBlocker = {
  type: 'READINESS_ITEM' | 'EVIDENCE' | 'ASSIGNMENT';
  id: string;
  title: string;
  status: string;
};

export async function ensureReadinessItems(db: DbClient, projectId: string) {
  const existing = await db.preconstructionItem.findMany({ where: { projectId }, select: { category: true, title: true } });
  const keys = new Set(existing.map((item) => `${item.category}:${item.title}`));
  const missing = DEFAULT_READINESS_ITEMS.filter(([category, title]) => !keys.has(`${category}:${title}`));
  if (missing.length) await db.preconstructionItem.createMany({ data: missing.map(([category, title]) => ({
    projectId, category, title, required: true, organizationId: process.env.ORGANIZATION_ID || null,
    clientVisible: ['CLIENT_RESPONSIBILITY', 'SCHEDULE_MILESTONE', 'SELECTION_ALLOWANCE', 'KICKOFF'].includes(category),
    responsibilityParty: category === 'CLIENT_RESPONSIBILITY' || category === 'SELECTION_ALLOWANCE' ? 'CLIENT' : 'INTERNAL',
  })) });
}

export async function calculateReadiness(db: DbClient, projectId: string) {
  const items = await db.preconstructionItem.findMany({
    where: { projectId },
    include: {
      exceptions: { where: { status: 'APPROVED', dueAt: { gte: new Date() } } },
      evidenceLinks: { where: { isCurrent: true }, select: { id: true } },
    },
    orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
  });
  const assignments = await db.projectAssignment.findMany({
    where: { projectId, active: true },
    select: { scope: true },
  });
  const assignmentScopes = new Set(assignments.map((assignment) => assignment.scope));
  const required = items.filter((item) => item.required);
  const resolved = required.filter((item) => {
    if (!['READY', 'NOT_APPLICABLE'].includes(item.status) && item.exceptions.length === 0) return false;
    const evidenceMissing = item.status === 'READY' && item.exceptions.length === 0
      && READINESS_EVIDENCE_CATEGORY_SET.has(item.category) && !item.evidenceLinks.length;
    const assignmentMissing = item.status === 'READY' && item.category === 'TEAM_ASSIGNMENT' && item.exceptions.length === 0
      && (!assignmentScopes.has('PROJECT_OWNER') || !assignmentScopes.has('READINESS_REVIEWER'));
    return !evidenceMissing && !assignmentMissing;
  });
  const blockers: ReadinessBlocker[] = required.flatMap((item): ReadinessBlocker[] => {
    if (!['READY', 'NOT_APPLICABLE'].includes(item.status) && item.exceptions.length === 0) {
      return [{ type: 'READINESS_ITEM' as const, id: item.id, title: item.title, status: item.status }];
    }
    if (item.status === 'READY' && item.exceptions.length === 0 && READINESS_EVIDENCE_CATEGORY_SET.has(item.category) && !item.evidenceLinks.length) {
      return [{ type: 'EVIDENCE' as const, id: item.id, title: `${item.title}: current evidence is required`, status: 'EVIDENCE_MISSING' }];
    }
    if (item.status === 'READY' && item.category === 'TEAM_ASSIGNMENT' && item.exceptions.length === 0 && (!assignmentScopes.has('PROJECT_OWNER') || !assignmentScopes.has('READINESS_REVIEWER'))) {
      return [{ type: 'ASSIGNMENT' as const, id: item.id, title: 'A project owner and readiness reviewer must be assigned', status: 'ASSIGNMENT_MISSING' }];
    }
    return [];
  });
  const score = required.length ? Math.round((resolved.length / required.length) * 100) : 0;
  return { items, blockers, score, exceptionCount: items.reduce((count, item) => count + item.exceptions.length, 0) };
}
