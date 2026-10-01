import express from 'express';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { authenticate, loadClientData, AuthRequest } from '../middleware/auth';
import { getPaginationParams, getPaginationResult } from '../utils/pagination';
import { INQUIRY_STATUSES } from '../workflow/constants';
import { writeAuditEvent } from '../workflow/audit';
import { phaseTemplates } from '../utils/poolProject';
import { initializeWorkflowProject } from '../workflow/initialize';
import { assertActiveAssignee } from '../workflow/authorization';
import { inquiryPdfFileName, renderInquiryPdf } from '../reporting/inquiryExports';
import { isArizonaState } from '../services/complianceResearch';
import { evaluateReceptionReadiness, getReceptionCriterion, hasReceptionCriterionAnswer } from '../workflow/receptionCriteria';
import { initializeCriterionStates, refreshLegacyReviewStatus, saveCriterionState, syncExplicitCriterionChanges } from '../workflow/criterionState';
import { RECEPTION_WORKFLOW_VERSION } from '../workflow/receptionCriteria';

const router = express.Router();
router.use(authenticate, loadClientData);

const propertySchema = z.object({
  address: z.string().trim().min(3).max(300),
  city: z.string().trim().max(100).nullable().optional(),
  state: z.string().trim().max(50).nullable().optional(),
  postalCode: z.string().trim().max(20).nullable().optional(),
  jurisdiction: z.string().trim().max(150).nullable().optional(),
  hoaName: z.string().trim().max(150).nullable().optional(),
});

const discoverySchema = z.object({
  projectType: z.string().trim().max(100).default(''),
  municipality: z.string().trim().max(150).default(''),
  communityDevelopment: z.string().trim().max(200).default(''),
  communitySubcommunity: z.string().trim().max(200).default(''),
  hoaArcContact: z.string().trim().max(1000).default(''),
  complianceCategories: z.string().trim().max(3000).default(''),
  complianceLinks: z.string().trim().max(5000).default(''),
  complianceVerificationStatus: z.string().trim().max(100).default(''),
  complianceVerificationCheckedAt: z.string().trim().max(100).default(''),
  complianceFollowUpStatus: z.enum(['', 'NOT_REQUIRED', 'TBD', 'VERIFIED']).default(''),
  complianceFollowUpOwner: z.string().trim().max(100).default(''),
  complianceFollowUpDueAt: z.string().trim().max(100).default(''),
  complianceFollowUpAction: z.string().trim().max(1000).default(''),
  primaryUse: z.string().trim().max(1000).default(''),
  householdUsers: z.string().trim().max(1000).default(''),
  decisionMakers: z.string().trim().max(1000).default(''),
  propertyAccess: z.string().trim().max(1000).default(''),
  siteConditions: z.string().trim().max(2000).default(''),
  utilities: z.string().trim().max(1000).default(''),
  hoaRequirements: z.string().trim().max(1000).default(''),
  surveyStatus: z.string().trim().max(100).default(''),
  poolSize: z.string().trim().max(500).default(''),
  depthProfile: z.string().trim().max(500).default(''),
  stylePreferences: z.string().trim().max(2000).default(''),
  mustHaveFeatures: z.string().trim().max(2000).default(''),
  deckingOutdoorScope: z.string().trim().max(2000).default(''),
  equipmentPreferences: z.string().trim().max(1000).default(''),
  heatingPreference: z.string().trim().max(500).default(''),
  budgetRange: z.string().trim().max(500).default(''),
  targetCompletion: z.string().trim().max(500).default(''),
  priorityTradeoffs: z.string().trim().max(2000).default(''),
  knownConcerns: z.string().trim().max(2000).default(''),
  representativeNotes: z.string().trim().max(5000).default(''),
}).superRefine((data, context) => {
  if (data.complianceFollowUpStatus !== 'TBD') return;
  if (!data.complianceFollowUpOwner) context.addIssue({ code: z.ZodIssueCode.custom, path: ['complianceFollowUpOwner'], message: 'A follow-up owner is required when compliance is TBD.' });
  if (!data.complianceFollowUpDueAt) context.addIssue({ code: z.ZodIssueCode.custom, path: ['complianceFollowUpDueAt'], message: 'A follow-up due date is required when compliance is TBD.' });
  if (!data.complianceFollowUpAction) context.addIssue({ code: z.ZodIssueCode.custom, path: ['complianceFollowUpAction'], message: 'A follow-up action is required when compliance is TBD.' });
});

const discoveryRequiredFields = [
  'projectType', 'primaryUse', 'decisionMakers', 'propertyAccess', 'siteConditions',
  'utilities', 'surveyStatus', 'mustHaveFeatures', 'budgetRange', 'targetCompletion',
] as const;

export function discoveryIsComplete(discovery: z.infer<typeof discoverySchema> | null | undefined) {
  return Boolean(discovery && discoveryRequiredFields.every((field) => {
    const value = discovery[field]?.trim();
    return value && value.toUpperCase() !== 'UNKNOWN';
  }));
}

export function inquiryPhaseRequirements(inquiry: any, phaseIndex: number) {
  const hasText = (value: unknown) => typeof value === 'string' && Boolean(value.trim());
  const hasContact = Boolean(inquiry.client?.name && (inquiry.client?.email || inquiry.client?.phone));
  const isSiteMeeting = (item: any) => item.activityType === 'SITE_MEETING' || (typeof item.title === 'string' && /site\s+meeting/i.test(item.title));
  const hasScheduledSiteMeeting = Boolean(inquiry.consultations?.some((item: any) => item.status === 'SCHEDULED' && isSiteMeeting(item)));
  const hasCompletedSiteMeeting = Boolean(inquiry.consultations?.some((item: any) => item.status === 'COMPLETED' && isSiteMeeting(item) && hasText(item.outcome)));
  const hasOpenRequests = Boolean(inquiry.workItems?.some((item: any) => !['VERIFIED', 'CLOSED', 'CANCELLED'].includes(item.status)));
  const complianceReviewRequired = Boolean(inquiry.discovery?.complianceFollowUpStatus === 'TBD' || hasText(inquiry.discovery?.complianceCategories) || hasText(inquiry.discovery?.hoaArcContact) || hasText(inquiry.discovery?.hoaRequirements));
  const requirements = [
    [
      { title: 'Client name and email or phone', complete: hasContact },
      { title: 'Original incoming contact channel', complete: hasText(inquiry.source) },
      { title: 'Reception owner assigned', complete: Boolean(inquiry.ownerId) },
      { title: 'Next action and due date recorded', complete: Boolean(hasText(inquiry.nextAction) && inquiry.nextActionDueAt) },
    ],
    [
      { title: 'Property identified', complete: Boolean(inquiry.propertyId) },
      { title: 'Project vision and objectives recorded', complete: Boolean(hasText(inquiry.description) && hasText(inquiry.objectives)) },
      { title: 'Preliminary scope recorded', complete: hasText(inquiry.preliminaryScope) },
      { title: 'Budget expectation recorded', complete: hasText(inquiry.budgetExpectation) },
      { title: 'Desired timing recorded', complete: hasText(inquiry.desiredTiming) },
      { title: 'Pre-design discovery completed', complete: discoveryIsComplete(inquiry.discovery) },
    ],
    [
      { title: 'All site meeting(s) completed with outcomes', complete: hasCompletedSiteMeeting && !hasScheduledSiteMeeting },
      { title: 'Site measurements, access, and feasibility recorded', complete: hasText(inquiry.siteAssessment) },
      { title: 'All client information requests resolved', complete: !hasOpenRequests },
      { title: 'Compliance review verified when applicable', complete: !complianceReviewRequired || inquiry.complianceVerificationStatus === 'VERIFIED' },
    ],
    [
      { title: 'ROM amount or range recorded', complete: hasText(inquiry.romAmount) },
      { title: 'ROM approved with decision record', complete: inquiry.romStatus === 'APPROVED' && Boolean(inquiry.romDecisionAt && inquiry.romApprovedBy) },
      { title: 'Design Agreement accepted or not required', complete: ['ACCEPTED', 'NOT_REQUIRED'].includes(inquiry.designAgreementStatus) && (inquiry.designAgreementStatus === 'NOT_REQUIRED' || Boolean(inquiry.designAgreementAcceptedAt && inquiry.designAgreementAcceptedBy)) },
      { title: 'Design handoff summary recorded', complete: hasText(inquiry.handoffSummary) },
      { title: 'Design handoff completed', complete: Boolean(inquiry.projectId && inquiry.qualificationStatus === 'CONVERTED') },
    ],
  ];
  if (inquiry.qualificationStatus === 'CONVERTED' && inquiry.projectId) {
    return (requirements[phaseIndex] || []).map((requirement) => ({ ...requirement, complete: true }));
  }
  return requirements[phaseIndex] || [];
}

export function incompleteInquiryPhaseRequirements(inquiry: any, phaseIndex: number) {
  return inquiryPhaseRequirements(inquiry, phaseIndex).filter((requirement: { title: string; complete: boolean }) => !requirement.complete);
}

function presentInquiry<T extends { discoveryData?: string | null }>(inquiry: T) {
  const { discoveryData, ...rest } = inquiry;
  let discovery: z.infer<typeof discoverySchema> | null = null;
  if (discoveryData) {
    try { discovery = discoverySchema.parse(JSON.parse(discoveryData)); } catch { discovery = null; }
  }
  return { ...rest, discovery };
}

function presentInquiryForRole(inquiry: any, role?: string) {
  const presented = presentInquiry(inquiry);
  if (role !== 'CLIENT') {
    const handoffReview = presented.handoffReviews?.[0] || presented.handoffReview || null;
    return { ...presented, handoffReview, readiness: evaluateReceptionReadiness({ ...presented, handoffReview }) };
  }
  const {
    criterionStates: _criterionStates, handoffReviews: _handoffReviews, handoffReview: _handoffReview,
    activities: _activities, evidence: _evidence, romPreviewSnapshot: _romPreviewSnapshot,
    romPreviewHash: _romPreviewHash, romPreviewRevision: _romPreviewRevision, romPreviewSavedAt: _romPreviewSavedAt,
    clientDispositionReviewedBy: _clientDispositionReviewedBy, clientDispositionEvidenceActivityId: _clientDispositionEvidenceActivityId,
    dispositionEvidenceActivity: _dispositionEvidenceActivity,
    ...clientPresented
  } = presented;
  const responseEvent = inquiry.dispositionEvidenceActivity;
  const pendingResponsePreview = ['PENDING_REVIEW', 'REVIEWED'].includes(inquiry.clientDispositionReviewStatus)
    && responseEvent?.origin === 'CLIENT_PORTAL'
    ? parseClientRomSnapshot(responseEvent.clientRomSnapshot, responseEvent.clientRomSnapshotHash)
    : null;
  const clientRomPreview = presentClientRomPreview(inquiry) || pendingResponsePreview;
  const activePhase = evaluateReceptionReadiness({
    ...presented,
    handoffReview: inquiry.handoffReviews?.[0] || null,
    evidence: inquiry.evidence || [],
  }).activeReceptionPhase;
  return {
    ...clientPresented,
    clientRomPreview,
    clientCanRespondToRom: activePhase === 'ROM_HANDOFF' && Boolean(clientRomPreview?.presentedAt),
    pendingClientDisposition: inquiry.clientDispositionReviewStatus === 'PENDING_REVIEW'
      && responseEvent?.origin === 'CLIENT_PORTAL'
      ? { disposition: responseEvent.clientDispositionValue, submittedAt: responseEvent.occurredAt, romSnapshot: pendingResponsePreview }
      : null,
    clientDispositionReviewStatus: inquiry.clientDispositionSource === 'CLIENT_PORTAL' ? inquiry.clientDispositionReviewStatus : null,
    clientDispositionSource: inquiry.clientDispositionSource === 'CLIENT_PORTAL' ? 'CLIENT_PORTAL' : null,
    ownerId: null,
    owner: null,
    nextAction: null,
    nextActionDueAt: null,
    proposalNarrative: null,
    proposalProvidedAt: null,
    proposalClientResponse: null,
    romApprovedBy: null,
    designAgreementAcceptedBy: null,
    handoffApprovedBy: null,
    complianceVerificationReviewedBy: null,
    complianceVerificationNotes: null,
    workItems: (presented.workItems || []).filter((item: any) => item.clientVisible).map((item: any) => ({
      ...item, reviewerId: null, createdBy: null,
    })),
    consultations: (presented.consultations || []).map((item: any) => ({
      ...item, userId: null, internalFollowers: null,
    })),
  };
}

const inquirySchema = z.object({
  clientId: z.string().uuid().optional(),
  lead: z.object({
    name: z.string().trim().min(1).max(200),
    email: z.string().trim().email().nullable().optional(),
    phone: z.string().trim().max(50).nullable().optional(),
  }).optional(),
  propertyId: z.string().uuid().nullable().optional(),
  property: propertySchema.optional(),
  source: z.string().trim().max(100).nullable().optional(),
  referralName: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  objectives: z.string().trim().max(5000).nullable().optional(),
  preliminaryScope: z.string().trim().max(5000).nullable().optional(),
  designInspirations: z.string().trim().max(5000).nullable().optional(),
  budgetExpectation: z.string().trim().max(500).nullable().optional(),
  desiredTiming: z.string().trim().max(500).nullable().optional(),
  discovery: discoverySchema.optional(),
  siteAssessment: z.string().trim().max(10000).nullable().optional(),
  romAmount: z.string().trim().max(500).nullable().optional(),
  proposalNarrative: z.string().trim().max(10000).nullable().optional(),
  romProposalDetails: z.string().max(30000).nullable().optional(),
  proposalProvidedAt: z.coerce.date().nullable().optional(),
  proposalClientResponse: z.string().trim().max(2000).nullable().optional(),
  romStatus: z.enum(['DRAFT', 'PRESENTED', 'APPROVED', 'REJECTED', 'NEEDS_REVISION']).nullable().optional(),
  romDecisionAt: z.coerce.date().nullable().optional(),
  romApprovedBy: z.string().uuid().nullable().optional(),
  designAgreementStatus: z.enum(['NOT_REQUIRED', 'PENDING', 'ACCEPTED', 'DECLINED']).nullable().optional(),
  designAgreementAcceptedAt: z.coerce.date().nullable().optional(),
  designAgreementAcceptedBy: z.string().uuid().nullable().optional(),
  handoffSummary: z.string().trim().max(10000).nullable().optional(),
  handoffApprovedBy: z.string().uuid().nullable().optional(),
  complianceVerificationStatus: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'NEEDS_REVIEW', 'VERIFIED', 'FAILED']).nullable().optional(),
  complianceVerificationCheckedAt: z.coerce.date().nullable().optional(),
  complianceVerificationSource: z.string().trim().max(1000).nullable().optional(),
  complianceVerificationCategories: z.string().trim().max(3000).nullable().optional(),
  complianceVerificationLinks: z.string().trim().max(5000).nullable().optional(),
  complianceVerificationReviewedBy: z.string().uuid().nullable().optional(),
  complianceVerificationReviewedAt: z.coerce.date().nullable().optional(),
  complianceVerificationNotes: z.string().trim().max(5000).nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  nextAction: z.string().trim().max(1000).nullable().optional(),
  nextActionDueAt: z.coerce.date().nullable().optional(),
});

const inquiryUpdateSchema = inquirySchema.partial().omit({ clientId: true, lead: true }).extend({
  expectedIntakeRevision: z.number().int().positive(),
});

const intakeUpdateSchema = z.object({
  expectedIntakeRevision: z.number().int().positive(),
  client: z.object({
    name: z.string().trim().min(1).max(200),
    email: z.string().trim().email().nullable(),
    phone: z.string().trim().max(50).nullable(),
  }).strict(),
  property: propertySchema.optional(),
  inquiry: z.object({
    source: z.string().trim().max(100).nullable().optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    objectives: z.string().trim().max(5000).nullable().optional(),
    preliminaryScope: z.string().trim().max(5000).nullable().optional(),
    designInspirations: z.string().trim().max(5000).nullable().optional(),
    budgetExpectation: z.string().trim().max(500).nullable().optional(),
    desiredTiming: z.string().trim().max(500).nullable().optional(),
    nextAction: z.string().trim().max(1000).nullable().optional(),
    nextActionDueAt: z.coerce.date().nullable().optional(),
  }).strict(),
}).strict().superRefine((data, context) => {
  if (!data.client.email && !data.client.phone) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['client', 'email'], message: 'Enter an email address or phone number so Reception can follow up.' });
  }
});

const statusSchema = z.object({
  status: z.enum(INQUIRY_STATUSES),
  reason: z.string().trim().max(5000).optional(),
  expectedIntakeRevision: z.number().int().positive(),
});

const criterionStateUpdateSchema = z.object({
  answerState: z.enum(['CONFIRMED', 'UNKNOWN', 'NOT_APPLICABLE']),
  reason: z.string().trim().max(2000).nullable().optional(),
  answerValue: z.string().trim().max(5000).optional(),
  expectedIntakeRevision: z.number().int().positive(),
}).strict();

const dispositionValues = ['PROCEED_TO_DESIGN', 'MORE_INFORMATION', 'PAUSE', 'DECLINE'] as const;
const activitySchema = z.object({
  channel: z.enum(['PHONE', 'SMS', 'EMAIL', 'WEBSITE', 'IN_PERSON', 'REFERRAL', 'OTHER']),
  direction: z.enum(['INBOUND', 'OUTBOUND']),
  contactPerson: z.string().trim().max(120).nullable().optional(),
  occurredAt: z.coerce.date(),
  organizationTimezone: z.string().trim().min(1).max(100).default('America/Phoenix'),
  summary: z.string().trim().min(1).max(3000),
  outcomeCode: z.enum(['CONNECTED', 'LEFT_MESSAGE', 'NO_ANSWER', 'CLIENT_RESPONSE_RECEIVED', 'CLIENT_DISPOSITION_RECEIVED', 'MEETING_SCHEDULED', 'FOLLOW_UP_REQUIRED', 'OTHER']),
  outcomeDetail: z.string().trim().max(2000).nullable().optional(),
  clientDispositionValue: z.enum(dispositionValues).nullable().optional(),
  documentIds: z.array(z.string().uuid()).max(20).default([]),
  followUp: z.object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(2000).nullable().optional(),
    ownerId: z.string().uuid(),
    dueAt: z.coerce.date(),
    criterionId: z.string().trim().max(100).nullable().optional(),
  }).strict().nullable().optional(),
  expectedIntakeRevision: z.number().int().positive(),
  idempotencyKey: z.string().trim().min(8).max(120),
}).strict().superRefine((data, context) => {
  if ((data.outcomeCode === 'CLIENT_DISPOSITION_RECEIVED') !== Boolean(data.clientDispositionValue)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['clientDispositionValue'], message: 'A client disposition value is required only for a disposition event.' });
  }
});

const dispositionResponseSchema = z.object({
  disposition: z.enum(dispositionValues),
  comment: z.string().trim().max(2000).nullable().optional(),
  expectedIntakeRevision: z.number().int().positive(),
  idempotencyKey: z.string().trim().min(8).max(120),
}).strict();

const dispositionReviewSchema = z.object({
  activityId: z.string().uuid(),
  disposition: z.enum(dispositionValues),
  expectedIntakeRevision: z.number().int().positive(),
  attested: z.literal(true),
  reason: z.string().trim().max(2000).nullable().optional(),
  nextReviewAt: z.coerce.date().nullable().optional(),
  followUp: z.object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(2000).nullable().optional(),
    ownerId: z.string().uuid(),
    dueAt: z.coerce.date(),
    criterionId: z.string().trim().max(100).nullable().optional(),
  }).strict().nullable().optional(),
}).strict();

const handoffReviewSchema = z.object({
  expectedIntakeRevision: z.number().int().positive(),
  workflowVersion: z.number().int().positive(),
  reason: z.string().trim().max(2000).nullable().optional(),
}).strict();

const activityCorrectionSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
  changes: z.object({
    channel: z.enum(['PHONE', 'SMS', 'EMAIL', 'WEBSITE', 'IN_PERSON', 'REFERRAL', 'OTHER']).optional(),
    direction: z.enum(['INBOUND', 'OUTBOUND']).optional(),
    contactPerson: z.string().trim().max(120).nullable().optional(),
    occurredAt: z.coerce.date().optional(),
    summary: z.string().trim().min(1).max(3000).optional(),
    outcomeCode: z.enum(['CONNECTED', 'LEFT_MESSAGE', 'NO_ANSWER', 'CLIENT_RESPONSE_RECEIVED', 'CLIENT_DISPOSITION_RECEIVED', 'MEETING_SCHEDULED', 'FOLLOW_UP_REQUIRED', 'OTHER']).optional(),
    outcomeDetail: z.string().trim().max(2000).nullable().optional(),
    clientDispositionValue: z.enum(dispositionValues).nullable().optional(),
  }).strict().refine((changes) => Object.keys(changes).length > 0, 'Provide at least one corrected field.'),
  expectedIntakeRevision: z.number().int().positive(),
  idempotencyKey: z.string().trim().min(8).max(120),
}).strict();

const inquiryEvidenceSchema = z.object({
  documentId: z.string().uuid(),
  category: z.enum(['SITE_PHOTO', 'SITE_PLAN', 'SURVEY', 'OTHER_SITE_EVIDENCE']),
  expectedIntakeRevision: z.number().int().positive(),
}).strict();

const complianceVerificationSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'NEEDS_REVIEW', 'VERIFIED', 'FAILED']),
  source: z.string().trim().max(1000).nullable().optional(),
  categories: z.string().trim().max(3000).nullable().optional(),
  links: z.string().trim().max(5000).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  expectedIntakeRevision: z.number().int().positive(),
});

const savedComplianceLinkBaseSchema = z.object({
  title: z.string().trim().min(1).max(300),
  url: z.string().trim().url().max(2000).refine((value) => {
    try { return new URL(value).protocol === 'https:'; } catch { return false; }
  }, 'Only HTTPS links can be saved.'),
  domain: z.string().trim().min(1).max(255),
  summary: z.string().trim().max(300).nullable().optional(),
  authorityType: z.enum(['CITY', 'COUNTY', 'STATE', 'HOA', 'OTHER']),
  authorityName: z.string().trim().min(1).max(200),
});

function validateSavedComplianceLink(data: z.infer<typeof savedComplianceLinkBaseSchema>, context: z.RefinementCtx) {
  try {
    if (new URL(data.url).hostname.toLowerCase() !== data.domain.toLowerCase()) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['domain'], message: 'The source domain must match the link.' });
    }
  } catch { /* URL validation reports malformed values. */ }
}

const saveComplianceLinkSchema = savedComplianceLinkBaseSchema.extend({
  expectedIntakeRevision: z.number().int().positive(),
}).superRefine(validateSavedComplianceLink);

const transitions: Record<string, string[]> = {
  NEW: ['IN_REVIEW', 'DECLINED', 'NURTURED'],
  IN_REVIEW: ['QUALIFIED', 'DECLINED', 'NURTURED'],
  NURTURED: ['IN_REVIEW', 'DECLINED'],
  QUALIFIED: [], DECLINED: [], CONVERTED: [],
};

function requireInternal(req: AuthRequest) {
  if (!req.user || req.user.role !== 'ADMIN') {
    throw new AppError('Internal inquiry access is required.', 403, 'FORBIDDEN');
  }
}

function hashJson(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

const clientRomOverrideKeys = [
  'projectNarrative', 'designBuildOverview', 'proposedScope', 'exclusions', 'designDeliverables',
  'clientResponsibilities', 'milestones', 'allowancesOptions', 'assumptions', 'depositTerms', 'nextSteps',
] as const;

function presentClientRomPreview(inquiry: any) {
  return buildClientRomSnapshot(inquiry);
}

function parseClientRomSnapshot(serializedSnapshot: string | null | undefined, snapshotHash: string | null | undefined) {
  if (!serializedSnapshot || !snapshotHash) return null;
  try {
    const snapshot = JSON.parse(serializedSnapshot);
    if (hashJson(snapshot) !== snapshotHash || !snapshot.presentedAt) return null;
    return snapshot;
  } catch { return null; }
}

function buildClientRomSnapshot(inquiry: any) {
  if (!inquiry.romPreviewSnapshot || !inquiry.romPreviewHash
    || inquiry.romPreviewRevision !== inquiry.intakeRevision) return null;
  try {
    const snapshot = JSON.parse(inquiry.romPreviewSnapshot);
    if (hashJson(snapshot) !== inquiry.romPreviewHash || !snapshot.presentation?.presentedAt) return null;
    const source = snapshot.sourceAnswers || {};
    const property = source.property || {};
    const overrides = snapshot.appliedOverrides || {};
    return {
      version: snapshot.version,
      label: snapshot.label,
      nonBindingNotice: snapshot.nonBindingNotice,
      intakeRevision: snapshot.intakeRevision,
      range: snapshot.range,
      sourceAnswers: {
        clientName: source.clientName || null,
        property: {
          address: property.address || null,
          city: property.city || null,
          state: property.state || null,
          postalCode: property.postalCode || null,
        },
        projectDescription: source.projectDescription || null,
        objectives: source.objectives || null,
        preliminaryScope: source.preliminaryScope || null,
        budgetExpectation: source.budgetExpectation || null,
        desiredTiming: source.desiredTiming || null,
      },
      proposal: Object.fromEntries(clientRomOverrideKeys.flatMap((key) =>
        typeof overrides[key] === 'string' && overrides[key].trim() ? [[key, overrides[key]]] : [])),
      supplementalNarrative: typeof snapshot.supplementalNarrative === 'string' ? snapshot.supplementalNarrative : null,
      presentedAt: snapshot.presentation?.presentedAt || null,
    };
  } catch { return null; }
}

function buildRomPreviewSnapshot(inquiry: any) {
  let overrides: Record<string, unknown> = {};
  if (typeof inquiry.romProposalDetails === 'string' && inquiry.romProposalDetails.trim()) {
    try {
      const parsed = JSON.parse(inquiry.romProposalDetails);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) overrides = parsed;
    } catch {
      throw new AppError('The saved ROM proposal details are invalid JSON. Re-save the proposal draft before review.', 409, 'VALIDATION_ERROR');
    }
  }
  const snapshot = {
    version: 1,
    label: 'Preliminary Rough Order of Magnitude',
    nonBindingNotice: 'Preliminary planning proposal only. This is not a construction contract, fixed price, or authorization to build.',
    intakeRevision: inquiry.intakeRevision,
    range: inquiry.romAmount || null,
    sourceAnswers: {
      clientName: inquiry.client?.name || null,
      property: inquiry.property ? {
        address: inquiry.property.address,
        city: inquiry.property.city,
        state: inquiry.property.state,
        postalCode: inquiry.property.postalCode,
      } : null,
      projectDescription: inquiry.description || null,
      objectives: inquiry.objectives || null,
      preliminaryScope: inquiry.preliminaryScope || null,
      designInspirations: inquiry.designInspirations || null,
      budgetExpectation: inquiry.budgetExpectation || null,
      desiredTiming: inquiry.desiredTiming || null,
      discovery: inquiry.discovery || null,
      siteAssessment: inquiry.siteAssessment || null,
    },
    appliedOverrides: overrides,
    supplementalNarrative: inquiry.proposalNarrative || null,
    presentation: {
      presentedAt: inquiry.proposalProvidedAt || null,
      handoffSummary: inquiry.handoffSummary || null,
    },
  };
  const hasNarrative = Boolean(inquiry.proposalNarrative?.trim() || inquiry.description?.trim() || inquiry.objectives?.trim() || inquiry.preliminaryScope?.trim());
  return { snapshot, hash: hashJson(snapshot), complete: Boolean(inquiry.romAmount?.trim() && hasNarrative) };
}

async function getAccessibleInquiry(req: AuthRequest, id: string): Promise<any> {
  const inquiry = await prisma.inquiry.findUnique({
    where: { id },
    include: {
      client: true, property: true,
      owner: { select: { id: true, name: true, email: true, role: true, active: true } },
      consultations: { where: { deletedAt: null }, orderBy: { date: 'desc' } },
      documents: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
      workItems: { where: { deletedAt: null }, orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }] },
      project: true,
      criterionStates: true,
      evidence: { orderBy: { createdAt: 'desc' }, include: { document: true, actor: { select: { id: true, name: true } } } },
      dispositionEvidenceActivity: { select: { id: true, actorId: true, origin: true, clientDispositionValue: true, occurredAt: true, clientRomSnapshot: true, clientRomSnapshotHash: true } },
      ...(req.user?.role === 'ADMIN' ? {
        activities: { orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }], include: { actor: { select: { id: true, name: true } }, followUpWorkItem: true, documents: { include: { document: true } } } },
      } : {}),
      handoffReviews: { orderBy: { reviewedAt: 'desc' }, take: 1 },
    },
  });
  if (!inquiry) throw new AppError('Inquiry not found.', 404, 'NOT_FOUND');
  if (req.user?.role === 'CLIENT' && inquiry.clientId !== req.user.clientId) {
    throw new AppError('Inquiry not found.', 404, 'NOT_FOUND');
  }
  const presented = presentInquiryForRole(inquiry, req.user?.role);
  return {
    ...presented,
    handoffReview: req.user?.role === 'CLIENT' ? null : inquiry.handoffReviews[0] || null,
    readiness: req.user?.role === 'CLIENT' ? undefined : evaluateReceptionReadiness({
      ...presented,
      handoffReview: inquiry.handoffReviews[0] || null,
      evidence: inquiry.evidence || [],
    }),
  };
}

async function advanceIntakeRevision(tx: any, inquiryId: string, expectedRevision: number) {
  const result = await tx.inquiry.updateMany({
    where: { id: inquiryId, intakeRevision: expectedRevision },
    data: {
      intakeRevision: { increment: 1 },
      romPreviewSnapshot: null,
      romPreviewHash: null,
      romPreviewRevision: null,
      romPreviewSavedAt: null,
    },
  });
  if (result.count === 1) return expectedRevision + 1;

  const current = await tx.inquiry.findUnique({ where: { id: inquiryId }, select: { intakeRevision: true } });
  if (!current) throw new AppError('Inquiry not found.', 404, 'NOT_FOUND');
  throw new AppError('This inquiry changed after you opened it. Review the latest saved information and try again.', 409, 'STALE_INTAKE_REVISION', {
    expectedIntakeRevision: expectedRevision,
    currentIntakeRevision: current.intakeRevision,
  });
}

async function getTransactionInquiry(tx: any, id: string) {
  const inquiry = await tx.inquiry.findUnique({
    where: { id },
    include: {
      client: true, property: true,
      owner: { select: { id: true, role: true, active: true } },
      consultations: { where: { deletedAt: null } },
      documents: { where: { deletedAt: null } },
      workItems: { where: { deletedAt: null } },
      criterionStates: true,
    },
  });
  return inquiry ? presentInquiry(inquiry) : null;
}

router.get('/properties', async (req: AuthRequest, res, next) => {
  try {
    const clientId = req.user?.role === 'CLIENT' ? req.user.clientId : String(req.query.clientId || '');
    if (!clientId) throw new AppError('clientId is required.', 400, 'VALIDATION_ERROR');
    const data = await prisma.property.findMany({ where: { clientId }, orderBy: { updatedAt: 'desc' } });
    res.json({ data, pagination: { page: 1, limit: data.length, total: data.length, totalPages: data.length ? 1 : 0 } });
  } catch (error) { next(error); }
});

router.post('/properties', async (req: AuthRequest, res, next) => {
  try {
    const body = propertySchema.extend({ clientId: z.string().uuid().optional() }).parse(req.body);
    const clientId = req.user?.role === 'CLIENT' ? req.user.clientId : body.clientId;
    if (!clientId) throw new AppError('clientId is required.', 400, 'VALIDATION_ERROR');
    const client = await prisma.client.findFirst({ where: { id: clientId, deletedAt: null } });
    if (!client) throw new AppError('Client not found.', 404, 'NOT_FOUND');
    const property = await prisma.property.create({ data: { ...body, clientId, organizationId: process.env.ORGANIZATION_ID || null } });
    res.status(201).json(property);
  } catch (error) { next(error); }
});

router.get('/inquiries', async (req: AuthRequest, res, next) => {
  try {
    const pagination = getPaginationParams(req.query);
    const where: any = {};
    if (req.user?.role === 'CLIENT') where.clientId = req.user.clientId;
    if (req.query.status) {
      if (!INQUIRY_STATUSES.includes(req.query.status as any)) throw new AppError('Unknown inquiry status.', 400, 'VALIDATION_ERROR');
      where.qualificationStatus = req.query.status;
    }
    if (req.query.ownerId) where.ownerId = String(req.query.ownerId);
    const search = String(req.query.search || '').trim();
    if (search) {
      where.OR = [
        { description: { contains: search } },
        { objectives: { contains: search } },
        { client: { name: { contains: search } } },
        { client: { email: { contains: search } } },
        { client: { phone: { contains: search } } },
        { property: { address: { contains: search } } },
        { property: { city: { contains: search } } },
      ];
    }
    if (req.query.overdue === 'true') {
      where.nextActionDueAt = { lt: new Date() };
      where.qualificationStatus = { notIn: ['DECLINED', 'NURTURED', 'CONVERTED'] };
    }
    const [data, total] = await Promise.all([
      prisma.inquiry.findMany({
        where, skip: pagination.skip, take: pagination.limit,
        orderBy: [{ nextActionDueAt: 'asc' }, { createdAt: 'desc' }],
        include: { client: { select: { id: true, name: true, email: true, phone: true } }, property: true, owner: { select: { id: true, name: true, role: true, active: true } }, workItems: { where: { deletedAt: null }, orderBy: { dueAt: 'asc' } }, consultations: { where: { deletedAt: null }, select: { status: true, title: true, activityType: true, meetingMode: true, date: true, outcome: true } }, criterionStates: true, evidence: true, dispositionEvidenceActivity: { select: { id: true, actorId: true, origin: true, clientDispositionValue: true, occurredAt: true, clientRomSnapshot: true, clientRomSnapshotHash: true } }, handoffReviews: { orderBy: { reviewedAt: 'desc' }, take: 1 } },
      }),
      prisma.inquiry.count({ where }),
    ]);
    res.json({ data: data.map((item) => presentInquiryForRole(item, req.user?.role)), pagination: getPaginationResult(total, pagination) });
  } catch (error) { next(error); }
});

router.post('/inquiries', async (req: AuthRequest, res, next) => {
  try {
    const data = inquirySchema.parse(req.body);
    if (req.user?.role === 'CLIENT' && !req.user.clientId) throw new AppError('Client account is not linked.', 409, 'CONFLICT');
    if (req.user?.role !== 'CLIENT' && !data.clientId && !data.lead) {
      throw new AppError('Select an existing lead or enter the lead contact details.', 400, 'VALIDATION_ERROR');
    }
    let clientId = req.user?.role === 'CLIENT' ? req.user.clientId : data.clientId;
    if (req.user?.role === 'CLIENT' && (!data.objectives || !data.description)) {
      throw new AppError('Project objectives and a project description are required.', 400, 'VALIDATION_ERROR');
    }
    let client = clientId ? await prisma.client.findFirst({ where: { id: clientId, deletedAt: null } }) : null;
    if (clientId && !client) throw new AppError('Client not found.', 404, 'NOT_FOUND');
    if (req.user?.role !== 'CLIENT' && !client && data.lead) {
      const normalizedEmail = data.lead.email?.trim().toLowerCase();
      const normalizedPhone = data.lead.phone?.replace(/\D/g, '');
      const candidates = await prisma.client.findMany({
        where: { deletedAt: null, OR: [{ email: { not: null } }, { phone: { not: null } }] },
        select: { id: true, name: true, email: true, phone: true },
      });
      const matches = candidates.filter((candidate) =>
        (normalizedEmail && candidate.email?.trim().toLowerCase() === normalizedEmail) ||
        (normalizedPhone && candidate.phone?.replace(/\D/g, '') === normalizedPhone),
      );
      if (matches.length) {
        throw new AppError('A client with this email or phone already exists. Select the correct existing lead before continuing.', 409, 'CONFLICT', { matchCandidates: matches });
      }
    }
    if (req.user?.role === 'CLIENT') {
      const [existingInquiry, existingProject] = await Promise.all([
        prisma.inquiry.findFirst({
          where: { clientId, qualificationStatus: { notIn: ['DECLINED', 'CONVERTED'] } },
          select: { id: true },
        }),
        prisma.poolProject.findUnique({ where: { clientId }, select: { id: true } }),
      ]);
      if (existingInquiry || existingProject) {
        throw new AppError(
          'You already have an active project inquiry. Continue updating that inquiry instead of starting another one.',
          409,
          'CONFLICT',
        );
      }
    }
    await assertActiveAssignee(data.ownerId, 'Inquiry owner');

    const inquiry = await prisma.$transaction(async (tx) => {
      if (!client) {
        client = await tx.client.create({
          data: {
            name: data.lead!.name,
            email: data.lead!.email || null,
            phone: data.lead!.phone || null,
            status: 'LEAD',
          },
        });
        clientId = client.id;
      }
      const resolvedClientId = clientId;
      if (!resolvedClientId) throw new AppError('Client could not be established for this inquiry.', 409, 'CONFLICT');
      let propertyId = data.propertyId || null;
      if (propertyId) {
        const property = await tx.property.findFirst({ where: { id: propertyId, clientId: resolvedClientId } });
        if (!property) throw new AppError('Property does not belong to this client.', 400, 'VALIDATION_ERROR');
      } else if (data.property) {
        const property = await tx.property.create({
            data: { ...data.property, clientId: resolvedClientId, organizationId: process.env.ORGANIZATION_ID || null },
        });
        propertyId = property.id;
      }
      const created = await tx.inquiry.create({
        data: {
          organizationId: process.env.ORGANIZATION_ID || null,
          clientId: resolvedClientId, propertyId,
          source: data.source, referralName: data.referralName, description: data.description,
          objectives: data.objectives, preliminaryScope: data.preliminaryScope,
          budgetExpectation: data.budgetExpectation, desiredTiming: data.desiredTiming,
          legacyReviewStatus: 'REVIEWED',
          ownerId: req.user?.role === 'CLIENT' ? null : data.ownerId,
          nextAction: req.user?.role === 'CLIENT' ? 'Review submitted inquiry' : data.nextAction,
          nextActionDueAt: data.nextActionDueAt,
        },
      });
      const createdWithSources = await tx.inquiry.findUnique({
        where: { id: created.id },
        include: {
          client: true, property: true,
          owner: { select: { id: true, role: true, active: true } },
          consultations: { where: { deletedAt: null } },
          workItems: { where: { deletedAt: null } },
        },
      });
      if (createdWithSources) await initializeCriterionStates(tx, createdWithSources, req.user?.role === 'CLIENT' ? 'CLIENT' : 'ADMIN', req.user!.id);
      await writeAuditEvent(tx, { userId: req.user!.id, action: 'SUBMIT', entityType: 'Inquiry', entityId: created.id, requestId: (req as any).requestId, after: created });
      return created;
    });

    const recipients = await prisma.user.findMany({
      where: data.ownerId && req.user?.role !== 'CLIENT' ? { id: data.ownerId, active: true, role: 'ADMIN' } : { role: 'ADMIN', active: true },
      select: { id: true },
    });
    if (recipients.length) await prisma.notification.createMany({
        data: recipients.map(({ id }) => ({ userId: id, type: 'INQUIRY_RECEIVED', message: `New inquiry received from ${client!.name}.`, clientId: clientId!, inquiryId: inquiry.id })),
    });
    if (req.user?.role === 'CLIENT') {
      await prisma.notification.create({
        data: { userId: req.user.id, type: 'INQUIRY_ACKNOWLEDGED', message: 'Your inquiry was received and is ready for team review.', clientId: clientId!, inquiryId: inquiry.id },
      });
    }
    res.status(201).json(await getAccessibleInquiry(req, inquiry.id));
  } catch (error) { next(error); }
});

router.get('/inquiries/:id/export', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req);
    const inquiry = await getAccessibleInquiry(req, req.params.id);
    const output = await renderInquiryPdf(inquiry);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${inquiryPdfFileName(inquiry)}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(output);
  } catch (error) { next(error); }
});

router.get('/inquiries/:id', async (req: AuthRequest, res, next) => {
  try { res.json(await getAccessibleInquiry(req, req.params.id)); } catch (error) { next(error); }
});

router.get('/inquiries/:id/activities', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req);
    const inquiry = await getAccessibleInquiry(req, req.params.id);
    const pagination = getPaginationParams(req.query);
    const direction = req.query.direction === 'asc' ? 'asc' : 'desc';
    const [data, total] = await Promise.all([
      prisma.inquiryActivity.findMany({
        where: { inquiryId: inquiry.id }, skip: pagination.skip, take: pagination.limit,
        orderBy: [{ occurredAt: direction }, { createdAt: direction }],
        include: { actor: { select: { id: true, name: true } }, followUpWorkItem: true, documents: { include: { document: true } } },
      }),
      prisma.inquiryActivity.count({ where: { inquiryId: inquiry.id } }),
    ]);
    res.json({ data, pagination: getPaginationResult(total, pagination) });
  } catch (error) { next(error); }
});

router.post('/inquiries/:id/activities/:activityId/corrections', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req);
    const inquiry = await getAccessibleInquiry(req, req.params.id);
    const data = activityCorrectionSchema.parse(req.body);
    const original = await prisma.inquiryActivity.findFirst({ where: { id: req.params.activityId, inquiryId: inquiry.id, clientId: inquiry.clientId } });
    if (!original) throw new AppError('Activity not found.', 404, 'NOT_FOUND');
    const originalIsDisposition = original.outcomeCode === 'CLIENT_DISPOSITION_RECEIVED';
    const correctedOutcomeCode = data.changes.outcomeCode ?? original.outcomeCode;
    const correctedDisposition = Object.prototype.hasOwnProperty.call(data.changes, 'clientDispositionValue')
      ? data.changes.clientDispositionValue || null
      : original.clientDispositionValue;
    const correctedIsDisposition = correctedOutcomeCode === 'CLIENT_DISPOSITION_RECEIVED';
    if (correctedIsDisposition && !correctedDisposition) throw new AppError('A corrected disposition event must retain a disposition value.', 400, 'VALIDATION_ERROR');
    if (!correctedIsDisposition && correctedDisposition) throw new AppError('A disposition value cannot be attached to a non-disposition event.', 400, 'VALIDATION_ERROR');
    if (!originalIsDisposition && correctedIsDisposition) throw new AppError('Create a new client disposition activity instead of converting another activity through correction.', 409, 'INVALID_TRANSITION');
    if (originalIsDisposition && !['NEW', 'IN_REVIEW', 'QUALIFIED'].includes(inquiry.qualificationStatus)) {
      throw new AppError('Disposition evidence cannot be corrected after the inquiry leaves Reception.', 409, 'INVALID_TRANSITION');
    }
    const fingerprint = hashJson({ activityId: original.id, reason: data.reason, changes: data.changes });
    const duplicate = await prisma.inquiryActivity.findFirst({ where: { inquiryId: inquiry.id, actorId: req.user!.id, idempotencyKey: data.idempotencyKey } });
    if (duplicate) {
      if (duplicate.requestFingerprint !== fingerprint) throw new AppError('This idempotency key was already used for different correction data.', 409, 'IDEMPOTENCY_KEY_REUSED');
      return res.status(200).json(duplicate);
    }
    const correction = await prisma.$transaction(async (tx) => {
      await advanceIntakeRevision(tx, inquiry.id, data.expectedIntakeRevision);
      const created = await tx.inquiryActivity.create({ data: {
        inquiryId: inquiry.id, clientId: inquiry.clientId, actorId: req.user!.id, origin: original.origin,
        ...(['CLIENT_PORTAL', 'SYSTEM'].includes(original.origin) ? { sourceEventId: `${original.id}:correction:${data.idempotencyKey}` } : {}),
        channel: data.changes.channel ?? original.channel,
        direction: data.changes.direction ?? original.direction,
        contactPerson: data.changes.contactPerson === undefined ? original.contactPerson : data.changes.contactPerson,
        occurredAt: new Date(),
        organizationTimezone: original.organizationTimezone,
        summary: `Correction to activity ${original.id}: ${data.reason}`,
        outcomeCode: correctedOutcomeCode,
        outcomeDetail: Object.prototype.hasOwnProperty.call(data.changes, 'outcomeDetail') ? data.changes.outcomeDetail : original.outcomeDetail,
        clientDispositionValue: correctedDisposition,
        ...(original.clientRomSnapshot ? { clientRomSnapshot: original.clientRomSnapshot, clientRomSnapshotHash: original.clientRomSnapshotHash } : {}),
        idempotencyKey: data.idempotencyKey, requestFingerprint: fingerprint,
        correctionOfActivityId: original.id, correctionJson: JSON.stringify({ reason: data.reason, changes: data.changes }),
      } });
      if (originalIsDisposition && inquiry.clientDispositionEvidenceActivityId === original.id) {
        await tx.inquiry.update({ where: { id: inquiry.id }, data: correctedIsDisposition ? {
          clientDisposition: null, clientDispositionSource: created.origin === 'CLIENT_PORTAL' ? 'CLIENT_PORTAL' : created.channel,
          clientDispositionAt: created.occurredAt, clientDispositionRecordedBy: original.actorId,
          clientDispositionClientUserId: created.origin === 'CLIENT_PORTAL' ? original.actorId : null,
          clientDispositionEvidenceActivityId: created.id, clientDispositionReviewStatus: 'PENDING_REVIEW',
          clientDispositionReviewedAt: null, clientDispositionReviewedBy: null,
          clientDispositionComment: created.outcomeDetail || created.summary,
        } : {
          clientDisposition: null, clientDispositionSource: null, clientDispositionAt: null,
          clientDispositionRecordedBy: null, clientDispositionClientUserId: null,
          clientDispositionEvidenceActivityId: null, clientDispositionReviewStatus: null,
          clientDispositionReviewedAt: null, clientDispositionReviewedBy: null, clientDispositionComment: null,
        } });
        if (correctedIsDisposition) {
          await saveCriterionState(tx, { inquiryId: inquiry.id, criterionId: 'CLIENT_DISPOSITION', answerState: 'UNKNOWN', reason: 'Corrected client disposition is awaiting Admin review.', source: 'ADMIN', actorId: req.user!.id });
        } else {
          await saveCriterionState(tx, { inquiryId: inquiry.id, criterionId: 'CLIENT_DISPOSITION', answerState: 'UNKNOWN', reason: null, source: 'ADMIN', actorId: req.user!.id });
        }
      }
      await writeAuditEvent(tx, { userId: req.user!.id, action: 'CORRECT', entityType: 'InquiryActivity', entityId: original.id, requestId: (req as any).requestId, before: original, after: created });
      return created;
    });
    res.status(201).json(correction);
  } catch (error) { next(error); }
});

router.post('/inquiries/:id/evidence', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req);
    const inquiry = await getAccessibleInquiry(req, req.params.id);
    const data = inquiryEvidenceSchema.parse(req.body);
    const document = await prisma.document.findFirst({ where: { id: data.documentId, inquiryId: inquiry.id, clientId: inquiry.clientId, deletedAt: null }, select: { id: true } });
    if (!document) throw new AppError('Site evidence must reference an active document attached to this inquiry.', 400, 'VALIDATION_ERROR');
    const evidence = await prisma.$transaction(async (tx) => {
      await advanceIntakeRevision(tx, inquiry.id, data.expectedIntakeRevision);
      const created = await tx.inquiryEvidence.create({ data: { inquiryId: inquiry.id, documentId: data.documentId, category: data.category, actorId: req.user!.id }, include: { document: true, actor: { select: { id: true, name: true } } } });
      await writeAuditEvent(tx, { userId: req.user!.id, action: 'CATEGORIZE_SITE_EVIDENCE', entityType: 'InquiryEvidence', entityId: created.id, requestId: (req as any).requestId, after: created });
      return created;
    });
    res.status(201).json(evidence);
  } catch (error) { next(error); }
});

router.post('/inquiries/:id/activities', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req);
    const inquiry = await getAccessibleInquiry(req, req.params.id);
    const data = activitySchema.parse(req.body);
    const fingerprintPayload = { ...data, expectedIntakeRevision: undefined, idempotencyKey: undefined, documentIds: [...data.documentIds].sort() };
    const requestFingerprint = hashJson(fingerprintPayload);
    const existing = await prisma.inquiryActivity.findFirst({ where: { inquiryId: inquiry.id, actorId: req.user!.id, idempotencyKey: data.idempotencyKey } });
    if (existing) {
      if (existing.requestFingerprint !== requestFingerprint) throw new AppError('This idempotency key was already used for different activity data.', 409, 'IDEMPOTENCY_KEY_REUSED');
      return res.status(200).json(existing);
    }
    if (!['NEW', 'IN_REVIEW', 'QUALIFIED'].includes(inquiry.qualificationStatus)) throw new AppError('Activities can only be added to active Reception inquiries.', 409, 'INVALID_TRANSITION');
    if (data.outcomeCode === 'CLIENT_DISPOSITION_RECEIVED') {
      if (data.direction !== 'INBOUND' || inquiry.readiness?.activeReceptionPhase !== 'ROM_HANDOFF') {
        throw new AppError('A client disposition must be an inbound response during ROM and handoff.', 409, 'INVALID_TRANSITION');
      }
      if (!inquiry.romPreviewSnapshot || !inquiry.romPreviewHash
        || inquiry.romPreviewRevision !== inquiry.intakeRevision || !inquiry.proposalProvidedAt) {
        throw new AppError('Present and save the current ROM before logging the client disposition.', 409, 'ROM_NOT_PRESENTED');
      }
      if (inquiry.clientDispositionReviewStatus === 'PENDING_REVIEW') {
        throw new AppError('A client response is already awaiting Admin review.', 409, 'DISPOSITION_PENDING_REVIEW');
      }
    }
    const responseRomSnapshot = data.outcomeCode === 'CLIENT_DISPOSITION_RECEIVED' ? buildClientRomSnapshot(inquiry) : null;
    if (data.outcomeCode === 'CLIENT_DISPOSITION_RECEIVED' && !responseRomSnapshot) {
      throw new AppError('The current preliminary ROM could not be verified.', 409, 'ROM_NOT_PRESENTED');
    }
    if (data.followUp?.criterionId) {
      const criterion = getReceptionCriterion(data.followUp.criterionId);
      const readiness = inquiry.readiness?.criteria.find((item: { id: string }) => item.id === data.followUp!.criterionId);
      if (!criterion || criterion.requirement !== 'DEFERRABLE' || readiness?.answerState !== 'UNKNOWN') {
        throw new AppError('A criterion-linked follow-up is allowed only for an unresolved deferrable criterion.', 409, 'INVALID_CRITERION_FOLLOW_UP');
      }
    }
    if (data.followUp) await assertActiveAssignee(data.followUp.ownerId, 'Follow-up owner');
    const documentIds = [...new Set(data.documentIds)];
    if (documentIds.length !== data.documentIds.length) throw new AppError('A document may be linked only once.', 400, 'VALIDATION_ERROR');
    if (documentIds.length) {
      const docs = await prisma.document.findMany({ where: { id: { in: documentIds }, inquiryId: inquiry.id, clientId: inquiry.clientId, deletedAt: null }, select: { id: true } });
      if (docs.length !== documentIds.length) throw new AppError('Every linked document must belong to this inquiry and client.', 400, 'VALIDATION_ERROR');
    }
    const created = await prisma.$transaction(async (tx) => {
      await advanceIntakeRevision(tx, inquiry.id, data.expectedIntakeRevision);
      const followUp = data.followUp ? await tx.workItem.create({ data: {
        inquiryId: inquiry.id, criterionId: data.followUp.criterionId || null, stage: 'INQUIRY', type: 'TASK',
        title: data.followUp.title, description: data.followUp.description || null, status: 'OPEN', priority: 'NORMAL',
        ownerId: data.followUp.ownerId, dueAt: data.followUp.dueAt, clientVisible: false, createdBy: req.user!.id,
      } }) : null;
      const activity = await tx.inquiryActivity.create({ data: {
        inquiryId: inquiry.id, clientId: inquiry.clientId, actorId: req.user!.id, origin: 'ADMIN',
        channel: data.channel, direction: data.direction, contactPerson: data.contactPerson || null,
        occurredAt: data.occurredAt, organizationTimezone: data.organizationTimezone,
        summary: data.summary, outcomeCode: data.outcomeCode, outcomeDetail: data.outcomeDetail || null,
        clientDispositionValue: data.clientDispositionValue || null,
        ...(responseRomSnapshot ? { clientRomSnapshot: JSON.stringify(responseRomSnapshot), clientRomSnapshotHash: hashJson(responseRomSnapshot) } : {}),
        followUpWorkItemId: followUp?.id || null, idempotencyKey: data.idempotencyKey, requestFingerprint,
        documents: documentIds.length ? { createMany: { data: documentIds.map((documentId) => ({ documentId })) } } : undefined,
      }, include: { actor: { select: { id: true, name: true } }, followUpWorkItem: true, documents: { include: { document: true } } } });
      if (activity.outcomeCode === 'CLIENT_DISPOSITION_RECEIVED') {
        await tx.inquiry.update({ where: { id: inquiry.id }, data: {
          clientDispositionSource: activity.channel, clientDispositionAt: activity.occurredAt,
          clientDispositionRecordedBy: req.user!.id, clientDispositionClientUserId: null,
          clientDispositionEvidenceActivityId: activity.id, clientDispositionReviewStatus: 'PENDING_REVIEW',
          clientDispositionComment: activity.outcomeDetail || activity.summary,
        } });
      }
      await writeAuditEvent(tx, { userId: req.user!.id, action: 'CREATE', entityType: 'InquiryActivity', entityId: activity.id, requestId: (req as any).requestId, after: activity });
      return activity;
    });
    res.status(201).json(created);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      const existing = await prisma.inquiryActivity.findFirst({ where: { inquiryId: req.params.id, actorId: req.user?.id, idempotencyKey: req.body?.idempotencyKey } }).catch(() => null);
      const replay = activitySchema.safeParse(req.body);
      if (existing && replay.success) {
        const normalizedPayload = { ...replay.data, expectedIntakeRevision: undefined, idempotencyKey: undefined, documentIds: [...replay.data.documentIds].sort() };
        return existing.requestFingerprint === hashJson(normalizedPayload)
          ? res.status(200).json(existing)
          : next(new AppError('This idempotency key was already used for different activity data.', 409, 'IDEMPOTENCY_KEY_REUSED'));
      }
    }
    next(error);
  }
});

router.post('/inquiries/:id/rom-preview', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req);
    const inquiry = await getAccessibleInquiry(req, req.params.id);
    const { expectedIntakeRevision } = z.object({ expectedIntakeRevision: z.number().int().positive() }).strict().parse(req.body);
    if (!['NEW', 'IN_REVIEW', 'QUALIFIED'].includes(inquiry.qualificationStatus)) throw new AppError('A ROM preview can only be saved for an active Reception inquiry.', 409, 'INVALID_TRANSITION');
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.inquiry.findFirst({ where: { id: inquiry.id, intakeRevision: expectedIntakeRevision }, include: { client: true, property: true } });
      if (!current) await advanceIntakeRevision(tx, inquiry.id, expectedIntakeRevision);
      const currentWithDiscovery = await getTransactionInquiry(tx, inquiry.id);
      const built = buildRomPreviewSnapshot(currentWithDiscovery);
      const updated = await tx.inquiry.updateMany({ where: { id: inquiry.id, intakeRevision: expectedIntakeRevision }, data: {
        romPreviewSnapshot: JSON.stringify(built.snapshot), romPreviewHash: built.hash,
        romPreviewRevision: expectedIntakeRevision, romPreviewSavedAt: new Date(),
      } });
      if (updated.count !== 1) await advanceIntakeRevision(tx, inquiry.id, expectedIntakeRevision);
      return { snapshot: built.snapshot, hash: built.hash, complete: built.complete, intakeRevision: expectedIntakeRevision };
    });
    res.json(result);
  } catch (error) { next(error); }
});

router.post('/inquiries/:id/disposition-responses', async (req: AuthRequest, res, next) => {
  try {
    if (req.user?.role !== 'CLIENT') throw new AppError('This endpoint is for authenticated client responses.', 403, 'FORBIDDEN');
    const inquiry = await getAccessibleInquiry(req, req.params.id);
    const data = dispositionResponseSchema.parse(req.body);
    const sourceEventId = `${req.user!.id}:${data.idempotencyKey}`;
    const existing = await prisma.inquiryActivity.findFirst({ where: { origin: 'CLIENT_PORTAL', sourceEventId } });
    if (existing) {
      const replayFingerprint = hashJson({ disposition: data.disposition, comment: data.comment || null, clientRomSnapshotHash: existing.clientRomSnapshotHash });
      if (existing.requestFingerprint !== replayFingerprint) throw new AppError('This idempotency key was already used for a different response.', 409, 'IDEMPOTENCY_KEY_REUSED');
      return res.status(200).json({ status: 'PENDING_REVIEW', responseId: existing.id });
    }
    if (!['NEW', 'IN_REVIEW', 'QUALIFIED'].includes(inquiry.qualificationStatus) || inquiry.clientCanRespondToRom !== true) {
      throw new AppError('Client dispositions are available only while the inquiry is in ROM and handoff.', 409, 'INVALID_TRANSITION');
    }
    if (inquiry.clientDispositionReviewStatus === 'PENDING_REVIEW') {
      throw new AppError('A client response is already awaiting Admin review.', 409, 'DISPOSITION_PENDING_REVIEW');
    }
    const responseRomSnapshot = inquiry.clientRomPreview;
    if (!responseRomSnapshot) throw new AppError('The current preliminary ROM could not be verified.', 409, 'ROM_NOT_PRESENTED');
    const responseRomSnapshotJson = JSON.stringify(responseRomSnapshot);
    const responseRomSnapshotHash = hashJson(responseRomSnapshot);
    const fingerprint = hashJson({ disposition: data.disposition, comment: data.comment || null, clientRomSnapshotHash: responseRomSnapshotHash });
    const activity = await prisma.$transaction(async (tx) => {
      await advanceIntakeRevision(tx, inquiry.id, data.expectedIntakeRevision);
      const created = await tx.inquiryActivity.create({ data: {
        inquiryId: inquiry.id, clientId: inquiry.clientId, actorId: req.user!.id, origin: 'CLIENT_PORTAL', sourceEventId,
        channel: 'WEBSITE', direction: 'INBOUND', occurredAt: new Date(), organizationTimezone: 'America/Phoenix',
        summary: 'Client submitted a response to the preliminary ROM.', outcomeCode: 'CLIENT_DISPOSITION_RECEIVED',
        outcomeDetail: data.comment || null, clientDispositionValue: data.disposition, requestFingerprint: fingerprint,
        clientRomSnapshot: responseRomSnapshotJson, clientRomSnapshotHash: responseRomSnapshotHash,
      } });
      await tx.inquiry.update({ where: { id: inquiry.id }, data: {
        clientDispositionSource: 'CLIENT_PORTAL', clientDispositionAt: created.occurredAt,
        clientDispositionRecordedBy: req.user!.id, clientDispositionClientUserId: req.user!.id,
        clientDispositionEvidenceActivityId: created.id, clientDispositionReviewStatus: 'PENDING_REVIEW',
        clientDispositionComment: data.comment || null,
      } });
      return created;
    });
    res.status(202).json({ status: 'PENDING_REVIEW', responseId: activity.id });
  } catch (error) { next(error); }
});

router.post('/inquiries/:id/disposition', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req);
    const inquiry = await getAccessibleInquiry(req, req.params.id);
    const data = dispositionReviewSchema.parse(req.body);
    if (!['NEW', 'IN_REVIEW', 'QUALIFIED'].includes(inquiry.qualificationStatus)) throw new AppError('Only active Reception inquiries can receive a disposition.', 409, 'INVALID_TRANSITION');
    if (inquiry.readiness?.activeReceptionPhase !== 'ROM_HANDOFF') throw new AppError('Client dispositions are available only while the inquiry is in ROM and handoff.', 409, 'INVALID_TRANSITION');
    if (data.disposition === 'DECLINE' && !data.reason?.trim()) throw new AppError('A decline reason is required.', 400, 'VALIDATION_ERROR');
    if (data.disposition === 'PAUSE' && (!data.reason?.trim() || !data.nextReviewAt)) throw new AppError('A pause reason and next review date are required.', 400, 'VALIDATION_ERROR');
    if (data.disposition === 'MORE_INFORMATION' && !data.followUp) throw new AppError('A dated, assigned follow-up is required for more information.', 400, 'VALIDATION_ERROR');
    if (data.followUp) await assertActiveAssignee(data.followUp.ownerId, 'Follow-up owner');
    const evidence = await prisma.inquiryActivity.findFirst({ where: { id: data.activityId, inquiryId: inquiry.id, clientId: inquiry.clientId } });
    if (!evidence || evidence.outcomeCode !== 'CLIENT_DISPOSITION_RECEIVED' || evidence.clientDispositionValue !== data.disposition) {
      throw new AppError('The selected activity does not document this client disposition.', 400, 'VALIDATION_ERROR');
    }
    if (inquiry.clientDispositionReviewStatus !== 'PENDING_REVIEW' || inquiry.clientDispositionEvidenceActivityId !== evidence.id) {
      throw new AppError('Only the latest pending client response can be reviewed.', 409, 'STALE_DISPOSITION');
    }
    const clientPortalEvent = evidence.origin === 'CLIENT_PORTAL';
    let dispositionActorId = evidence.actorId;
    let sourceActivity = evidence;
    while (sourceActivity.correctionOfActivityId) {
      const parentActivity = await prisma.inquiryActivity.findFirst({
        where: { id: sourceActivity.correctionOfActivityId, inquiryId: inquiry.id },
        select: { id: true, actorId: true, origin: true, correctionOfActivityId: true },
      });
      if (!parentActivity) break;
      sourceActivity = parentActivity as typeof sourceActivity;
    }
    if (clientPortalEvent && sourceActivity.origin === 'CLIENT_PORTAL') dispositionActorId = sourceActivity.actorId;
    if (!clientPortalEvent && evidence.origin !== 'ADMIN') {
      throw new AppError('External client instructions must be documented by the reviewing Admin before confirmation.', 400, 'VALIDATION_ERROR');
    }
    if (!clientPortalEvent && !['PHONE', 'SMS', 'EMAIL', 'IN_PERSON', 'OTHER'].includes(evidence.channel)) {
      throw new AppError('Use a supported external client-response channel for the disposition evidence.', 400, 'VALIDATION_ERROR');
    }
    if (data.disposition === 'MORE_INFORMATION' && data.followUp?.criterionId) {
      const criterion = getReceptionCriterion(data.followUp.criterionId);
      const readiness = inquiry.readiness?.criteria.find((item: { id: string }) => item.id === data.followUp!.criterionId);
      if (!criterion || criterion.requirement !== 'DEFERRABLE' || readiness?.answerState !== 'UNKNOWN') {
        throw new AppError('This follow-up criterion is not an unresolved deferrable item.', 409, 'INVALID_CRITERION_FOLLOW_UP');
      }
    }
    const updated = await prisma.$transaction(async (tx) => {
      await advanceIntakeRevision(tx, inquiry.id, data.expectedIntakeRevision);
      if (clientPortalEvent && data.disposition !== evidence.clientDispositionValue) throw new AppError('The pending client response does not match this decision.', 409, 'CONFLICT');
      if (data.followUp) await tx.workItem.create({ data: {
        inquiryId: inquiry.id, criterionId: data.followUp.criterionId || null, stage: 'INQUIRY', type: 'TASK',
        title: data.followUp.title, description: data.followUp.description || null, status: 'OPEN', priority: 'HIGH',
        ownerId: data.followUp.ownerId, dueAt: data.followUp.dueAt, clientVisible: false, createdBy: req.user!.id,
      } });
      const nextStatus = data.disposition === 'PAUSE' ? 'NURTURED' : data.disposition === 'DECLINE' ? 'DECLINED' : undefined;
      const result = await tx.inquiry.update({ where: { id: inquiry.id }, data: {
        clientDisposition: data.disposition,
        clientDispositionComment: data.reason || evidence.outcomeDetail || null,
        clientDispositionSource: clientPortalEvent ? 'CLIENT_PORTAL' : evidence.channel,
        clientDispositionAt: evidence.occurredAt,
        clientDispositionRecordedBy: clientPortalEvent ? dispositionActorId : evidence.actorId,
        clientDispositionClientUserId: clientPortalEvent ? dispositionActorId : null,
        clientDispositionEvidenceActivityId: evidence.id,
        clientDispositionReviewStatus: 'REVIEWED',
        clientDispositionReviewedAt: new Date(),
        clientDispositionReviewedBy: req.user!.id,
        ...(nextStatus ? { qualificationStatus: nextStatus } : {}),
        ...(data.disposition === 'PAUSE' ? { nextAction: `Review paused inquiry: ${data.reason}`, nextActionDueAt: data.nextReviewAt } : {}),
        ...(data.disposition === 'DECLINE' ? { declineReason: data.reason } : {}),
      } });
      await saveCriterionState(tx, { inquiryId: inquiry.id, criterionId: 'CLIENT_DISPOSITION', answerState: 'CONFIRMED', reason: null, source: 'ADMIN', actorId: req.user!.id });
      await refreshLegacyReviewStatus(tx, inquiry.id);
      await writeAuditEvent(tx, { userId: req.user!.id, action: 'REVIEW_CLIENT_DISPOSITION', entityType: 'Inquiry', entityId: inquiry.id, requestId: (req as any).requestId, before: { clientDisposition: inquiry.clientDisposition, qualificationStatus: inquiry.qualificationStatus }, after: result });
      return result;
    });
    res.json(await getAccessibleInquiry(req, updated.id));
  } catch (error) { next(error); }
});

router.post('/inquiries/:id/handoff-review', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req);
    const inquiry = await getAccessibleInquiry(req, req.params.id);
    const data = handoffReviewSchema.parse(req.body);
    if (data.workflowVersion !== RECEPTION_WORKFLOW_VERSION) throw new AppError('The workflow rules changed. Reload the inquiry before reviewing it.', 409, 'STALE_INTAKE_REVISION', { expectedWorkflowVersion: RECEPTION_WORKFLOW_VERSION });
    const review = await prisma.$transaction(async (tx) => {
      const currentRow = await tx.inquiry.findFirst({ where: { id: inquiry.id, intakeRevision: data.expectedIntakeRevision }, include: {
        client: true, property: true, consultations: { where: { deletedAt: null } }, workItems: { where: { deletedAt: null } },
        criterionStates: true, evidence: true, handoffReviews: { orderBy: { reviewedAt: 'desc' }, take: 1 },
      } });
      if (!currentRow) await advanceIntakeRevision(tx, inquiry.id, data.expectedIntakeRevision);
      const current = presentInquiry(currentRow!);
      const latest = currentRow!.handoffReviews[0] || null;
      const readiness = evaluateReceptionReadiness({ ...current, handoffReview: latest, evidence: currentRow!.evidence });
      const preReviewCriteria = readiness.criteria.filter((criterion) => criterion.id !== 'HANDOFF_REVIEW');
      const blockers = preReviewCriteria.filter((criterion) => criterion.blocker);
      const builtPreview = buildRomPreviewSnapshot(current);
      let storedPreviewIntegrity = false;
      try { storedPreviewIntegrity = Boolean(currentRow!.romPreviewSnapshot && currentRow!.romPreviewHash && hashJson(JSON.parse(currentRow!.romPreviewSnapshot)) === currentRow!.romPreviewHash); } catch { storedPreviewIntegrity = false; }
      const previewIsCurrent = currentRow!.romPreviewSnapshot && currentRow!.romPreviewHash
        && currentRow!.romPreviewRevision === data.expectedIntakeRevision
        && storedPreviewIntegrity && builtPreview.complete;
      if (!previewIsCurrent && !blockers.some((item) => item.id === 'PRELIMINARY_BRIEF')) {
        blockers.push(readiness.criteria.find((criterion) => criterion.id === 'PRELIMINARY_BRIEF')!);
      }
      const checklist = {
        workflowVersion: RECEPTION_WORKFLOW_VERSION,
        intakeRevision: currentRow!.intakeRevision,
        activeReceptionPhase: readiness.activeReceptionPhase,
        criteria: readiness.criteria.map(({ id, phase, requirement, answerState, complete, deferred, blocker, reason }) => ({ id, phase, requirement, answerState, complete, deferred, blocker, reason })),
        blockers: blockers.map(({ id, label, blocker, fieldPaths }) => ({ id, label, blocker, fieldPaths })),
      };
      const previewSnapshot = previewIsCurrent ? currentRow!.romPreviewSnapshot! : JSON.stringify(builtPreview.snapshot);
      const previewHash = previewIsCurrent ? currentRow!.romPreviewHash! : builtPreview.hash;
      const result = blockers.length ? 'RETURNED' : 'APPROVED';
      try {
        return await tx.inquiryHandoffReview.create({ data: {
          inquiryId: inquiry.id, reviewerId: req.user!.id, result,
          intakeRevision: data.expectedIntakeRevision, workflowVersion: RECEPTION_WORKFLOW_VERSION,
          checklistSnapshot: JSON.stringify(checklist), checklistHash: hashJson(checklist),
          romPreviewSnapshot: previewSnapshot, romPreviewHash: previewHash, reason: data.reason || (blockers.length ? 'Resolve the blockers listed in the review snapshot and resubmit.' : null),
        } });
      } catch (error: any) {
        if (error?.code !== 'P2002') throw error;
        const prior = await tx.inquiryHandoffReview.findFirst({ where: { inquiryId: inquiry.id, intakeRevision: data.expectedIntakeRevision, workflowVersion: RECEPTION_WORKFLOW_VERSION } });
        if (prior) return prior;
        throw error;
      }
    });
    res.status(201).json(review);
  } catch (error) { next(error); }
});

router.put('/inquiries/:id/criteria/:criterionId/state', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req);
    const before = await getAccessibleInquiry(req, req.params.id);
    if (!['NEW', 'IN_REVIEW', 'QUALIFIED'].includes(before.qualificationStatus)) {
      throw new AppError('Only active Reception inquiries can have criterion state reviewed.', 409, 'INVALID_TRANSITION');
    }
    const criterion = getReceptionCriterion(req.params.criterionId);
    if (!criterion) throw new AppError('Unknown Reception criterion.', 404, 'NOT_FOUND');
    const data = criterionStateUpdateSchema.parse(req.body);
    const answerValue = data.answerValue?.trim();

    if (data.answerState === 'NOT_APPLICABLE'
      && (!criterion.notApplicableAllowed || !data.reason?.trim())) {
      throw new AppError('Not applicable is allowed only for survey status and requires an Admin reason.', 400, 'VALIDATION_ERROR');
    }
    if (answerValue !== undefined) {
      const permittedValue = (criterion.id === 'MUST_HAVE_FEATURES' && answerValue === 'NONE_IDENTIFIED')
        || (criterion.id === 'INSPIRATION_STATUS' && answerValue === 'NONE_PROVIDED');
      if (!permittedValue || data.answerState !== 'CONFIRMED') {
        throw new AppError('An explicit none answer is available only for must-have features or design inspiration.', 400, 'VALIDATION_ERROR');
      }
    }
    const candidate = { ...before };
    if (answerValue === 'NONE_IDENTIFIED') {
      candidate.discovery = { ...(before.discovery || {}), mustHaveFeatures: answerValue };
    } else if (answerValue === 'NONE_PROVIDED') {
      candidate.designInspirations = answerValue;
    }
    const reviewedNotRequiredAgreement = criterion.id === 'DESIGN_AGREEMENT'
      && before.designAgreementStatus === 'NOT_REQUIRED'
      && Boolean(data.reason?.trim());
    if (data.answerState === 'CONFIRMED' && !hasReceptionCriterionAnswer(candidate, criterion.id) && !reviewedNotRequiredAgreement) {
      throw new AppError('This criterion has no valid canonical answer to confirm. Enter an answer or explicitly record an allowed none answer.', 400, 'VALIDATION_ERROR');
    }
    if (data.answerState === 'UNKNOWN' && hasReceptionCriterionAnswer(before, criterion.id)) {
      throw new AppError('A recorded answer must be corrected or cleared before it can be marked unknown.', 400, 'VALIDATION_ERROR');
    }

    await prisma.$transaction(async (tx) => {
      await advanceIntakeRevision(tx, before.id, data.expectedIntakeRevision);
      if (answerValue === 'NONE_IDENTIFIED') {
        await tx.inquiry.update({
          where: { id: before.id },
          data: { discoveryData: JSON.stringify(candidate.discovery), discoveryCompletedAt: discoveryIsComplete(candidate.discovery) ? new Date() : null },
        });
      } else if (answerValue === 'NONE_PROVIDED') {
        await tx.inquiry.update({ where: { id: before.id }, data: { designInspirations: answerValue } });
      }
      await saveCriterionState(tx, {
        inquiryId: before.id,
        criterionId: criterion.id,
        answerState: data.answerState,
        reason: data.reason,
        source: 'ADMIN',
        actorId: req.user!.id,
      });
      await refreshLegacyReviewStatus(tx, before.id);
    });

    res.json(await getAccessibleInquiry(req, before.id));
  } catch (error) { next(error); }
});

router.put('/inquiries/:id/intake', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req);
    const before = await getAccessibleInquiry(req, req.params.id);
    if (!['NEW', 'IN_REVIEW', 'QUALIFIED'].includes(before.qualificationStatus)) {
      throw new AppError('Only active Reception inquiries can be edited here.', 409, 'INVALID_TRANSITION');
    }
    const data = intakeUpdateSchema.parse(req.body);
    const { expectedIntakeRevision, client: clientData, property: propertyData, inquiry: inquiryData } = data;
    const inquiry = await prisma.$transaction(async (tx) => {
      await advanceIntakeRevision(tx, before.id, expectedIntakeRevision);

      await tx.client.update({
        where: { id: before.clientId },
        data: clientData,
      });

      let propertyId = before.propertyId;
      if (propertyData) {
        if (before.propertyId) {
          const updated = await tx.property.updateMany({
            where: { id: before.propertyId, clientId: before.clientId },
            data: propertyData,
          });
          if (updated.count !== 1) throw new AppError('The inquiry property could not be found.', 409, 'CONFLICT');
        } else {
          const property = await tx.property.create({
            data: { ...propertyData, clientId: before.clientId, organizationId: process.env.ORGANIZATION_ID || null },
          });
          propertyId = property.id;
        }
      }

      const relatedInquiryWhere: any[] = [{ clientId: before.clientId }];
      if (before.propertyId && propertyData) relatedInquiryWhere.push({ propertyId: before.propertyId });
      await tx.inquiry.updateMany({
        where: {
          id: { not: before.id },
          qualificationStatus: { in: ['NEW', 'IN_REVIEW', 'QUALIFIED'] },
          OR: relatedInquiryWhere,
        },
        data: { intakeRevision: { increment: 1 } },
      });

      const updated = await tx.inquiry.update({
        where: { id: before.id },
        data: { ...inquiryData, ...(propertyId !== before.propertyId ? { propertyId } : {}) },
        include: { client: true, property: true },
      });
      const statefulUpdated = await getTransactionInquiry(tx, updated.id);
      if (statefulUpdated) await syncExplicitCriterionChanges(tx, before, statefulUpdated, req.user!.id, 'ADMIN');
      await writeAuditEvent(tx, {
        userId: req.user!.id,
        action: 'INTAKE_UPDATE',
        entityType: 'Inquiry',
        entityId: updated.id,
        requestId: (req as any).requestId,
        before,
        after: updated,
      });
      return updated;
    });
    res.json(await getAccessibleInquiry(req, inquiry.id));
  } catch (error) { next(error); }
});

router.put('/inquiries/:id', async (req: AuthRequest, res, next) => {
  try {
    const before = await getAccessibleInquiry(req, req.params.id);
    const data = inquiryUpdateSchema.parse(req.body);
    if (req.user?.role === 'CLIENT' && data.romProposalDetails !== undefined) {
      throw new AppError('Only an internal representative can edit the ROM proposal.', 403, 'FORBIDDEN');
    }
    if (req.user?.role === 'CLIENT' && ['DECLINED', 'CONVERTED'].includes(before.qualificationStatus)) {
      throw new AppError('This inquiry is closed and can no longer be edited.', 409, 'INVALID_TRANSITION');
    }
    if (req.user?.role === 'CLIENT' && (data.propertyId !== undefined || data.ownerId !== undefined || data.nextAction !== undefined || data.nextActionDueAt !== undefined)) {
      throw new AppError('Clients cannot change internal ownership, property links, or next actions.', 403, 'FORBIDDEN');
    }
    if (data.propertyId) {
      const property = await prisma.property.findFirst({ where: { id: data.propertyId, clientId: before.clientId } });
      if (!property) throw new AppError('Property does not belong to this client.', 400, 'VALIDATION_ERROR');
    }
    await assertActiveAssignee(data.ownerId, 'Inquiry owner');
    if (req.user?.role === 'CLIENT' && data.discovery !== undefined) {
      throw new AppError('Only an internal representative can complete pre-design discovery.', 403, 'FORBIDDEN');
    }
    const { property: propertyData, discovery, expectedIntakeRevision, ...inquiryData } = data;
    const auditAction = req.user?.role === 'CLIENT'
      ? 'CLIENT_UPDATE'
      : data.romStatus !== undefined
        ? 'ROM_DECISION'
        : data.designAgreementStatus !== undefined
          ? 'DESIGN_AGREEMENT_DECISION'
          : data.handoffSummary !== undefined
            ? 'HANDOFF_UPDATE'
            : 'UPDATE';
    const inquiry = await prisma.$transaction(async (tx) => {
      await advanceIntakeRevision(tx, before.id, expectedIntakeRevision);
      let propertyId = before.propertyId;
      if (propertyData) {
        if (before.propertyId) {
          await tx.property.update({ where: { id: before.propertyId }, data: propertyData });
        } else {
          const property = await tx.property.create({
            data: { ...propertyData, clientId: before.clientId, organizationId: process.env.ORGANIZATION_ID || null },
          });
          propertyId = property.id;
        }
        if (before.propertyId) {
          await tx.inquiry.updateMany({
            where: {
              id: { not: before.id },
              propertyId: before.propertyId,
              qualificationStatus: { in: ['NEW', 'IN_REVIEW', 'QUALIFIED'] },
            },
            data: { intakeRevision: { increment: 1 } },
          });
        }
      }
      const updated = await tx.inquiry.update({
        where: { id: before.id },
        data: {
          ...inquiryData,
          ...(propertyId !== before.propertyId ? { propertyId } : {}),
          ...(discovery !== undefined ? {
            discoveryData: JSON.stringify(discovery),
            discoveryCompletedAt: discoveryIsComplete(discovery) ? new Date() : null,
          } : {}),
        },
      });
      const statefulUpdated = await getTransactionInquiry(tx, updated.id);
      if (statefulUpdated) await syncExplicitCriterionChanges(tx, before, statefulUpdated, req.user!.id, req.user?.role === 'CLIENT' ? 'CLIENT' : 'ADMIN');
      await writeAuditEvent(tx, {
        userId: req.user!.id,
        action: auditAction,
        entityType: 'Inquiry', entityId: updated.id, requestId: (req as any).requestId,
        before, after: { ...updated, property: propertyData || before.property },
      });
      return updated;
    });
    if (data.ownerId && data.ownerId !== before.ownerId) {
      await prisma.notification.create({
        data: { userId: data.ownerId, type: 'INQUIRY_ASSIGNED', message: `You were assigned the ${before.client.name} inquiry.`, clientId: before.clientId, inquiryId: before.id },
      });
    }
    res.json(await getAccessibleInquiry(req, inquiry.id));
  } catch (error) { next(error); }
});

router.post('/inquiries/:id/status', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req);
    const before = await getAccessibleInquiry(req, req.params.id);
    const data = statusSchema.parse(req.body);
    if (!transitions[before.qualificationStatus]?.includes(data.status)) {
      throw new AppError(`Inquiry cannot transition from ${before.qualificationStatus} to ${data.status}.`, 409, 'INVALID_TRANSITION');
    }
    if (['DECLINED', 'NURTURED'].includes(data.status) && !data.reason) {
      throw new AppError('A reason is required for declined or nurtured inquiries.', 400, 'VALIDATION_ERROR');
    }
    if (data.status === 'IN_REVIEW' || data.status === 'QUALIFIED') {
      const phaseIndex = data.status === 'IN_REVIEW' ? 0 : 1;
      const missing = before.readiness?.phases[phaseIndex]?.blockers
        .filter((criterion: { id: string }) => !(data.status === 'QUALIFIED' && criterion.id === 'QUALIFICATION_APPROVAL'));
      if (missing?.length) {
        throw new AppError('Complete or explicitly defer the current phase requirements before moving this inquiry forward.', 409, 'GATE_BLOCKED', {
          blockers: missing.map((criterion: { id: string; label: string; fieldPaths: string[]; blocker: string | null }) => ({
            type: 'INQUIRY_CRITERION', criterionId: criterion.id, title: criterion.label, fieldPaths: criterion.fieldPaths, reason: criterion.blocker,
          })),
        });
      }
      if (!before.readiness) {
        const legacyMissing = incompleteInquiryPhaseRequirements(before, phaseIndex);
        if (legacyMissing.length) throw new AppError('Complete the current phase before moving this inquiry forward.', 409, 'GATE_BLOCKED', { blockers: legacyMissing.map(({ title }) => ({ type: 'INQUIRY_PHASE_REQUIREMENT', title })) });
      }
      if (data.status === 'QUALIFIED') await assertActiveAssignee(before.ownerId, 'Inquiry owner');
    }
    const inquiry = await prisma.$transaction(async (tx) => {
      await advanceIntakeRevision(tx, before.id, data.expectedIntakeRevision);
      const updated = await tx.inquiry.update({
        where: { id: before.id },
        data: { qualificationStatus: data.status, declineReason: data.reason || null },
      });
      if (data.status === 'QUALIFIED') {
        await saveCriterionState(tx, {
          inquiryId: before.id,
          criterionId: 'QUALIFICATION_APPROVAL',
          answerState: 'CONFIRMED',
          reason: 'Admin approved the inquiry for site meeting and ROM preparation.',
          source: 'ADMIN',
          actorId: req.user!.id,
        });
        await refreshLegacyReviewStatus(tx, before.id);
      }
      await writeAuditEvent(tx, { userId: req.user!.id, action: data.status, entityType: 'Inquiry', entityId: updated.id, requestId: (req as any).requestId, before, after: updated });
      return updated;
    });
    res.json(inquiry);
  } catch (error) { next(error); }
});

router.post('/inquiries/:id/compliance-verification', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req);
    const before = await getAccessibleInquiry(req, req.params.id);
    const data = complianceVerificationSchema.parse(req.body);
    if (data.status === 'VERIFIED' && (!data.source || !data.categories)) {
      throw new AppError('Verified compliance requires a source and categories.', 400, 'VALIDATION_ERROR');
    }
    const now = new Date();
    const discovery = before.discovery && typeof before.discovery === 'object'
      ? { ...before.discovery, ...(data.status === 'VERIFIED' ? { complianceFollowUpStatus: 'VERIFIED' } : {}) }
      : null;
    const inquiry = await prisma.$transaction(async (tx) => {
      await advanceIntakeRevision(tx, before.id, data.expectedIntakeRevision);
      const updated = await tx.inquiry.update({
        where: { id: before.id },
        data: {
          complianceVerificationStatus: data.status,
          complianceVerificationCheckedAt: now,
          complianceVerificationSource: data.source || null,
          complianceVerificationCategories: data.categories || null,
          complianceVerificationLinks: data.links || null,
          complianceVerificationNotes: data.notes || null,
          complianceVerificationReviewedBy: data.status === 'VERIFIED' ? req.user!.id : null,
          complianceVerificationReviewedAt: data.status === 'VERIFIED' ? now : null,
          discoveryData: discovery ? JSON.stringify(discovery) : undefined,
        },
      });
      await writeAuditEvent(tx, { userId: req.user!.id, action: 'COMPLIANCE_VERIFY', entityType: 'Inquiry', entityId: updated.id, requestId: (req as any).requestId, before, after: updated });
      return updated;
    });
    res.json(await getAccessibleInquiry(req, inquiry.id));
  } catch (error) { next(error); }
});

router.post('/inquiries/:id/compliance-research', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req);
    const { expectedIntakeRevision } = z.object({ expectedIntakeRevision: z.number().int().positive() }).parse(req.body);
    const inquiry = await getAccessibleInquiry(req, req.params.id);
    if (!inquiry.property?.address?.trim()) {
      throw new AppError('Add a property address before starting compliance research.', 409, 'CONFLICT');
    }
    if (!isArizonaState(inquiry.property.state)) {
      throw new AppError('Automated compliance research currently supports Arizona properties only. Set the property state to AZ and try again.', 422, 'VALIDATION_ERROR');
    }
    const savedLinks = await prisma.inquiryComplianceLink.findMany({ where: { inquiryId: inquiry.id }, orderBy: { addedAt: 'desc' } });
    const activeJob = await prisma.complianceResearchJob.findFirst({
      where: { inquiryId: inquiry.id, status: { in: ['QUEUED', 'RUNNING'] } },
      include: { sources: { orderBy: { retrievedAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });
    if (activeJob) return res.status(202).json({ job: activeJob, savedLinks, verification: {
      status: inquiry.complianceVerificationStatus,
      categories: inquiry.complianceVerificationCategories,
      links: inquiry.complianceVerificationLinks,
      notes: inquiry.complianceVerificationNotes,
      checkedAt: inquiry.complianceVerificationCheckedAt,
    } });

    const job = await prisma.$transaction(async (tx) => {
      await advanceIntakeRevision(tx, inquiry.id, expectedIntakeRevision);
      const created = await tx.complianceResearchJob.create({ data: { inquiryId: inquiry.id, requestedBy: req.user!.id } });
      await tx.inquiry.update({ where: { id: inquiry.id }, data: { complianceVerificationStatus: 'IN_PROGRESS' } });
      await writeAuditEvent(tx, {
        userId: req.user!.id,
        action: 'COMPLIANCE_RESEARCH_STARTED',
        entityType: 'Inquiry',
        entityId: inquiry.id,
        requestId: (req as any).requestId,
        details: { jobId: created.id },
        after: { complianceVerificationStatus: 'IN_PROGRESS' },
      });
      return created;
    });
    res.status(202).json({ job: { ...job, sources: [] }, savedLinks, verification: { status: 'IN_PROGRESS' } });
  } catch (error) { next(error); }
});

router.post('/inquiries/:id/compliance-links', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req);
    const inquiry = await getAccessibleInquiry(req, req.params.id);
    const { expectedIntakeRevision, ...data } = saveComplianceLinkSchema.parse(req.body);
    const existing = await prisma.inquiryComplianceLink.findUnique({ where: { inquiryId_url: { inquiryId: inquiry.id, url: data.url } } });
    if (existing) return res.status(200).json(existing);
    const link = await prisma.$transaction(async (tx) => {
      await advanceIntakeRevision(tx, inquiry.id, expectedIntakeRevision);
      const saved = await tx.inquiryComplianceLink.upsert({
        where: { inquiryId_url: { inquiryId: inquiry.id, url: data.url } },
        create: { inquiryId: inquiry.id, ...data },
        update: {},
      });
      await writeAuditEvent(tx, {
        userId: req.user!.id,
        action: 'COMPLIANCE_SOURCE_SAVED',
        entityType: 'Inquiry',
        entityId: inquiry.id,
        requestId: (req as any).requestId,
        details: { savedLinkId: saved.id, url: saved.url, domain: saved.domain },
      });
      return saved;
    });
    res.status(200).json(link);
  } catch (error) { next(error); }
});

router.get('/inquiries/:id/compliance-research', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req);
    const inquiry = await getAccessibleInquiry(req, req.params.id);
    const job = await prisma.complianceResearchJob.findFirst({
      where: { inquiryId: inquiry.id },
      include: { sources: { orderBy: { retrievedAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });
    const savedLinks = await prisma.inquiryComplianceLink.findMany({ where: { inquiryId: inquiry.id }, orderBy: { addedAt: 'desc' } });
    res.json({
      job,
      savedLinks,
      verification: {
        status: inquiry.complianceVerificationStatus,
        categories: inquiry.complianceVerificationCategories,
        links: inquiry.complianceVerificationLinks,
        notes: inquiry.complianceVerificationNotes,
        checkedAt: inquiry.complianceVerificationCheckedAt,
      },
    });
  } catch (error) { next(error); }
});

router.post('/inquiries/:id/missing-information', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req);
    const inquiry = await getAccessibleInquiry(req, req.params.id);
    const data = z.object({
      title: z.string().trim().min(3).max(200),
      description: z.string().trim().max(5000).optional(),
      dueAt: z.coerce.date(),
      criterionId: z.string().trim().max(100).optional(),
      expectedIntakeRevision: z.number().int().positive(),
    }).parse(req.body);
    if (data.criterionId) {
      const criterion = getReceptionCriterion(data.criterionId);
      const readiness = inquiry.readiness?.criteria.find((item: { id: string }) => item.id === data.criterionId);
      if (!criterion || criterion.requirement !== 'DEFERRABLE' || readiness?.answerState !== 'UNKNOWN') {
        throw new AppError('A criterion-linked follow-up is allowed only for an unresolved deferrable criterion.', 409, 'INVALID_CRITERION_FOLLOW_UP');
      }
    }
    const clientUser = await prisma.user.findFirst({ where: { clientId: inquiry.clientId, role: 'CLIENT', active: true } });
    if (!clientUser) throw new AppError('The client needs a portal account before information can be requested.', 409, 'CONFLICT');
    const item = await prisma.$transaction(async (tx) => {
      await advanceIntakeRevision(tx, inquiry.id, data.expectedIntakeRevision);
      const created = await tx.workItem.create({
        data: {
          inquiryId: inquiry.id, criterionId: data.criterionId || null, projectId: null, stage: 'INQUIRY', type: 'MISSING_INFORMATION',
          title: data.title, description: data.description, status: 'OPEN', priority: 'HIGH',
          ownerId: clientUser.id, reviewerId: req.user!.id, dueAt: data.dueAt,
          clientVisible: true, createdBy: req.user!.id,
        },
      });
      await tx.notification.create({
        data: { userId: clientUser.id, type: 'MISSING_INFORMATION', message: data.title, clientId: inquiry.clientId, inquiryId: inquiry.id, itemId: created.id },
      });
      await writeAuditEvent(tx, { userId: req.user!.id, action: 'REQUEST', entityType: 'WorkItem', entityId: created.id, requestId: (req as any).requestId, after: created });
      return created;
    });
    res.status(201).json(item);
  } catch (error) { next(error); }
});

router.post('/inquiries/:id/convert', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req);
    const before = await getAccessibleInquiry(req, req.params.id);
    if (before.qualificationStatus === 'CONVERTED' && before.project) {
      return res.status(200).json({ ...before.project, result: 'CONVERTED', inquiry: before, client: before.client, project: before.project });
    }
    if (before.qualificationStatus !== 'QUALIFIED') throw new AppError('Only qualified inquiries can be converted.', 409, 'INVALID_TRANSITION');
    const { expectedIntakeRevision } = z.object({ expectedIntakeRevision: z.number().int().positive() }).parse(req.body);
    await assertActiveAssignee(before.ownerId, 'Inquiry owner');
    const blockers: Array<{ type: string; criterionId?: string; title: string; fieldPaths?: string[]; reason?: string | null }> =
      before.readiness?.criteria
        .filter((criterion: { blocker: string | null }) => Boolean(criterion.blocker))
        .map((criterion: { id: string; label: string; fieldPaths: string[]; blocker: string | null }) => ({
          type: 'INQUIRY_CRITERION', criterionId: criterion.id, title: criterion.label, fieldPaths: criterion.fieldPaths, reason: criterion.blocker,
        })) || [];
    if (!before.readiness) {
      const consultation = before.consultations.find((item: any) => item.status === 'COMPLETED' && item.outcome && (item.activityType === 'SITE_MEETING' || /site\s+meeting/i.test(item.title)));
      blockers.push(...[
        !before.propertyId && 'Property is required.', !before.objectives && 'Objectives are required.',
        !before.preliminaryScope && 'Preliminary scope is required.', !before.ownerId && 'An owner is required.',
        !consultation && 'At least one completed site meeting outcome is required.',
        before.workItems.some((item: any) => !['VERIFIED', 'CLOSED', 'CANCELLED'].includes(item.status)) && 'All missing-information requests must be verified.',
        !discoveryIsComplete(before.discovery) && 'Pre-design discovery must be completed by a representative.',
      ].filter(Boolean).map((title) => ({ type: 'INQUIRY_REQUIREMENT', title: String(title) })));
      const phaseThreeMissing = incompleteInquiryPhaseRequirements(before, 2);
      blockers.push(...phaseThreeMissing.map(({ title }) => ({ type: 'INQUIRY_PHASE_REQUIREMENT', title })));
      const phaseFourMissing = incompleteInquiryPhaseRequirements(before, 3).filter(({ title }) => title !== 'Design handoff completed');
      blockers.push(...phaseFourMissing.map(({ title }) => ({ type: 'INQUIRY_PHASE_REQUIREMENT', title })));
    }
    if (blockers.length) throw new AppError('The inquiry cannot advance to Design.', 409, 'GATE_BLOCKED', { blockers });
    let project;
    try {
      project = await prisma.$transaction(async (tx) => {
      const currentRow = await tx.inquiry.findUnique({ where: { id: before.id }, include: {
        client: true, property: true, owner: { select: { id: true, role: true, active: true } },
        consultations: { where: { deletedAt: null } }, workItems: { where: { deletedAt: null } }, criterionStates: true,
        evidence: true, handoffReviews: { orderBy: { reviewedAt: 'desc' }, take: 1 },
      } });
      if (!currentRow) throw new AppError('Inquiry not found.', 404, 'NOT_FOUND');
      if (currentRow.intakeRevision !== expectedIntakeRevision) {
        throw new AppError('This inquiry changed after you opened it. Review the latest saved information and try again.', 409, 'STALE_INTAKE_REVISION', { expectedIntakeRevision, currentIntakeRevision: currentRow.intakeRevision });
      }
      if (currentRow.qualificationStatus === 'CONVERTED' && currentRow.projectId) {
        throw new AppError('This inquiry was already converted.', 409, 'CONFLICT', { existingProjectId: currentRow.projectId });
      }
      if (currentRow.qualificationStatus !== 'QUALIFIED') {
        throw new AppError('This inquiry is no longer ready for conversion.', 409, 'INVALID_TRANSITION');
      }
      const currentInquiry = presentInquiry(currentRow);
      const latestReview = currentRow.handoffReviews[0] || null;
      const currentReadiness = evaluateReceptionReadiness({ ...currentInquiry, handoffReview: latestReview, evidence: currentRow.evidence });
      const currentBlockers = currentReadiness.criteria.filter((criterion) => Boolean(criterion.blocker));
      if (currentBlockers.length) throw new AppError('The inquiry cannot advance to Design.', 409, 'GATE_BLOCKED', {
        blockers: currentBlockers.map(({ id, label, fieldPaths, blocker }) => ({ type: 'INQUIRY_CRITERION', criterionId: id, title: label, fieldPaths, reason: blocker })),
      });
      const existingProject = await tx.poolProject.findUnique({ where: { clientId: before.clientId }, select: { id: true } });
      if (existingProject) throw new AppError('This client already has a project.', 409, 'CONFLICT', { existingProjectId: existingProject.id });
      const created = await tx.poolProject.create({
        data: {
          clientId: before.clientId,
          estimatedBudget: before.romAmount || before.budgetExpectation,
          notes: [before.preliminaryScope, before.handoffSummary ? `Design handoff summary:\n${before.handoffSummary}` : null].filter(Boolean).join('\n\n'),
          currentPhase: 1,
          status: 'INTAKE',
        },
      });
      for (const template of phaseTemplates) {
        const phase = await tx.projectPhase.create({
          data: {
            projectId: created.id, name: template.name, displayName: template.displayName,
            order: template.order, description: template.description,
            status: template.order === 1 ? 'IN_PROGRESS' : 'NOT_STARTED',
            startDate: template.order === 1 ? new Date() : null,
          },
        });
        await tx.checklistItem.createMany({ data: template.checklistItems.map((item) => ({ phaseId: phase.id, ...item })) });
      }
      const converted = await tx.inquiry.updateMany({ where: { id: before.id, intakeRevision: expectedIntakeRevision, qualificationStatus: 'QUALIFIED' }, data: { projectId: created.id, qualificationStatus: 'CONVERTED', convertedAt: new Date(), handoffApprovedAt: new Date() } });
      if (converted.count !== 1) throw new AppError('The inquiry changed while conversion was being completed.', 409, 'STALE_INTAKE_REVISION');
      await initializeWorkflowProject(tx, created.id, { organizationId: process.env.ORGANIZATION_ID || null, ownerId: before.ownerId });
      const now = new Date();
      await tx.poolProject.update({ where: { id: created.id }, data: { currentLifecycleStage: 'DESIGN', workflowVersion: 1, workflowEnabled: true } });
      await tx.client.update({ where: { id: before.clientId }, data: { status: 'ACTIVE' } });
      await tx.lifecycleStage.update({ where: { projectId_stage: { projectId: created.id, stage: 'INQUIRY' } }, data: { status: 'APPROVED', completedAt: now } });
      await tx.lifecycleStage.update({ where: { projectId_stage: { projectId: created.id, stage: 'DESIGN' } }, data: { status: 'IN_PROGRESS', startedAt: now } });
      const gate = await tx.projectGate.update({
        where: { projectId_fromStage_toStage: { projectId: created.id, fromStage: 'INQUIRY', toStage: 'DESIGN' } },
        data: { status: 'APPROVED', approvedBy: req.user!.id, approvedAt: now, requiredItems: JSON.stringify(['CLIENT', 'PROPERTY', 'OBJECTIVES', 'PRELIMINARY_SCOPE', 'QUALIFICATION', 'OWNER', 'CONSULTATION_OUTCOME']) },
      });
      await tx.approval.create({ data: { projectId: created.id, gateId: gate.id, approvalType: 'INQUIRY_GATE', approverId: req.user!.id, result: 'APPROVED' } });
      await writeAuditEvent(tx, { userId: req.user!.id, action: 'CONVERT', entityType: 'Inquiry', entityId: before.id, requestId: (req as any).requestId, before: currentInquiry, after: { projectId: created.id, status: 'CONVERTED', stage: 'DESIGN', handoffReviewId: latestReview?.id } });
      return tx.poolProject.findUniqueOrThrow({ where: { id: created.id } });
      });
    } catch (error: any) {
      // A second request can pass the initial read before the first request
      // commits. The unique client-project constraint is the final guard.
      if (error?.code === 'P2002' || (error instanceof AppError && error.details?.existingProjectId)) {
        const existingInquiry = await prisma.inquiry.findUnique({ where: { id: before.id }, select: { qualificationStatus: true, projectId: true } });
        const existingProject = await prisma.poolProject.findUnique({ where: { clientId: before.clientId } });
        if (existingInquiry?.qualificationStatus === 'CONVERTED' && existingInquiry.projectId && existingProject?.id === existingInquiry.projectId) {
          const converted = await getAccessibleInquiry(req, before.id);
          return res.status(200).json({ ...existingProject, result: 'CONVERTED', inquiry: converted, client: converted.client, project: existingProject });
        }
      }
      throw error;
    }
    const converted = await getAccessibleInquiry(req, before.id);
    res.status(201).json({ ...project, result: 'CONVERTED', inquiry: converted, client: converted.client, project });
  } catch (error) { next(error); }
});

export default router;
