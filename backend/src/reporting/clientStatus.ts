import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';

export type ClientReportState = 'ON_TRACK' | 'ATTENTION_REQUIRED' | 'BLOCKED' | 'NO_ACTIVE_WORK';
export type Responsibility = 'CLIENT' | 'INTERNAL' | 'EXTERNAL' | 'LEADERSHIP';

export interface ReportAction {
  id: string;
  sourceType: string;
  title: string;
  description: string | null;
  responsibility: Responsibility;
  owner: string | null;
  reviewer: string | null;
  status: string;
  priority: string;
  dueAt: string | null;
  overdueDays: number | null;
  stage: string | null;
  costImpactCents: number | null;
  scheduleImpactDays: number | null;
  sourcePath: string;
}

export interface ReportRisk {
  id: string;
  sourceType: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  reason: string;
  owner: string | null;
  dueAt: string | null;
  mitigation: string | null;
  blocksAdvancement: boolean;
  sourcePath: string;
}

export interface ReportSource {
  sourceType: string;
  sourceId: string;
  sourceUpdatedAt: string;
  section: string;
  sourcePath: string;
}

export interface ClientStatusSnapshot {
  schemaVersion: 1;
  report: {
    clientId: string;
    projectId: string | null;
    inquiryId: string | null;
    asOfDate: string;
    displayTimeZone: string;
    generatedAt: string;
  };
  client: { name: string; company: string | null; status: string; property: string | null };
  context: {
    objective: string | null;
    description: string | null;
    preliminaryScope: string | null;
    budgetExpectation: string | null;
    desiredTiming: string | null;
  };
  executiveStatus: { state: ClientReportState; summary: string; reasons: string[]; nextMilestone: string | null };
  currentStage: { stage: string; status: string; owner: string | null; gateStatus: string | null; canAdvance: boolean; blockerCount: number };
  completedRecently: Array<{ id: string; sourceType: string; occurredAt: string; actor: string | null; eventType: string; description: string; sourcePath: string }>;
  actions: ReportAction[];
  decisions: Array<{ id: string; title: string; status: string; decisionMaker: string | null; requestedAt: string; dueAt: string | null; decidedAt: string | null; result: string | null; costImpact: number | null; scheduleImpact: string | null; sourcePath: string }>;
  risks: ReportRisk[];
  nextActions: ReportAction[];
  warnings: string[];
  sourceSummary: { total: number; byType: Record<string, number>; sourceFingerprint: string; sourceWatermark: string };
  sources: ReportSource[];
}

const TERMINAL_WORK = new Set(['VERIFIED', 'CLOSED', 'CANCELLED']);
const TERMINAL_DECISIONS = new Set(['APPROVED', 'REJECTED', 'CANCELLED']);
const COMPLETE_COMPLIANCE = new Set(['APPROVED', 'NOT_APPLICABLE']);
const COMPLETE_PRECONSTRUCTION = new Set(['VERIFIED', 'NOT_APPLICABLE', 'CANCELLED']);
const COMPLETE_PROCUREMENT = new Set(['CLOSED', 'CANCELLED']);
const STAGE_ORDER = ['INQUIRY', 'DESIGN', 'COMPLIANCE', 'PRE_CONSTRUCTION', 'PROCUREMENT'];

const validTimeZone = (value: string) => {
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date()); return value; }
  catch { return 'America/New_York'; }
};

export const getReportTimeZone = () => validTimeZone(process.env.ORGANIZATION_TIME_ZONE?.trim() || 'America/New_York');

const dateParts = (date: Date, timeZone: string) => Object.fromEntries(
  new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]),
) as Record<string, number>;

const localMidnightUtc = (isoDate: string, timeZone: string) => {
  const [year, month, day] = isoDate.split('-').map(Number);
  let candidate = new Date(Date.UTC(year, month - 1, day));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = dateParts(candidate, timeZone);
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const desired = Date.UTC(year, month - 1, day);
    candidate = new Date(candidate.getTime() + desired - represented);
  }
  return candidate;
};

export const reportDayBounds = (asOfDate: string, timeZone = getReportTimeZone()) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) throw new AppError('A valid as-of date is required.', 400, 'REPORT_INVALID_DATE');
  const [year, month, day] = asOfDate.split('-').map(Number);
  const normalized = new Date(Date.UTC(year, month - 1, day));
  if (normalized.getUTCFullYear() !== year || normalized.getUTCMonth() !== month - 1 || normalized.getUTCDate() !== day) {
    throw new AppError('A valid as-of date is required.', 400, 'REPORT_INVALID_DATE');
  }
  const next = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
  return { start: localMidnightUtc(asOfDate, timeZone), end: localMidnightUtc(next, timeZone), timeZone };
};

export const currentDateInZone = (timeZone = getReportTimeZone()) => {
  const parts = dateParts(new Date(), timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
};

const daysOverdue = (dueAt: Date | null, end: Date) => dueAt && dueAt < end
  ? Math.max(1, Math.floor((end.getTime() - dueAt.getTime()) / 86_400_000))
  : null;

const personName = (person: { name: string } | null | undefined) => person?.name || null;
const sourcePath = (clientId: string, projectId: string | null, type: string) => {
  if (projectId) {
    if (type === 'ComplianceRequirement') return `/projects/${projectId}/compliance`;
    if (type === 'PreconstructionItem' || type === 'ReadinessReview') return `/projects/${projectId}/preconstruction`;
    if (type === 'ProcurementRequest' || type === 'PurchaseOrder' || type === 'Delivery' || type === 'InvoiceMatch' || type === 'Substitution') return `/projects/${projectId}/procurement`;
    if (type === 'DesignVersion' || type === 'ScopeVersion') return `/projects/${projectId}/design`;
    return `/projects/${projectId}`;
  }
  return `/clients/${clientId}`;
};

const reportSource = (type: string, id: string, updatedAt: Date, section: string, clientId: string, projectId: string | null): ReportSource => ({
  sourceType: type, sourceId: id, sourceUpdatedAt: updatedAt.toISOString(), section,
  sourcePath: sourcePath(clientId, projectId, type),
});

const moneyNumber = (value: unknown): number | null => value == null ? null : Number(value);

export async function buildClientStatusSnapshot(input: {
  clientId: string;
  projectId?: string | null;
  inquiryId?: string | null;
  asOfDate: string;
}): Promise<{ snapshot: ClientStatusSnapshot; sourceWatermark: Date; sourceFingerprint: string }> {
  const { start, end, timeZone } = reportDayBounds(input.asOfDate);
  const effectiveAsOf = input.asOfDate === currentDateInZone(timeZone)
    ? new Date()
    : new Date(end.getTime() - 1);
  const client = await prisma.client.findFirst({ where: { id: input.clientId, deletedAt: null } });
  if (!client) throw new AppError('Client not found.', 404, 'REPORT_NOT_FOUND');
  if (!input.projectId && !input.inquiryId) throw new AppError('A project or inquiry is required.', 400, 'REPORT_SOURCE_CONFLICT');

  let project = input.projectId ? await prisma.poolProject.findFirst({ where: { id: input.projectId, clientId: client.id } }) : null;
  let inquiry = input.inquiryId ? await prisma.inquiry.findFirst({ where: { id: input.inquiryId, clientId: client.id }, include: { property: true, owner: { select: { name: true } } } }) : null;
  if (input.projectId && !project) throw new AppError('Project not found for this client.', 404, 'REPORT_NOT_FOUND');
  if (input.inquiryId && !inquiry) throw new AppError('Inquiry not found for this client.', 404, 'REPORT_NOT_FOUND');
  if (project && inquiry && inquiry.projectId !== project.id) throw new AppError('The inquiry and project are not related.', 409, 'REPORT_SOURCE_CONFLICT');
  if (project && !inquiry) inquiry = await prisma.inquiry.findFirst({ where: { clientId: client.id, projectId: project.id }, include: { property: true, owner: { select: { name: true } } }, orderBy: { createdAt: 'desc' } });
  if (inquiry?.projectId && !project) project = await prisma.poolProject.findFirst({ where: { id: inquiry.projectId, clientId: client.id } });

  const projectId = project?.id || null;
  const inquiryId = inquiry?.id || null;
  const relatedWhere = { OR: [projectId ? { projectId } : undefined, inquiryId ? { inquiryId } : undefined].filter(Boolean) } as any;

  const [stages, gates, workItems, decisions, approvals, compliance, complianceExceptions, preconstruction, readinessReviews, readinessExceptions, procurement, communications, consultations, documents] = await Promise.all([
    projectId ? prisma.lifecycleStage.findMany({ where: { projectId }, include: { owner: { select: { name: true } } } }) : [],
    projectId ? prisma.projectGate.findMany({ where: { projectId }, include: { reviewer: { select: { name: true } }, approver: { select: { name: true } } } }) : [],
    prisma.workItem.findMany({ where: { deletedAt: null, ...relatedWhere }, include: { owner: { select: { name: true, role: true } }, reviewer: { select: { name: true } } } }),
    projectId ? prisma.decision.findMany({ where: { projectId }, include: { decisionMaker: { select: { name: true, role: true } }, requester: { select: { name: true } } } }) : [],
    projectId ? prisma.approval.findMany({ where: { projectId }, include: { approver: { select: { name: true } } } }) : [],
    projectId ? prisma.complianceRequirement.findMany({ where: { projectId }, include: { owner: { select: { name: true } }, reviewer: { select: { name: true } } } }) : [],
    projectId ? prisma.complianceException.findMany({ where: { projectId }, include: { owner: { select: { name: true } } } }) : [],
    projectId ? prisma.preconstructionItem.findMany({ where: { projectId }, include: { owner: { select: { name: true } }, reviewer: { select: { name: true } } } }) : [],
    projectId ? prisma.readinessReview.findMany({ where: { projectId }, include: { reviewer: { select: { name: true } } } }) : [],
    projectId ? prisma.readinessException.findMany({ where: { projectId }, include: { owner: { select: { name: true } } } }) : [],
    projectId ? prisma.procurementRequest.findMany({ where: { projectId }, include: { owner: { select: { name: true } }, purchaseOrder: { include: { vendor: true, deliveries: true, invoiceMatches: true } }, substitutions: true } }) : [],
    prisma.communication.findMany({ where: { clientId: client.id, deletedAt: null } }),
    prisma.consultation.findMany({ where: { clientId: client.id, deletedAt: null }, include: { user: { select: { name: true } } } }),
    prisma.document.findMany({ where: { clientId: client.id, deletedAt: null }, include: { user: { select: { name: true } } } }),
  ]);

  const currentStage = projectId ? stages.find((item) => item.stage === project?.currentLifecycleStage) || null : null;
  const currentGate = projectId ? gates.find((item) => item.fromStage === project?.currentLifecycleStage) || null : null;
  const currentStageKey = project?.currentLifecycleStage || 'INQUIRY';
  const currentStageIndex = STAGE_ORDER.indexOf(currentStageKey);
  const isCurrentlyActionable = (stage: string | null) => {
    const index = stage ? STAGE_ORDER.indexOf(stage) : -1;
    return index === -1 || currentStageIndex === -1 || index <= currentStageIndex;
  };
  const actions: ReportAction[] = [];

  if (inquiry?.nextAction && currentStageKey === 'INQUIRY') actions.push({
    id: inquiry.id, sourceType: 'Inquiry', title: inquiry.nextAction, description: inquiry.description,
    responsibility: 'INTERNAL', owner: personName(inquiry.owner), reviewer: null, status: 'OPEN',
    priority: inquiry.nextActionDueAt && inquiry.nextActionDueAt < effectiveAsOf ? 'HIGH' : 'NORMAL',
    dueAt: inquiry.nextActionDueAt?.toISOString() || null, overdueDays: daysOverdue(inquiry.nextActionDueAt, effectiveAsOf), stage: 'INQUIRY',
    costImpactCents: null, scheduleImpactDays: null, sourcePath: sourcePath(client.id, projectId, 'Inquiry'),
  });

  for (const item of workItems.filter((record) => !TERMINAL_WORK.has(record.status))) actions.push({
    id: item.id, sourceType: 'WorkItem', title: item.title, description: item.description,
    responsibility: item.clientVisible || item.owner?.role === 'CLIENT' ? 'CLIENT' : 'INTERNAL', owner: personName(item.owner), reviewer: personName(item.reviewer),
    status: item.status, priority: item.priority, dueAt: item.dueAt?.toISOString() || null, overdueDays: daysOverdue(item.dueAt, effectiveAsOf), stage: item.stage,
    costImpactCents: null, scheduleImpactDays: null, sourcePath: sourcePath(client.id, projectId, 'WorkItem'),
  });
  for (const item of compliance.filter((record) => record.required && !COMPLETE_COMPLIANCE.has(record.status))) actions.push({
    id: item.id, sourceType: 'ComplianceRequirement', title: item.description, description: item.externalAgency || item.jurisdiction,
    responsibility: ['PENDING_EXTERNAL', 'PENDING_EXTERNAL_RESPONSE'].includes(item.status) ? 'EXTERNAL' : item.clientVisible ? 'CLIENT' : 'INTERNAL', owner: personName(item.owner), reviewer: personName(item.reviewer),
    status: item.status, priority: item.dueAt && item.dueAt < effectiveAsOf ? 'HIGH' : 'NORMAL', dueAt: item.dueAt?.toISOString() || null, overdueDays: daysOverdue(item.dueAt, effectiveAsOf), stage: 'COMPLIANCE',
    costImpactCents: null, scheduleImpactDays: null, sourcePath: sourcePath(client.id, projectId, 'ComplianceRequirement'),
  });
  for (const item of preconstruction.filter((record) => record.required && !COMPLETE_PRECONSTRUCTION.has(record.status))) actions.push({
    id: item.id, sourceType: 'PreconstructionItem', title: item.title, description: item.details,
    responsibility: /client/i.test(item.responsibilityParty || '') || item.clientVisible ? 'CLIENT' : /vendor|engineer|hoa|municip|inspector|external/i.test(item.responsibilityParty || '') ? 'EXTERNAL' : 'INTERNAL',
    owner: personName(item.owner), reviewer: personName(item.reviewer), status: item.status, priority: item.dueAt && item.dueAt < effectiveAsOf ? 'HIGH' : 'NORMAL',
    dueAt: item.dueAt?.toISOString() || null, overdueDays: daysOverdue(item.dueAt, effectiveAsOf), stage: 'PRE_CONSTRUCTION', costImpactCents: item.amountCents,
    scheduleImpactDays: null, sourcePath: sourcePath(client.id, projectId, 'PreconstructionItem'),
  });
  for (const item of procurement.filter((record) => record.required && !COMPLETE_PROCUREMENT.has(record.status))) actions.push({
    id: item.id, sourceType: 'ProcurementRequest', title: item.description, description: item.specification,
    responsibility: 'INTERNAL', owner: personName(item.owner), reviewer: null, status: item.status, priority: item.requiredBy < effectiveAsOf ? 'HIGH' : 'NORMAL',
    dueAt: item.requiredBy.toISOString(), overdueDays: daysOverdue(item.requiredBy, effectiveAsOf), stage: 'PROCUREMENT', costImpactCents: item.estimatedCostCents,
    scheduleImpactDays: null, sourcePath: sourcePath(client.id, projectId, 'ProcurementRequest'),
  });
  for (const item of decisions.filter((record) => !TERMINAL_DECISIONS.has(record.status))) actions.push({
    id: item.id, sourceType: 'Decision', title: item.title, description: item.description,
    responsibility: item.decisionMaker?.role === 'CLIENT' ? 'CLIENT' : 'LEADERSHIP', owner: personName(item.decisionMaker), reviewer: personName(item.requester),
    status: item.status, priority: item.dueAt && item.dueAt < effectiveAsOf ? 'HIGH' : 'NORMAL', dueAt: item.dueAt?.toISOString() || null, overdueDays: daysOverdue(item.dueAt, effectiveAsOf), stage: item.stage,
    costImpactCents: item.costImpact == null ? null : Math.round(Number(item.costImpact) * 100), scheduleImpactDays: item.scheduleImpact ? Number.parseInt(item.scheduleImpact, 10) || null : null,
    sourcePath: sourcePath(client.id, projectId, 'Decision'),
  });

  actions.sort((a, b) => Number(isCurrentlyActionable(b.stage)) - Number(isCurrentlyActionable(a.stage)) || (b.overdueDays || 0) - (a.overdueDays || 0) || (a.dueAt || '9999').localeCompare(b.dueAt || '9999'));
  const activeActions = actions.filter((item) => isCurrentlyActionable(item.stage));

  const risks: ReportRisk[] = [];
  for (const gate of gates.filter((item) => item.status === 'BLOCKED' || item.blockerCount > 0)) risks.push({
    id: gate.id, sourceType: 'ProjectGate', severity: 'HIGH', category: 'Stage gate', reason: `${gate.fromStage} to ${gate.toStage} has ${gate.blockerCount} blocker${gate.blockerCount === 1 ? '' : 's'}.`,
    owner: personName(gate.reviewer), dueAt: gate.overrideDueAt?.toISOString() || null, mitigation: gate.overrideMitigation, blocksAdvancement: true, sourcePath: sourcePath(client.id, projectId, 'ProjectGate'),
  });
  for (const item of actions.filter((action) => action.overdueDays != null)) risks.push({
    id: item.id, sourceType: item.sourceType, severity: item.priority === 'HIGH' ? 'HIGH' : 'MEDIUM', category: 'Overdue action', reason: `${item.title} is overdue by ${item.overdueDays} day${item.overdueDays === 1 ? '' : 's'}.`,
    owner: item.owner, dueAt: item.dueAt, mitigation: null, blocksAdvancement: item.sourceType === 'ComplianceRequirement' || item.sourceType === 'PreconstructionItem', sourcePath: item.sourcePath,
  });
  for (const item of complianceExceptions.filter((record) => record.status !== 'APPROVED')) risks.push({ id: item.id, sourceType: 'ComplianceException', severity: 'HIGH', category: 'Compliance exception', reason: item.risk, owner: personName(item.owner), dueAt: item.dueAt.toISOString(), mitigation: item.mitigation, blocksAdvancement: true, sourcePath: sourcePath(client.id, projectId, 'ComplianceRequirement') });
  for (const item of readinessExceptions.filter((record) => record.status !== 'APPROVED' || record.dueAt < effectiveAsOf)) risks.push({ id: item.id, sourceType: 'ReadinessException', severity: item.highRisk ? 'HIGH' : 'MEDIUM', category: 'Readiness exception', reason: item.risk, owner: personName(item.owner), dueAt: item.dueAt.toISOString(), mitigation: item.mitigation, blocksAdvancement: item.highRisk, sourcePath: sourcePath(client.id, projectId, 'PreconstructionItem') });
  for (const request of procurement) {
    for (const match of request.purchaseOrder?.invoiceMatches.filter((item) => item.status === 'VARIANCE') || []) risks.push({ id: match.id, sourceType: 'InvoiceMatch', severity: 'MEDIUM', category: 'Invoice variance', reason: `Invoice ${match.invoiceReference} differs by ${match.varianceAmountCents} cents.`, owner: personName(request.owner), dueAt: null, mitigation: null, blocksAdvancement: false, sourcePath: sourcePath(client.id, projectId, 'InvoiceMatch') });
    for (const delivery of request.purchaseOrder?.deliveries.filter((item) => item.inspectionStatus === 'FAILED') || []) risks.push({ id: delivery.id, sourceType: 'Delivery', severity: 'HIGH', category: 'Delivery inspection', reason: delivery.inspectionNotes || 'A delivery failed inspection.', owner: personName(request.owner), dueAt: delivery.expectedAt?.toISOString() || null, mitigation: null, blocksAdvancement: true, sourcePath: sourcePath(client.id, projectId, 'Delivery') });
  }

  const sourceRecords: ReportSource[] = [reportSource('Client', client.id, client.updatedAt, 'CONTEXT', client.id, projectId)];
  if (project) sourceRecords.push(reportSource('PoolProject', project.id, project.updatedAt, 'STAGE', client.id, projectId));
  if (inquiry) sourceRecords.push(reportSource('Inquiry', inquiry.id, inquiry.updatedAt, 'CONTEXT', client.id, projectId));
  for (const item of stages) sourceRecords.push(reportSource('LifecycleStage', item.id, item.updatedAt, 'STAGE', client.id, projectId));
  for (const item of gates) sourceRecords.push(reportSource('ProjectGate', item.id, item.updatedAt, 'RISKS', client.id, projectId));
  for (const item of workItems) sourceRecords.push(reportSource('WorkItem', item.id, item.updatedAt, 'ACTIONS', client.id, projectId));
  for (const item of decisions) sourceRecords.push(reportSource('Decision', item.id, item.updatedAt, 'DECISIONS', client.id, projectId));
  for (const item of approvals) sourceRecords.push(reportSource('Approval', item.id, item.createdAt, 'DECISIONS', client.id, projectId));
  for (const item of compliance) sourceRecords.push(reportSource('ComplianceRequirement', item.id, item.updatedAt, 'ACTIONS', client.id, projectId));
  for (const item of complianceExceptions) sourceRecords.push(reportSource('ComplianceException', item.id, item.updatedAt, 'RISKS', client.id, projectId));
  for (const item of preconstruction) sourceRecords.push(reportSource('PreconstructionItem', item.id, item.updatedAt, 'ACTIONS', client.id, projectId));
  for (const item of readinessReviews) sourceRecords.push(reportSource('ReadinessReview', item.id, item.updatedAt, 'STAGE', client.id, projectId));
  for (const item of readinessExceptions) sourceRecords.push(reportSource('ReadinessException', item.id, item.updatedAt, 'RISKS', client.id, projectId));
  for (const item of procurement) {
    sourceRecords.push(reportSource('ProcurementRequest', item.id, item.updatedAt, 'ACTIONS', client.id, projectId));
    if (item.purchaseOrder) {
      sourceRecords.push(reportSource('PurchaseOrder', item.purchaseOrder.id, item.purchaseOrder.updatedAt, 'ACTIVITY', client.id, projectId));
      for (const delivery of item.purchaseOrder.deliveries) sourceRecords.push(reportSource('Delivery', delivery.id, delivery.createdAt, 'ACTIVITY', client.id, projectId));
      for (const match of item.purchaseOrder.invoiceMatches) sourceRecords.push(reportSource('InvoiceMatch', match.id, match.updatedAt, 'RISKS', client.id, projectId));
    }
    for (const substitution of item.substitutions) sourceRecords.push(reportSource('Substitution', substitution.id, substitution.updatedAt, 'DECISIONS', client.id, projectId));
  }
  for (const item of communications) sourceRecords.push(reportSource('Communication', item.id, item.createdAt, 'ACTIVITY', client.id, projectId));
  for (const item of consultations) sourceRecords.push(reportSource('Consultation', item.id, item.updatedAt, 'ACTIVITY', client.id, projectId));
  for (const item of documents) sourceRecords.push(reportSource('Document', item.id, item.createdAt, 'ACTIVITY', client.id, projectId));

  const sourceWatermark = new Date(Math.max(...sourceRecords.map((item) => new Date(item.sourceUpdatedAt).getTime())));
  const sourceFingerprint = crypto.createHash('sha256').update(JSON.stringify(sourceRecords
    .map(({ sourceType, sourceId, sourceUpdatedAt, section }) => ({ sourceType, sourceId, sourceUpdatedAt, section }))
    .sort((a, b) => `${a.sourceType}:${a.sourceId}:${a.section}`.localeCompare(`${b.sourceType}:${b.sourceId}:${b.section}`)))).digest('hex');

  const recentActivity: ClientStatusSnapshot['completedRecently'] = [];
  for (const item of communications.filter((record) => record.date >= start && record.date < end)) recentActivity.push({ id: item.id, sourceType: 'Communication', occurredAt: item.date.toISOString(), actor: null, eventType: item.direction, description: item.subject || item.body.slice(0, 180), sourcePath: sourcePath(client.id, projectId, 'Communication') });
  for (const item of consultations.filter((record) => record.date >= start && record.date < end)) recentActivity.push({ id: item.id, sourceType: 'Consultation', occurredAt: item.date.toISOString(), actor: item.user.name, eventType: item.status, description: item.outcome || item.title, sourcePath: sourcePath(client.id, projectId, 'Consultation') });
  for (const item of documents.filter((record) => record.createdAt >= start && record.createdAt < end)) recentActivity.push({ id: item.id, sourceType: 'Document', occurredAt: item.createdAt.toISOString(), actor: item.user.name, eventType: 'UPLOADED', description: item.description || item.originalName, sourcePath: sourcePath(client.id, projectId, 'Document') });
  for (const item of workItems.filter((record) => record.completedAt && record.completedAt >= start && record.completedAt < end)) recentActivity.push({ id: item.id, sourceType: 'WorkItem', occurredAt: item.completedAt!.toISOString(), actor: personName(item.owner), eventType: item.status, description: item.title, sourcePath: sourcePath(client.id, projectId, 'WorkItem') });
  for (const item of approvals.filter((record) => record.createdAt >= start && record.createdAt < end)) recentActivity.push({ id: item.id, sourceType: 'Approval', occurredAt: item.createdAt.toISOString(), actor: item.approver.name, eventType: item.result, description: item.approvalType, sourcePath: sourcePath(client.id, projectId, 'Approval') });
  recentActivity.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  const warnings: string[] = [];
  if (!inquiry?.objectives && !inquiry?.description) warnings.push('The client objective is not recorded.');
  if (!currentStage && project) warnings.push('The project has no matching current lifecycle stage record.');
  if (activeActions.some((item) => !item.owner && item.responsibility !== 'EXTERNAL')) warnings.push('One or more current actions have no assigned owner.');
  if (project && activeActions.length === 0) warnings.push('No current-stage next action is recorded.');
  if (inquiry && !inquiry.nextAction && !project) warnings.push('The inquiry has no recorded next action.');

  const reasons: string[] = [];
  let state: ClientReportState = 'NO_ACTIVE_WORK';
  if (risks.some((item) => item.blocksAdvancement && item.severity === 'HIGH')) { state = 'BLOCKED'; reasons.push(risks.find((item) => item.blocksAdvancement && item.severity === 'HIGH')!.reason); }
  else if (risks.length || activeActions.some((item) => item.priority === 'HIGH') || warnings.length) { state = 'ATTENTION_REQUIRED'; reasons.push(risks[0]?.reason || warnings[0] || 'A high-priority action requires attention.'); }
  else if (activeActions.length) { state = 'ON_TRACK'; reasons.push('Active work is assigned with no recorded blocker or overdue requirement.'); }
  else reasons.push('No active action is recorded for this client or project.');

  const nextActions = activeActions.slice(0, 5);
  const stageName = currentStageKey;
  const nextMilestone = currentGate ? `${currentGate.fromStage} to ${currentGate.toStage}` : inquiry?.nextAction || null;
  const primaryReason = reasons[0];
  const summary = `${client.name} is currently in ${stageName.replace(/_/g, ' ').toLowerCase()}. ${primaryReason}${nextMilestone ? ` The next milestone is ${nextMilestone.replace(/_/g, ' ').toLowerCase()}.` : ''}`;
  const byType: Record<string, number> = {};
  for (const item of sourceRecords) byType[item.sourceType] = (byType[item.sourceType] || 0) + 1;

  const snapshot: ClientStatusSnapshot = {
    schemaVersion: 1,
    report: { clientId: client.id, projectId, inquiryId, asOfDate: input.asOfDate, displayTimeZone: timeZone, generatedAt: new Date().toISOString() },
    client: { name: client.name, company: client.company, status: client.status, property: inquiry?.property ? [inquiry.property.address, inquiry.property.city, inquiry.property.state, inquiry.property.postalCode].filter(Boolean).join(', ') : client.address },
    context: { objective: inquiry?.objectives || null, description: inquiry?.description || null, preliminaryScope: inquiry?.preliminaryScope || project?.notes || null, budgetExpectation: inquiry?.budgetExpectation || project?.estimatedBudget || null, desiredTiming: inquiry?.desiredTiming || null },
    executiveStatus: { state, summary, reasons, nextMilestone },
    currentStage: { stage: stageName, status: currentStage?.status || inquiry?.qualificationStatus || project?.status || 'UNKNOWN', owner: personName(currentStage?.owner) || personName(inquiry?.owner), gateStatus: currentGate?.status || null, canAdvance: Boolean(currentGate && currentGate.blockerCount === 0 && !['BLOCKED', 'REJECTED'].includes(currentGate.status)), blockerCount: currentGate?.blockerCount || 0 },
    completedRecently: recentActivity,
    actions,
    decisions: decisions.map((item) => ({ id: item.id, title: item.title, status: item.status, decisionMaker: personName(item.decisionMaker), requestedAt: item.createdAt.toISOString(), dueAt: item.dueAt?.toISOString() || null, decidedAt: item.decidedAt?.toISOString() || null, result: item.selectedOption, costImpact: moneyNumber(item.costImpact), scheduleImpact: item.scheduleImpact, sourcePath: sourcePath(client.id, projectId, 'Decision') })),
    risks,
    nextActions,
    warnings,
    sourceSummary: { total: sourceRecords.length, byType, sourceFingerprint, sourceWatermark: sourceWatermark.toISOString() },
    sources: sourceRecords,
  };
  return { snapshot, sourceWatermark, sourceFingerprint };
}

export const parseSnapshot = (value: string): ClientStatusSnapshot => JSON.parse(value) as ClientStatusSnapshot;
