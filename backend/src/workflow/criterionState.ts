import type { Prisma } from '@prisma/client';
import {
  classifyReceptionCriterionAnswer,
  evaluateReceptionReadiness,
  receptionCriterionFingerprint,
  RECEPTION_CRITERIA,
  RECEPTION_WORKFLOW_VERSION,
  type ReceptionAnswerState,
} from './receptionCriteria';

type Transaction = Prisma.TransactionClient;

export interface SaveCriterionStateInput {
  inquiryId: string;
  criterionId: string;
  answerState: ReceptionAnswerState;
  reason?: string | null;
  source: string;
  actorId?: string | null;
}

export async function saveCriterionState(tx: Transaction, input: SaveCriterionStateInput) {
  const reason = input.reason?.trim() || null;
  const existing = await tx.inquiryCriterionState.findUnique({
    where: { inquiryId_criterionId: { inquiryId: input.inquiryId, criterionId: input.criterionId } },
  });
  if (existing
    && existing.answerState === input.answerState
    && existing.reason === reason
    && existing.source === input.source
    && existing.updatedBy === (input.actorId || null)) {
    return existing;
  }

  const state = existing
    ? await tx.inquiryCriterionState.update({
      where: { id: existing.id },
      data: { answerState: input.answerState, reason, source: input.source, updatedBy: input.actorId || null },
    })
    : await tx.inquiryCriterionState.create({
      data: {
        inquiryId: input.inquiryId,
        criterionId: input.criterionId,
        answerState: input.answerState,
        reason,
        source: input.source,
        updatedBy: input.actorId || null,
      },
    });

  await tx.inquiryCriterionStateAudit.create({
    data: {
      inquiryId: input.inquiryId,
      criterionId: input.criterionId,
      criterionStateId: state.id,
      fromAnswerState: existing?.answerState || null,
      toAnswerState: input.answerState,
      fromReason: existing?.reason || null,
      toReason: reason,
      source: input.source,
      actorId: input.actorId || null,
      workflowVersion: RECEPTION_WORKFLOW_VERSION,
    },
  });
  return state;
}

export async function refreshLegacyReviewStatus(tx: Transaction, inquiryId: string) {
  const remaining = await tx.inquiryCriterionState.count({ where: { inquiryId, answerState: 'NEEDS_REVIEW' } });
  return tx.inquiry.update({
    where: { id: inquiryId },
    data: { legacyReviewStatus: remaining === 0 ? 'REVIEWED' : 'PENDING' },
    select: { legacyReviewStatus: true },
  });
}

export async function initializeCriterionStates(
  tx: Transaction,
  inquiry: any,
  source: 'ADMIN' | 'CLIENT',
  actorId: string,
) {
  const readiness = evaluateReceptionReadiness({ ...inquiry, legacyReviewStatus: 'REVIEWED', criterionStates: [] });
  for (const criterion of readiness.criteria) {
    await saveCriterionState(tx, {
      inquiryId: inquiry.id,
      criterionId: criterion.id,
      answerState: criterion.answerState,
      reason: null,
      source: criterion.answerState === 'CONFIRMED' ? source : 'SYSTEM',
      actorId: criterion.answerState === 'CONFIRMED' ? actorId : null,
    });
  }
}

export async function syncExplicitCriterionChanges(
  tx: Transaction,
  before: any,
  after: any,
  actorId: string,
  source: 'ADMIN' | 'CLIENT' = 'ADMIN',
) {
  for (const criterion of RECEPTION_CRITERIA) {
    if (receptionCriterionFingerprint(before, criterion.id) === receptionCriterionFingerprint(after, criterion.id)) continue;
    const answerState = classifyReceptionCriterionAnswer(after, criterion.id);
    const reason = answerState === 'NEEDS_REVIEW'
      ? criterion.id === 'SURVEY_STATUS' && after.discovery?.surveyStatus?.trim().toLowerCase() === 'not applicable'
        ? 'Legacy Not applicable value requires an Admin-recorded reason.'
        : 'Saved value needs review because it is not a supported confirmed answer.'
      : null;
    await saveCriterionState(tx, {
      inquiryId: after.id,
      criterionId: criterion.id,
      answerState,
      reason,
      source: answerState === 'NEEDS_REVIEW' ? 'LEGACY_UNVERIFIED' : source,
      actorId: answerState === 'NEEDS_REVIEW' ? null : actorId,
    });
  }
  await refreshLegacyReviewStatus(tx, after.id);
}
