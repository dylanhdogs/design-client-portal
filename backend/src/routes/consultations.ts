import express from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { assertDeletionAllowed } from '../utils/operations';
import { authenticate, authorize, restrictToOwnClient, AuthRequest } from '../middleware/auth';
import { getPaginationParams, getPaginationResult } from '../utils/pagination';
import { logActivity } from '../utils/activity';
import { syncExplicitCriterionChanges } from '../workflow/criterionState';

const router = express.Router({ mergeParams: true });

const consultationSchema = z.object({
  title: z.string().min(1),
  activityType: z.enum(['SITE_MEETING', 'PHONE_CALL', 'VIDEO_CALL', 'HOA_ARC', 'MUNICIPAL', 'OTHER']).default('SITE_MEETING'),
  meetingMode: z.enum(['ONSITE', 'PHONE', 'VIDEO']).nullable().optional(),
  subject: z.string().trim().max(500).nullable().optional(),
  date: z.string().datetime().or(z.string().min(1)),
  endAt: z.string().datetime().or(z.string().min(1)).nullable().optional(),
  notes: z.string().optional(),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']).default('SCHEDULED'),
  inquiryId: z.string().uuid().nullable().optional(),
  outcome: z.string().trim().max(5000).nullable().optional(),
  participants: z.string().trim().max(2000).nullable().optional(),
  internalFollowers: z.string().trim().max(2000).nullable().optional(),
  nextAction: z.string().trim().max(1000).nullable().optional(),
  nextActionDueAt: z.string().datetime().or(z.string().min(1)).nullable().optional(),
  cancellationReason: z.string().trim().max(1000).nullable().optional(),
  expectedIntakeRevision: z.number().int().positive().optional(),
});

const activeInquiryStatuses = ['NEW', 'IN_REVIEW', 'QUALIFIED'];

function resolveMeetingMode(activityType: string, requested?: string | null, existing?: string | null): string | null {
  const mode = requested ?? existing ?? (activityType === 'PHONE_CALL' ? 'PHONE' : activityType === 'VIDEO_CALL' ? 'VIDEO' : null);
  const expected = activityType === 'SITE_MEETING' ? 'ONSITE' : activityType === 'PHONE_CALL' ? 'PHONE' : activityType === 'VIDEO_CALL' ? 'VIDEO' : null;
  if (expected && mode && mode !== expected) throw new AppError(`${activityType.replace('_', ' ')} must use ${expected.toLowerCase()} meeting mode.`, 400, 'VALIDATION_ERROR');
  return mode;
}

function validateMeetingMode(activityType: string, status: string, meetingMode: string | null) {
  if (status !== 'CANCELLED' && activityType === 'SITE_MEETING' && meetingMode !== 'ONSITE') {
    throw new AppError('A site meeting must be explicitly recorded as onsite.', 400, 'VALIDATION_ERROR');
  }
}

async function advanceInquiryRevision(tx: any, inquiryId: string, expectedRevision?: number) {
  if (expectedRevision === undefined) throw new AppError('Refresh this inquiry before changing its linked consultation.', 409, 'STALE_INTAKE_REVISION');
  const result = await tx.inquiry.updateMany({
    where: { id: inquiryId, intakeRevision: expectedRevision },
    data: { intakeRevision: { increment: 1 } },
  });
  if (result.count === 1) return;
  const current = await tx.inquiry.findUnique({ where: { id: inquiryId }, select: { intakeRevision: true } });
  if (!current) throw new AppError('Inquiry not found.', 404, 'NOT_FOUND');
  throw new AppError('This inquiry changed after you opened it. Reload the inquiry and try again.', 409, 'STALE_INTAKE_REVISION', {
    expectedIntakeRevision: expectedRevision,
    currentIntakeRevision: current.intakeRevision,
  });
}

async function getInquiryCriterionSnapshot(tx: any, inquiryId: string) {
  const inquiry = await tx.inquiry.findUnique({
    where: { id: inquiryId },
    include: {
      client: true,
      property: true,
      owner: { select: { id: true, role: true, active: true } },
      consultations: { where: { deletedAt: null } },
      documents: { where: { deletedAt: null } },
      workItems: { where: { deletedAt: null } },
      criterionStates: true,
    },
  });
  if (!inquiry) throw new AppError('Inquiry not found.', 404, 'NOT_FOUND');
  let discovery = {};
  try {
    const value = inquiry.discoveryData ? JSON.parse(inquiry.discoveryData) : {};
    if (value && typeof value === 'object' && !Array.isArray(value)) discovery = value;
  } catch { /* Keep malformed legacy JSON reviewable as empty discovery. */ }
  return { ...inquiry, discovery };
}

router.get('/', authenticate, restrictToOwnClient, async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { includeDeleted } = req.query;
    const pagination = getPaginationParams(req.query);
    if (includeDeleted === 'true' && (req as AuthRequest).user?.role === 'CLIENT') {
      throw new AppError('Archived consultations are available only to internal users.', 403, 'FORBIDDEN');
    }
    
    const where: any = { clientId };
    if (includeDeleted !== 'true') where.deletedAt = null;
    
    const [consultations, total] = await Promise.all([
      prisma.consultation.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
        include: { user: { select: { name: true } } }
      }),
      prisma.consultation.count({ where })
    ]);
    
    res.json({ data: consultations, pagination: getPaginationResult(total, pagination) });
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const data = consultationSchema.parse(req.body);
    if (data.status === 'CANCELLED' && !data.cancellationReason) throw new AppError('A cancellation reason is required.', 400, 'VALIDATION_ERROR');
    const userId = (req as any).user.id;
    let linkedInquiry: { id: string; qualificationStatus: string } | null = null;
    if (data.inquiryId) {
      linkedInquiry = await prisma.inquiry.findFirst({ where: { id: data.inquiryId, clientId }, select: { id: true, qualificationStatus: true } });
      if (!linkedInquiry) throw new AppError('Inquiry not found for this client.', 404);
    }
    const activeInquiry = Boolean(linkedInquiry && activeInquiryStatuses.includes(linkedInquiry.qualificationStatus));
    const meetingMode = resolveMeetingMode(data.activityType, data.meetingMode);
    if (activeInquiry) validateMeetingMode(data.activityType, data.status, meetingMode);

    const consultation = await prisma.$transaction(async (tx) => {
      if (activeInquiry && linkedInquiry) await advanceInquiryRevision(tx, linkedInquiry.id, data.expectedIntakeRevision);
      const before = activeInquiry && linkedInquiry ? await getInquiryCriterionSnapshot(tx, linkedInquiry.id) : null;
      const created = await tx.consultation.create({
        data: {
          clientId,
          userId,
          title: data.title,
          activityType: data.activityType,
          meetingMode,
          subject: data.subject || null,
          date: new Date(data.date),
          endAt: data.endAt ? new Date(data.endAt) : null,
          notes: data.notes || null,
          status: data.status,
          inquiryId: data.inquiryId,
          outcome: data.outcome || null,
          participants: data.participants || null,
          internalFollowers: data.internalFollowers || null,
          nextAction: data.nextAction || null,
          nextActionDueAt: data.nextActionDueAt ? new Date(data.nextActionDueAt) : null,
          cancellationReason: data.cancellationReason || null,
        },
      });
      if (before && linkedInquiry) {
        const after = await getInquiryCriterionSnapshot(tx, linkedInquiry.id);
        await syncExplicitCriterionChanges(tx, before, after, userId, 'ADMIN');
      }
      return created;
    });

    logActivity(userId, 'CREATE', 'Consultation', consultation.id, { title: consultation.title });
    
    res.status(201).json(consultation);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { clientId, id } = req.params;
    const data = consultationSchema.partial().parse(req.body);
    if (data.status === 'CANCELLED' && !data.cancellationReason) throw new AppError('A cancellation reason is required.', 400, 'VALIDATION_ERROR');

    const existing = await prisma.consultation.findFirst({ where: { id, clientId, deletedAt: null } });
    if (!existing) throw new AppError('Consultation not found.', 404);
    if (data.inquiryId !== undefined && data.inquiryId !== existing.inquiryId) {
      throw new AppError('A consultation cannot be moved between inquiry records after it is created.', 400, 'VALIDATION_ERROR');
    }
    const activityType = data.activityType || existing.activityType;
    const status = data.status || existing.status;
    const meetingMode = resolveMeetingMode(activityType, data.meetingMode, existing.meetingMode);
    const { expectedIntakeRevision, meetingMode: _requestedMeetingMode, ...fields } = data;
    const linkedInquiry = existing.inquiryId
      ? await prisma.inquiry.findFirst({ where: { id: existing.inquiryId, clientId }, select: { id: true, qualificationStatus: true } })
      : null;
    const activeInquiry = Boolean(linkedInquiry && activeInquiryStatuses.includes(linkedInquiry.qualificationStatus));
    if (activeInquiry) validateMeetingMode(activityType, status, meetingMode);
    const userId = (req as any).user.id;

    const consultation = await prisma.$transaction(async (tx) => {
      if (activeInquiry && linkedInquiry) await advanceInquiryRevision(tx, linkedInquiry.id, expectedIntakeRevision);
      const before = activeInquiry && linkedInquiry ? await getInquiryCriterionSnapshot(tx, linkedInquiry.id) : null;
      const updated = await tx.consultation.update({
        where: { id },
        data: {
          ...fields,
          activityType,
          meetingMode,
          status,
          subject: fields.subject === undefined ? undefined : fields.subject || null,
          date: fields.date ? new Date(fields.date) : undefined,
          endAt: fields.endAt === undefined ? undefined : fields.endAt ? new Date(fields.endAt) : null,
          notes: fields.notes === undefined ? undefined : fields.notes || null,
          outcome: fields.outcome === undefined ? undefined : fields.outcome || null,
          participants: fields.participants === undefined ? undefined : fields.participants || null,
          internalFollowers: fields.internalFollowers === undefined ? undefined : fields.internalFollowers || null,
          nextAction: fields.nextAction === undefined ? undefined : fields.nextAction || null,
          nextActionDueAt: fields.nextActionDueAt === undefined ? undefined : fields.nextActionDueAt ? new Date(fields.nextActionDueAt) : null,
          cancellationReason: fields.cancellationReason === undefined ? undefined : fields.cancellationReason || null,
        },
      });
      if (before && linkedInquiry) {
        const after = await getInquiryCriterionSnapshot(tx, linkedInquiry.id);
        await syncExplicitCriterionChanges(tx, before, after, userId, 'ADMIN');
      }
      return updated;
    });

    logActivity(userId, 'UPDATE', 'Consultation', id, { title: consultation.title });
    
    res.json(consultation);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { clientId, id } = req.params;
    const cons = await prisma.consultation.findFirst({ where: { id, clientId, deletedAt: null } });
    if (!cons) throw new AppError('Consultation not found.', 404);
    await assertDeletionAllowed('Consultation', id, clientId);
    const linkedInquiry = cons.inquiryId
      ? await prisma.inquiry.findFirst({ where: { id: cons.inquiryId, clientId }, select: { id: true, qualificationStatus: true } })
      : null;
    if (linkedInquiry && activeInquiryStatuses.includes(linkedInquiry.qualificationStatus)) {
      const body = z.object({ expectedIntakeRevision: z.number().int().positive() }).parse(req.body || {});
      await prisma.$transaction(async (tx) => {
        await advanceInquiryRevision(tx, linkedInquiry.id, body.expectedIntakeRevision);
        const before = await getInquiryCriterionSnapshot(tx, linkedInquiry.id);
        await tx.consultation.update({ where: { id }, data: { deletedAt: new Date() } });
        const after = await getInquiryCriterionSnapshot(tx, linkedInquiry.id);
        await syncExplicitCriterionChanges(tx, before, after, (req as any).user.id, 'ADMIN');
      });
    } else {
      await prisma.consultation.update({ where: { id }, data: { deletedAt: new Date() } });
    }

    logActivity((req as any).user.id, 'DELETE', 'Consultation', id);
    res.json({ message: 'Consultation deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/restore', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { clientId, id } = req.params;
    const cons = await prisma.consultation.findFirst({ where: { id, clientId, deletedAt: { not: null } } });
    if (!cons) throw new AppError('Deleted consultation not found.', 404);
    const linkedInquiry = cons.inquiryId
      ? await prisma.inquiry.findFirst({ where: { id: cons.inquiryId, clientId }, select: { id: true, qualificationStatus: true } })
      : null;
    if (linkedInquiry && activeInquiryStatuses.includes(linkedInquiry.qualificationStatus)) {
      const body = z.object({ expectedIntakeRevision: z.number().int().positive() }).parse(req.body || {});
      await prisma.$transaction(async (tx) => {
        await advanceInquiryRevision(tx, linkedInquiry.id, body.expectedIntakeRevision);
        const before = await getInquiryCriterionSnapshot(tx, linkedInquiry.id);
        await tx.consultation.update({ where: { id }, data: { deletedAt: null } });
        const after = await getInquiryCriterionSnapshot(tx, linkedInquiry.id);
        await syncExplicitCriterionChanges(tx, before, after, (req as any).user.id, 'ADMIN');
      });
    } else {
      await prisma.consultation.update({ where: { id }, data: { deletedAt: null } });
    }

    logActivity((req as any).user.id, 'RESTORE', 'Consultation', id);
    res.json({ message: 'Consultation restored successfully.' });
  } catch (err) {
    next(err);
  }
});

export default router;
