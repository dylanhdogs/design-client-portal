import express from 'express';
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
  if (role !== 'CLIENT') return presented;
  return {
    ...presented,
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

const statusSchema = z.object({
  status: z.enum(INQUIRY_STATUSES),
  reason: z.string().trim().max(5000).optional(),
});

const complianceVerificationSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'NEEDS_REVIEW', 'VERIFIED', 'FAILED']),
  source: z.string().trim().max(1000).nullable().optional(),
  categories: z.string().trim().max(3000).nullable().optional(),
  links: z.string().trim().max(5000).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
});

const savedComplianceLinkSchema = z.object({
  title: z.string().trim().min(1).max(300),
  url: z.string().trim().url().max(2000).refine((value) => {
    try { return new URL(value).protocol === 'https:'; } catch { return false; }
  }, 'Only HTTPS links can be saved.'),
  domain: z.string().trim().min(1).max(255),
  summary: z.string().trim().max(300).nullable().optional(),
  authorityType: z.enum(['CITY', 'COUNTY', 'STATE', 'HOA', 'OTHER']),
  authorityName: z.string().trim().min(1).max(200),
}).superRefine((data, context) => {
  try {
    if (new URL(data.url).hostname.toLowerCase() !== data.domain.toLowerCase()) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['domain'], message: 'The source domain must match the link.' });
    }
  } catch { /* URL validation reports malformed values. */ }
});

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

async function getAccessibleInquiry(req: AuthRequest, id: string) {
  const inquiry = await prisma.inquiry.findUnique({
    where: { id },
    include: {
      client: true, property: true,
      owner: { select: { id: true, name: true, email: true } },
      consultations: { where: { deletedAt: null }, orderBy: { date: 'desc' } },
      documents: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
      workItems: { where: { deletedAt: null }, orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }] },
      project: true,
    },
  });
  if (!inquiry) throw new AppError('Inquiry not found.', 404, 'NOT_FOUND');
  if (req.user?.role === 'CLIENT' && inquiry.clientId !== req.user.clientId) {
    throw new AppError('Inquiry not found.', 404, 'NOT_FOUND');
  }
  return presentInquiryForRole(inquiry, req.user?.role);
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
        include: { client: { select: { id: true, name: true, email: true, phone: true } }, property: true, owner: { select: { id: true, name: true } }, workItems: { where: { deletedAt: null }, orderBy: { dueAt: 'asc' } }, consultations: { where: { deletedAt: null }, select: { status: true, title: true, activityType: true, outcome: true } } },
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
          ownerId: req.user?.role === 'CLIENT' ? null : data.ownerId,
          nextAction: req.user?.role === 'CLIENT' ? 'Review submitted inquiry' : data.nextAction,
          nextActionDueAt: data.nextActionDueAt,
        },
      });
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

router.put('/inquiries/:id', async (req: AuthRequest, res, next) => {
  try {
    const before = await getAccessibleInquiry(req, req.params.id);
    const data = inquirySchema.partial().omit({ clientId: true }).parse(req.body);
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
    const { property: propertyData, discovery, ...inquiryData } = data;
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
      const missing = incompleteInquiryPhaseRequirements(before, phaseIndex);
      if (missing.length) throw new AppError('Complete the current phase before moving this inquiry forward.', 409, 'GATE_BLOCKED', { blockers: missing.map(({ title }) => ({ type: 'INQUIRY_PHASE_REQUIREMENT', title })) });
      if (data.status === 'QUALIFIED') await assertActiveAssignee(before.ownerId, 'Inquiry owner');
    }
    const inquiry = await prisma.inquiry.update({
      where: { id: before.id },
      data: { qualificationStatus: data.status, declineReason: data.reason || null },
    });
    await writeAuditEvent(prisma, { userId: req.user!.id, action: data.status, entityType: 'Inquiry', entityId: inquiry.id, requestId: (req as any).requestId, before, after: inquiry });
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
    const inquiry = await prisma.inquiry.update({
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
    await writeAuditEvent(prisma, { userId: req.user!.id, action: 'COMPLIANCE_VERIFY', entityType: 'Inquiry', entityId: inquiry.id, requestId: (req as any).requestId, before, after: inquiry });
    res.json(await getAccessibleInquiry(req, inquiry.id));
  } catch (error) { next(error); }
});

router.post('/inquiries/:id/compliance-research', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req);
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
    const data = savedComplianceLinkSchema.parse(req.body);
    const link = await prisma.inquiryComplianceLink.upsert({
      where: { inquiryId_url: { inquiryId: inquiry.id, url: data.url } },
      create: { inquiryId: inquiry.id, ...data },
      update: {},
    });
    await writeAuditEvent(prisma, {
      userId: req.user!.id,
      action: 'COMPLIANCE_SOURCE_SAVED',
      entityType: 'Inquiry',
      entityId: inquiry.id,
      requestId: (req as any).requestId,
      details: { savedLinkId: link.id, url: link.url, domain: link.domain },
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
    }).parse(req.body);
    const clientUser = await prisma.user.findFirst({ where: { clientId: inquiry.clientId, role: 'CLIENT', active: true } });
    if (!clientUser) throw new AppError('The client needs a portal account before information can be requested.', 409, 'CONFLICT');
    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.workItem.create({
        data: {
          inquiryId: inquiry.id, projectId: null, stage: 'INQUIRY', type: 'MISSING_INFORMATION',
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
    await assertActiveAssignee(before.ownerId, 'Inquiry owner');
    const consultation = before.consultations.find((item: any) => item.status === 'COMPLETED' && item.outcome && (item.activityType === 'SITE_MEETING' || /site\s+meeting/i.test(item.title)));
    const blockers = [
      !before.propertyId && 'Property is required.', !before.objectives && 'Objectives are required.',
      !before.preliminaryScope && 'Preliminary scope is required.', !before.ownerId && 'An owner is required.',
      !consultation && 'At least one completed site meeting outcome is required.',
      before.workItems.some((item: any) => !['VERIFIED', 'CLOSED', 'CANCELLED'].includes(item.status)) && 'All missing-information requests must be verified.',
      !discoveryIsComplete(before.discovery) && 'Pre-design discovery must be completed by a representative.',
    ].filter(Boolean).map((title) => ({ type: 'INQUIRY_REQUIREMENT', title }));
    const phaseThreeMissing = incompleteInquiryPhaseRequirements(before, 2);
    blockers.push(...phaseThreeMissing.map(({ title }) => ({ type: 'INQUIRY_PHASE_REQUIREMENT', title })));
    const phaseFourMissing = incompleteInquiryPhaseRequirements(before, 3).filter(({ title }) => title !== 'Design handoff completed');
    blockers.push(...phaseFourMissing.map(({ title }) => ({ type: 'INQUIRY_PHASE_REQUIREMENT', title })));
    if (blockers.length) throw new AppError('The inquiry cannot advance to Design.', 409, 'GATE_BLOCKED', { blockers });
    let project;
    try {
      project = await prisma.$transaction(async (tx) => {
      const current = await tx.inquiry.findUnique({ where: { id: before.id }, select: { qualificationStatus: true, projectId: true } });
      if (!current) throw new AppError('Inquiry not found.', 404, 'NOT_FOUND');
      if (current.qualificationStatus === 'CONVERTED' && current.projectId) {
        throw new AppError('This inquiry was already converted.', 409, 'CONFLICT', { existingProjectId: current.projectId });
      }
      if (current.qualificationStatus !== 'QUALIFIED') {
        throw new AppError('This inquiry is no longer ready for conversion.', 409, 'INVALID_TRANSITION');
      }
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
      await tx.inquiry.update({ where: { id: before.id }, data: { projectId: created.id, qualificationStatus: 'CONVERTED', convertedAt: new Date(), handoffApprovedAt: new Date() } });
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
      await writeAuditEvent(tx, { userId: req.user!.id, action: 'CONVERT', entityType: 'Inquiry', entityId: before.id, requestId: (req as any).requestId, before, after: { projectId: created.id, status: 'CONVERTED', stage: 'DESIGN' } });
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
