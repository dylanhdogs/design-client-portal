export const RECEPTION_WORKFLOW_VERSION = 1;

export type ReceptionRequirementClass = 'BLOCKING' | 'DEFERRABLE' | 'OPTIONAL';
export type ReceptionAnswerState = 'CONFIRMED' | 'PRELIMINARY' | 'UNKNOWN' | 'NOT_APPLICABLE' | 'NEEDS_REVIEW';
export type ReceptionPhaseId = 'INITIAL_CONTACT' | 'PRE_DESIGN_DISCOVERY' | 'SITE_MEETINGS_ROM' | 'ROM_HANDOFF';

export interface ReceptionCriterionDefinition {
  id: string;
  phase: ReceptionPhaseId;
  label: string;
  requirement: ReceptionRequirementClass;
  fieldPaths: string[];
  notApplicableAllowed?: boolean;
}

export const RECEPTION_PHASES: Array<{ id: ReceptionPhaseId; label: string }> = [
  { id: 'INITIAL_CONTACT', label: 'Initial Contact Made' },
  { id: 'PRE_DESIGN_DISCOVERY', label: 'Pre-Design Discovery' },
  { id: 'SITE_MEETINGS_ROM', label: 'Site Meetings & ROM Preparation' },
  { id: 'ROM_HANDOFF', label: 'ROM Approval & Design Handoff' },
];

// Stable IDs are persisted; labels and field paths are presentation/mapping metadata only.
export const RECEPTION_CRITERIA: ReceptionCriterionDefinition[] = [
  { id: 'CONTACT_IDENTITY', phase: 'INITIAL_CONTACT', label: 'Client identity', requirement: 'BLOCKING', fieldPaths: ['client.name'] },
  { id: 'CONTACT_METHOD', phase: 'INITIAL_CONTACT', label: 'At least one contact method', requirement: 'BLOCKING', fieldPaths: ['client.email', 'client.phone'] },
  { id: 'INCOMING_CHANNEL', phase: 'INITIAL_CONTACT', label: 'Original incoming channel', requirement: 'BLOCKING', fieldPaths: ['inquiry.source'] },
  { id: 'RECEPTION_OWNER', phase: 'INITIAL_CONTACT', label: 'Active Reception owner', requirement: 'BLOCKING', fieldPaths: ['inquiry.ownerId'] },
  { id: 'INITIAL_NEXT_ACTION', phase: 'INITIAL_CONTACT', label: 'Next action and due date', requirement: 'BLOCKING', fieldPaths: ['inquiry.nextAction', 'inquiry.nextActionDueAt'] },
  { id: 'PROPERTY_IDENTIFIED', phase: 'INITIAL_CONTACT', label: 'Property identified or explicitly deferred', requirement: 'DEFERRABLE', fieldPaths: ['property.address'] },

  { id: 'PROJECT_TYPE', phase: 'PRE_DESIGN_DISCOVERY', label: 'Project type', requirement: 'BLOCKING', fieldPaths: ['discovery.projectType'] },
  { id: 'PRIMARY_USE', phase: 'PRE_DESIGN_DISCOVERY', label: 'Primary use', requirement: 'BLOCKING', fieldPaths: ['discovery.primaryUse'] },
  { id: 'DESIRED_OUTCOME', phase: 'PRE_DESIGN_DISCOVERY', label: 'Desired outcome', requirement: 'BLOCKING', fieldPaths: ['inquiry.objectives'] },
  { id: 'DECISION_MAKERS', phase: 'PRE_DESIGN_DISCOVERY', label: 'Decision makers and approval path', requirement: 'BLOCKING', fieldPaths: ['discovery.decisionMakers'] },
  { id: 'PROPERTY_ACCESS', phase: 'PRE_DESIGN_DISCOVERY', label: 'Property access', requirement: 'DEFERRABLE', fieldPaths: ['discovery.propertyAccess'] },
  { id: 'REPORTED_SITE_CONDITIONS', phase: 'PRE_DESIGN_DISCOVERY', label: 'Reported site conditions', requirement: 'DEFERRABLE', fieldPaths: ['discovery.siteConditions'] },
  { id: 'UTILITIES', phase: 'PRE_DESIGN_DISCOVERY', label: 'Utilities and easements', requirement: 'DEFERRABLE', fieldPaths: ['discovery.utilities'] },
  { id: 'SURVEY_STATUS', phase: 'PRE_DESIGN_DISCOVERY', label: 'Survey status', requirement: 'DEFERRABLE', fieldPaths: ['discovery.surveyStatus'], notApplicableAllowed: true },
  { id: 'MUST_HAVE_FEATURES', phase: 'PRE_DESIGN_DISCOVERY', label: 'Must-have features or none identified', requirement: 'BLOCKING', fieldPaths: ['discovery.mustHaveFeatures'] },
  { id: 'QUALIFICATION_APPROVAL', phase: 'PRE_DESIGN_DISCOVERY', label: 'Admin qualification approval', requirement: 'BLOCKING', fieldPaths: ['inquiry.qualificationStatus'] },
  { id: 'INSPIRATION_STATUS', phase: 'PRE_DESIGN_DISCOVERY', label: 'Design inspiration or none provided', requirement: 'BLOCKING', fieldPaths: ['inquiry.designInspirations'] },
  { id: 'SITE_MEETING_SCHEDULED', phase: 'PRE_DESIGN_DISCOVERY', label: 'Onsite consultation scheduled', requirement: 'BLOCKING', fieldPaths: ['consultations.meetingMode', 'consultations.date'] },
  { id: 'BUDGET_EXPECTATION', phase: 'PRE_DESIGN_DISCOVERY', label: 'Budget expectation', requirement: 'DEFERRABLE', fieldPaths: ['inquiry.budgetExpectation'] },
  { id: 'DESIRED_TIMING', phase: 'PRE_DESIGN_DISCOVERY', label: 'Desired timing', requirement: 'DEFERRABLE', fieldPaths: ['inquiry.desiredTiming'] },

  { id: 'SITE_MEETING_OUTCOME', phase: 'SITE_MEETINGS_ROM', label: 'Completed onsite meeting with outcome', requirement: 'BLOCKING', fieldPaths: ['consultations.meetingMode', 'consultations.status', 'consultations.outcome'] },
  { id: 'SITE_ASSESSMENT', phase: 'SITE_MEETINGS_ROM', label: 'Onsite assessment or no known constraints', requirement: 'BLOCKING', fieldPaths: ['inquiry.siteAssessment'] },
  { id: 'SITE_EVIDENCE', phase: 'SITE_MEETINGS_ROM', label: 'Site evidence (optional)', requirement: 'OPTIONAL', fieldPaths: ['inquiry.evidence'] },
  { id: 'CLIENT_REQUESTS', phase: 'SITE_MEETINGS_ROM', label: 'Required client requests resolved or deferred', requirement: 'BLOCKING', fieldPaths: ['inquiry.workItems'] },

  { id: 'PRELIMINARY_ROM', phase: 'ROM_HANDOFF', label: 'Preliminary ROM range recorded', requirement: 'BLOCKING', fieldPaths: ['inquiry.romAmount'] },
  { id: 'PRELIMINARY_BRIEF', phase: 'ROM_HANDOFF', label: 'Revision-bound ROM brief reviewed and saved', requirement: 'BLOCKING', fieldPaths: ['inquiry.handoffReview.romPreviewSnapshot'] },
  { id: 'PROPOSAL_PRESENTED_AT', phase: 'ROM_HANDOFF', label: 'ROM presentation date recorded', requirement: 'BLOCKING', fieldPaths: ['inquiry.proposalProvidedAt'] },
  { id: 'ROM_APPROVAL', phase: 'ROM_HANDOFF', label: 'ROM explicitly approved', requirement: 'BLOCKING', fieldPaths: ['inquiry.romStatus', 'inquiry.romDecisionAt', 'inquiry.romApprovedBy'] },
  { id: 'DESIGN_AGREEMENT', phase: 'ROM_HANDOFF', label: 'Design agreement accepted or Admin-marked not required', requirement: 'BLOCKING', fieldPaths: ['inquiry.designAgreementStatus'] },
  { id: 'CLIENT_DISPOSITION', phase: 'ROM_HANDOFF', label: 'Admin-reviewed client disposition', requirement: 'BLOCKING', fieldPaths: ['inquiry.clientDisposition'] },
  { id: 'HANDOFF_REVIEW', phase: 'ROM_HANDOFF', label: 'Current-revision handoff review approved', requirement: 'BLOCKING', fieldPaths: ['inquiry.handoffReview'] },
];

export interface ReceptionCriterionStateRecord {
  criterionId: string;
  answerState: ReceptionAnswerState;
  reason?: string | null;
  source?: string | null;
  updatedBy?: string | null;
  updatedAt?: Date | string | null;
}

export interface ReceptionCriterionResult extends ReceptionCriterionDefinition {
  answerState: ReceptionAnswerState;
  source: string;
  reason: string | null;
  hasAnswer: boolean;
  complete: boolean;
  deferred: boolean;
  blocker: string | null;
}

export interface ReceptionPhaseResult {
  id: ReceptionPhaseId;
  label: string;
  state: 'IN_PROGRESS' | 'READY_WITH_DEFERRED_ITEMS' | 'COMPLETE';
  criteria: ReceptionCriterionResult[];
  blockers: ReceptionCriterionResult[];
  deferred: ReceptionCriterionResult[];
}

const incomingChannels = new Set(['PHONE', 'SMS', 'EMAIL', 'WEBSITE', 'REFERRAL', 'WALK_IN', 'OTHER']);
const projectTypes = new Set(['New pool and spa', 'New pool only', 'Pool renovation', 'Outdoor living addition']);
const primaryUses = new Set(['Family recreation', 'Entertainment', 'Exercise and wellness', 'Relaxation', 'Pool parties and guests']);
const decisionPaths = new Set(['Client only', 'Spouse or partner', 'Joint family decision', 'Property owner and representative', 'Multiple owners']);
const propertyAccessOptions = new Set(['Easy equipment access', 'Through side yard', 'Through home or garage', 'Crane or special access may be needed']);
const siteConditionOptions = new Set(['Flat grade', 'Sloped grade', 'Drainage concern', 'Rock or hard soil concern', 'Retaining wall concern', 'Existing pool or structure']);
const utilityOptions = new Set(['City water', 'Well water', 'Septic system', 'Gas service', 'Overhead power lines', 'Easement or utility constraint']);
const surveyOptions = new Set(['Current survey available', 'Survey exists but needs verification', 'Survey must be ordered']);
const featureOptions = new Set(['Spa', 'Tanning ledge', 'Baja shelf', 'Water feature', 'Fire feature', 'Swim-up bar', 'Pool cover', 'Heating', 'Automation', 'Safety cover or fence']);

const nonAnswerSentinels = new Set([
  'not yet determined', 'not sure yet', 'not decided yet', 'not discussed yet',
  'access needs site review', 'no known concerns yet', 'no known constraints yet',
]);

const clean = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const normalized = (value: string) => value.trim().toLocaleLowerCase('en-US');
const hasValue = (value: unknown) => {
  if (typeof value === 'string') return Boolean(value.trim());
  if (typeof value === 'number') return Number.isFinite(value);
  if (value instanceof Date) return Number.isFinite(value.getTime());
  return Boolean(value);
};
const asTokens = (value: unknown) => Array.isArray(value)
  ? value.map(clean).filter(Boolean)
  : clean(value).split(',').map((part) => part.trim()).filter(Boolean);

function answerPresent(inquiry: any, criterionId: string): boolean {
  const discovery = inquiry.discovery || {};
  const consultations = Array.isArray(inquiry.consultations) ? inquiry.consultations : [];
  const workItems = Array.isArray(inquiry.workItems) ? inquiry.workItems : [];
  switch (criterionId) {
    case 'CONTACT_IDENTITY': return Boolean(clean(inquiry.client?.name));
    case 'CONTACT_METHOD': return Boolean(clean(inquiry.client?.email) || clean(inquiry.client?.phone));
    case 'INCOMING_CHANNEL': return incomingChannels.has(clean(inquiry.source).toUpperCase());
    case 'RECEPTION_OWNER': return inquiry.owner?.role === 'ADMIN' && inquiry.owner?.active === true;
    case 'INITIAL_NEXT_ACTION': return Boolean(clean(inquiry.nextAction) && hasValue(inquiry.nextActionDueAt));
    case 'PROPERTY_IDENTIFIED': return Boolean(clean(inquiry.property?.address));
    case 'PROJECT_TYPE': return projectTypes.has(clean(discovery.projectType));
    case 'PRIMARY_USE': return primaryUses.has(clean(discovery.primaryUse));
    case 'DESIRED_OUTCOME': return Boolean(clean(inquiry.objectives));
    case 'DECISION_MAKERS': return decisionPaths.has(clean(discovery.decisionMakers));
    case 'PROPERTY_ACCESS': return propertyAccessOptions.has(clean(discovery.propertyAccess));
    case 'REPORTED_SITE_CONDITIONS': {
      const tokens = asTokens(discovery.siteConditions);
      return tokens.length > 0 && tokens.every((token) => siteConditionOptions.has(token));
    }
    case 'UTILITIES': {
      const tokens = asTokens(discovery.utilities);
      return tokens.length > 0 && tokens.every((token) => utilityOptions.has(token));
    }
    case 'SURVEY_STATUS': return surveyOptions.has(clean(discovery.surveyStatus));
    case 'MUST_HAVE_FEATURES': {
      const tokens = asTokens(discovery.mustHaveFeatures);
      return tokens.length > 0 && (tokens.includes('NONE_IDENTIFIED') || tokens.every((token) => featureOptions.has(token)));
    }
    case 'QUALIFICATION_APPROVAL': return inquiry.qualificationStatus === 'QUALIFIED';
    case 'INSPIRATION_STATUS': return Boolean(clean(inquiry.designInspirations));
    case 'SITE_MEETING_SCHEDULED': return consultations.some((item: any) => ['SCHEDULED', 'COMPLETED'].includes(item.status) && item.meetingMode === 'ONSITE' && hasValue(item.date));
    case 'BUDGET_EXPECTATION': return Boolean(clean(inquiry.budgetExpectation));
    case 'DESIRED_TIMING': return Boolean(clean(inquiry.desiredTiming));
    case 'SITE_MEETING_OUTCOME': return consultations.some((item: any) => item.status === 'COMPLETED' && item.meetingMode === 'ONSITE' && Boolean(clean(item.outcome)));
    case 'SITE_ASSESSMENT': return Boolean(clean(inquiry.siteAssessment));
    case 'SITE_EVIDENCE': return Array.isArray(inquiry.evidence) && inquiry.evidence.length > 0;
    case 'CLIENT_REQUESTS': return workItems.every((item: any) => !item.clientVisible || ['VERIFIED', 'CLOSED', 'CANCELLED'].includes(item.status));
    case 'PRELIMINARY_ROM': return Boolean(clean(inquiry.romAmount));
    case 'PRELIMINARY_BRIEF': return Boolean(inquiry.romPreviewSnapshot && inquiry.romPreviewHash
      && inquiry.romPreviewRevision === inquiry.intakeRevision
      && (clean(inquiry.proposalNarrative) || clean(inquiry.description) || clean(inquiry.objectives) || clean(inquiry.preliminaryScope))
      && clean(inquiry.romAmount));
    case 'PROPOSAL_PRESENTED_AT': return hasValue(inquiry.proposalProvidedAt);
    case 'ROM_APPROVAL': return inquiry.romStatus === 'APPROVED' && hasValue(inquiry.romDecisionAt) && Boolean(inquiry.romApprovedBy);
    case 'DESIGN_AGREEMENT': return inquiry.designAgreementStatus === 'ACCEPTED'
      ? hasValue(inquiry.designAgreementAcceptedAt) && Boolean(inquiry.designAgreementAcceptedBy)
      : inquiry.designAgreementStatus === 'NOT_REQUIRED'
        && Boolean(inquiry.criterionStates?.find((state: ReceptionCriterionStateRecord) => state.criterionId === 'DESIGN_AGREEMENT')?.reason)
        && Boolean(inquiry.criterionStates?.find((state: ReceptionCriterionStateRecord) => state.criterionId === 'DESIGN_AGREEMENT')?.updatedBy)
        && Boolean(inquiry.criterionStates?.find((state: ReceptionCriterionStateRecord) => state.criterionId === 'DESIGN_AGREEMENT')?.updatedAt);
    case 'CLIENT_DISPOSITION': return inquiry.clientDisposition === 'PROCEED_TO_DESIGN'
      && inquiry.clientDispositionReviewStatus === 'REVIEWED'
      && Boolean(inquiry.clientDispositionAt && inquiry.clientDispositionRecordedBy && inquiry.clientDispositionReviewedAt && inquiry.clientDispositionReviewedBy && inquiry.clientDispositionEvidenceActivityId);
    case 'HANDOFF_REVIEW': return inquiry.handoffReview?.result === 'APPROVED'
      && inquiry.handoffReview.intakeRevision === inquiry.intakeRevision
      && inquiry.handoffReview.workflowVersion === RECEPTION_WORKFLOW_VERSION
      && Boolean(inquiry.romPreviewHash && inquiry.handoffReview.romPreviewHash === inquiry.romPreviewHash);
    default: return false;
  }
}

export function hasReceptionCriterionAnswer(inquiry: any, criterionId: string) {
  return answerPresent(inquiry, criterionId);
}

function hasLegacyValue(inquiry: any, criterionId: string): boolean {
  const discovery = inquiry.discovery || {};
  const consultations = Array.isArray(inquiry.consultations) ? inquiry.consultations : [];
  const workItems = Array.isArray(inquiry.workItems) ? inquiry.workItems : [];
  switch (criterionId) {
    case 'CONTACT_IDENTITY': return Boolean(clean(inquiry.client?.name));
    case 'CONTACT_METHOD': return Boolean(clean(inquiry.client?.email) || clean(inquiry.client?.phone));
    case 'INCOMING_CHANNEL': return Boolean(clean(inquiry.source));
    case 'RECEPTION_OWNER': return Boolean(inquiry.ownerId);
    case 'INITIAL_NEXT_ACTION': return Boolean(clean(inquiry.nextAction) || hasValue(inquiry.nextActionDueAt));
    case 'PROPERTY_IDENTIFIED': return Boolean(clean(inquiry.property?.address));
    case 'PROJECT_TYPE': return Boolean(clean(discovery.projectType));
    case 'PRIMARY_USE': return Boolean(clean(discovery.primaryUse));
    case 'DESIRED_OUTCOME': return Boolean(clean(inquiry.objectives));
    case 'DECISION_MAKERS': return Boolean(clean(discovery.decisionMakers));
    case 'PROPERTY_ACCESS': return Boolean(clean(discovery.propertyAccess));
    case 'REPORTED_SITE_CONDITIONS': return asTokens(discovery.siteConditions).length > 0;
    case 'UTILITIES': return asTokens(discovery.utilities).length > 0;
    case 'SURVEY_STATUS': return Boolean(clean(discovery.surveyStatus));
    case 'MUST_HAVE_FEATURES': return asTokens(discovery.mustHaveFeatures).length > 0;
    case 'QUALIFICATION_APPROVAL': return inquiry.qualificationStatus === 'QUALIFIED';
    case 'INSPIRATION_STATUS': return Boolean(clean(inquiry.designInspirations));
    case 'SITE_MEETING_SCHEDULED': return consultations.some((item: any) => ['SCHEDULED', 'COMPLETED'].includes(item.status) && (item.activityType === 'SITE_MEETING' || /site\s+meeting/i.test(item.title || '')));
    case 'BUDGET_EXPECTATION': return Boolean(clean(inquiry.budgetExpectation) || clean(discovery.budgetRange));
    case 'DESIRED_TIMING': return Boolean(clean(inquiry.desiredTiming) || clean(discovery.targetCompletion));
    case 'SITE_MEETING_OUTCOME': return consultations.some((item: any) => item.status === 'COMPLETED' && (item.activityType === 'SITE_MEETING' || /site\s+meeting/i.test(item.title || '')));
    case 'SITE_ASSESSMENT': return Boolean(clean(inquiry.siteAssessment));
    case 'SITE_EVIDENCE': return Array.isArray(inquiry.documents) && inquiry.documents.length > 0;
    case 'CLIENT_REQUESTS': return workItems.some((item: any) => item.clientVisible && !['VERIFIED', 'CLOSED', 'CANCELLED'].includes(item.status));
    case 'PRELIMINARY_ROM': return Boolean(clean(inquiry.romAmount));
    case 'PRELIMINARY_BRIEF': return Boolean(inquiry.handoffReview?.romPreviewSnapshot || clean(inquiry.romProposalDetails) || clean(inquiry.proposalNarrative));
    case 'PROPOSAL_PRESENTED_AT': return hasValue(inquiry.proposalProvidedAt);
    case 'ROM_APPROVAL': return Boolean(inquiry.romStatus || inquiry.romDecisionAt || inquiry.romApprovedBy);
    case 'DESIGN_AGREEMENT': return Boolean(inquiry.designAgreementStatus || inquiry.designAgreementAcceptedAt || inquiry.designAgreementAcceptedBy);
    case 'CLIENT_DISPOSITION': return Boolean(inquiry.clientDisposition || inquiry.clientDispositionEvidenceActivityId);
    case 'HANDOFF_REVIEW': return Boolean(inquiry.handoffReview);
    default: return false;
  }
}

function rawValues(inquiry: any, criterionId: string): string[] {
  const discovery = inquiry.discovery || {};
  switch (criterionId) {
    case 'PROJECT_TYPE': return [clean(discovery.projectType)];
    case 'PRIMARY_USE': return [clean(discovery.primaryUse)];
    case 'DECISION_MAKERS': return [clean(discovery.decisionMakers)];
    case 'PROPERTY_ACCESS': return [clean(discovery.propertyAccess)];
    case 'REPORTED_SITE_CONDITIONS': return asTokens(discovery.siteConditions);
    case 'UTILITIES': return asTokens(discovery.utilities);
    case 'SURVEY_STATUS': return [clean(discovery.surveyStatus)];
    case 'MUST_HAVE_FEATURES': return asTokens(discovery.mustHaveFeatures);
    case 'INCOMING_CHANNEL': return [clean(inquiry.source)];
    case 'BUDGET_EXPECTATION': return [clean(inquiry.budgetExpectation), clean(discovery.budgetRange)].filter(Boolean);
    case 'DESIRED_TIMING': return [clean(inquiry.desiredTiming), clean(discovery.targetCompletion)].filter(Boolean);
    default: return [];
  }
}

function inferredAnswerState(inquiry: any, criterionId: string, valuePresent: boolean, legacyReviewed: boolean): ReceptionAnswerState {
  if (criterionId === 'SURVEY_STATUS' && normalized(clean(inquiry.discovery?.surveyStatus)) === 'not applicable') return 'NEEDS_REVIEW';
  if (valuePresent) return legacyReviewed ? 'CONFIRMED' : 'NEEDS_REVIEW';
  const values = rawValues(inquiry, criterionId).map(normalized).filter(Boolean);
  if (values.length && values.every((value) => nonAnswerSentinels.has(value))) return 'UNKNOWN';
  if (hasLegacyValue(inquiry, criterionId)) return 'NEEDS_REVIEW';
  return 'UNKNOWN';
}

export function classifyReceptionCriterionAnswer(inquiry: any, criterionId: string): ReceptionAnswerState {
  return inferredAnswerState(inquiry, criterionId, answerPresent(inquiry, criterionId), true);
}

function parsedDiscovery(inquiry: any) {
  if (inquiry.discovery) return inquiry.discovery;
  if (typeof inquiry.discoveryData !== 'string') return {};
  try {
    const value = JSON.parse(inquiry.discoveryData);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}

export function receptionCriterionFingerprint(inquiry: any, criterionId: string): string {
  const discovery = parsedDiscovery(inquiry);
  const consultations = (inquiry.consultations || []).map((item: any) => [item.id, item.status, item.meetingMode, item.date, item.outcome, item.activityType, item.title]);
  const workItems = (inquiry.workItems || []).map((item: any) => [item.id, item.status, item.ownerId, item.dueAt, item.criterionId, item.clientVisible]);
  let value: unknown;
  switch (criterionId) {
    case 'CONTACT_IDENTITY': value = inquiry.client?.name; break;
    case 'CONTACT_METHOD': value = [inquiry.client?.email, inquiry.client?.phone]; break;
    case 'INCOMING_CHANNEL': value = inquiry.source; break;
    case 'RECEPTION_OWNER': value = [inquiry.ownerId, inquiry.owner?.role, inquiry.owner?.active]; break;
    case 'INITIAL_NEXT_ACTION': value = [inquiry.nextAction, inquiry.nextActionDueAt]; break;
    case 'PROPERTY_IDENTIFIED': value = inquiry.property?.address; break;
    case 'PROJECT_TYPE': value = discovery.projectType; break;
    case 'PRIMARY_USE': value = discovery.primaryUse; break;
    case 'DESIRED_OUTCOME': value = inquiry.objectives; break;
    case 'DECISION_MAKERS': value = discovery.decisionMakers; break;
    case 'PROPERTY_ACCESS': value = discovery.propertyAccess; break;
    case 'REPORTED_SITE_CONDITIONS': value = discovery.siteConditions; break;
    case 'UTILITIES': value = discovery.utilities; break;
    case 'SURVEY_STATUS': value = discovery.surveyStatus; break;
    case 'MUST_HAVE_FEATURES': value = discovery.mustHaveFeatures; break;
    case 'QUALIFICATION_APPROVAL': value = inquiry.qualificationStatus; break;
    case 'INSPIRATION_STATUS': value = inquiry.designInspirations; break;
    case 'SITE_MEETING_SCHEDULED': value = consultations; break;
    case 'BUDGET_EXPECTATION': value = [inquiry.budgetExpectation, discovery.budgetRange]; break;
    case 'DESIRED_TIMING': value = [inquiry.desiredTiming, discovery.targetCompletion]; break;
    case 'SITE_MEETING_OUTCOME': value = consultations; break;
    case 'SITE_ASSESSMENT': value = inquiry.siteAssessment; break;
    case 'SITE_EVIDENCE': value = (inquiry.documents || []).map((item: any) => [item.id, item.category]); break;
    case 'CLIENT_REQUESTS': value = workItems; break;
    case 'PRELIMINARY_ROM': value = inquiry.romAmount; break;
    case 'PRELIMINARY_BRIEF': value = [inquiry.romProposalDetails, inquiry.proposalNarrative, inquiry.handoffReview?.id]; break;
    case 'PROPOSAL_PRESENTED_AT': value = inquiry.proposalProvidedAt; break;
    case 'ROM_APPROVAL': value = [inquiry.romStatus, inquiry.romDecisionAt, inquiry.romApprovedBy]; break;
    case 'DESIGN_AGREEMENT': value = [inquiry.designAgreementStatus, inquiry.designAgreementAcceptedAt, inquiry.designAgreementAcceptedBy]; break;
    case 'CLIENT_DISPOSITION': value = [inquiry.clientDisposition, inquiry.clientDispositionAt, inquiry.clientDispositionRecordedBy]; break;
    case 'HANDOFF_REVIEW': value = inquiry.handoffReview?.id; break;
    default: value = null;
  }
  return JSON.stringify(value);
}

function hasValidFollowUp(inquiry: any, criterionId: string): boolean {
  return (inquiry.workItems || []).some((item: any) => item.criterionId === criterionId
    && !['VERIFIED', 'CLOSED', 'CANCELLED'].includes(item.status)
    && Boolean(item.ownerId && item.dueAt));
}

export function evaluateReceptionReadiness(inquiry: any) {
  const stateMap = new Map<string, ReceptionCriterionStateRecord>(
    (inquiry.criterionStates || []).map((state: ReceptionCriterionStateRecord) => [state.criterionId, state]),
  );
  const legacyReviewed = inquiry.legacyReviewStatus === 'REVIEWED';
  const results = RECEPTION_CRITERIA.map((definition): ReceptionCriterionResult => {
    const saved = stateMap.get(definition.id);
    const valuePresent = answerPresent(inquiry, definition.id);
    const inferredState = definition.id === 'CLIENT_REQUESTS' && !hasLegacyValue(inquiry, definition.id)
      ? 'CONFIRMED'
      : inferredAnswerState(inquiry, definition.id, valuePresent, legacyReviewed);
    const answerState = saved?.answerState || inferredState;
    const source = saved?.source || (legacyReviewed ? 'ADMIN' : valuePresent ? 'LEGACY_UNVERIFIED' : 'SYSTEM');
    const reason = saved?.reason || null;
    const validNotApplicable = answerState === 'NOT_APPLICABLE'
      && definition.notApplicableAllowed === true
      && Boolean(reason && saved?.updatedBy && saved?.updatedAt);
    const confirmed = answerState === 'CONFIRMED' && valuePresent;
    const deferred = answerState === 'UNKNOWN'
      && definition.requirement === 'DEFERRABLE'
      && hasValidFollowUp(inquiry, definition.id);
    const preliminaryAllowed = ['BUDGET_EXPECTATION', 'DESIRED_TIMING'].includes(definition.id)
      && answerState === 'PRELIMINARY' && valuePresent;
    const complete = definition.requirement === 'OPTIONAL'
      || confirmed
      || preliminaryAllowed
      || validNotApplicable
      || deferred;
    let blocker: string | null = null;
    if (!complete && definition.requirement !== 'OPTIONAL') {
      if (answerState === 'NEEDS_REVIEW') blocker = 'Review and confirm this existing answer before it can satisfy readiness.';
      else if (answerState === 'UNKNOWN' && definition.requirement === 'DEFERRABLE') blocker = 'Record the answer or link an owned follow-up with a due date.';
      else if (answerState === 'NOT_APPLICABLE') blocker = 'This criterion does not allow Not applicable, or its Admin reason/audit is incomplete.';
      else if (answerState === 'CONFIRMED' && !valuePresent) blocker = 'A confirmed answer is missing from its canonical inquiry field.';
      else if (answerState === 'PRELIMINARY' && !['BUDGET_EXPECTATION', 'DESIRED_TIMING'].includes(definition.id)) blocker = 'A preliminary answer is not allowed for this criterion.';
      else blocker = 'Record and confirm this required answer.';
    }
    return { ...definition, answerState, source, reason, hasAnswer: valuePresent, complete, deferred, blocker };
  });

  const phases: ReceptionPhaseResult[] = RECEPTION_PHASES.map((phase) => {
    const criteria = results.filter((criterion) => criterion.phase === phase.id);
    const blockers = criteria.filter((criterion) => Boolean(criterion.blocker));
    const deferred = criteria.filter((criterion) => criterion.deferred);
    return {
      ...phase,
      state: blockers.length ? 'IN_PROGRESS' : deferred.length ? 'READY_WITH_DEFERRED_ITEMS' : 'COMPLETE',
      criteria,
      blockers,
      deferred,
    };
  });
  const active = ['NEW', 'IN_REVIEW', 'QUALIFIED'].includes(inquiry.qualificationStatus);
  const activeReceptionPhase = active
    ? phases.find((phase) => phase.state === 'IN_PROGRESS')?.id || 'ROM_HANDOFF'
    : null;

  return {
    workflowVersion: RECEPTION_WORKFLOW_VERSION,
    activeReceptionPhase,
    phases,
    criteria: results,
  };
}

export function getReceptionCriterion(criterionId: string) {
  return RECEPTION_CRITERIA.find((criterion) => criterion.id === criterionId) || null;
}

export function isReceptionNonAnswerSentinel(value: string) {
  return nonAnswerSentinels.has(normalized(value));
}
