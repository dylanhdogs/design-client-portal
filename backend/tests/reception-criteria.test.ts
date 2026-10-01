import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateReceptionReadiness, RECEPTION_WORKFLOW_VERSION } from '../src/workflow/receptionCriteria';

function inquiry(overrides: Record<string, unknown> = {}) {
  return {
    qualificationStatus: 'IN_REVIEW',
    legacyReviewStatus: 'PENDING',
    client: { name: 'Avery Example', email: 'avery@example.com', phone: null },
    property: { address: '123 Example Ave' },
    owner: { id: 'admin-1', role: 'ADMIN', active: true },
    ownerId: 'admin-1',
    source: 'WEBSITE',
    nextAction: 'Review inquiry',
    nextActionDueAt: new Date('2026-10-01T12:00:00Z'),
    description: 'A new pool',
    objectives: 'Create a family recreation space',
    discovery: { projectType: 'New pool only', primaryUse: 'Family recreation', decisionMakers: 'Client only' },
    consultations: [],
    workItems: [],
    documents: [],
    criterionStates: [],
    ...overrides,
  };
}

const criterion = (result: ReturnType<typeof evaluateReceptionReadiness>, id: string) => result.criteria.find((item) => item.id === id)!;

test('existing populated legacy answers require explicit review instead of being auto-confirmed', () => {
  const result = evaluateReceptionReadiness(inquiry());
  assert.equal(criterion(result, 'PROJECT_TYPE').answerState, 'NEEDS_REVIEW');
  assert.equal(criterion(result, 'PROJECT_TYPE').complete, false);
  assert.equal(criterion(result, 'DESIRED_OUTCOME').answerState, 'NEEDS_REVIEW');
});

test('unsupported discovery text is preserved as needs review, not treated as a valid dropdown choice', () => {
  const result = evaluateReceptionReadiness(inquiry({ discovery: { projectType: 'Custom project type' } }));
  assert.equal(criterion(result, 'PROJECT_TYPE').answerState, 'NEEDS_REVIEW');
  assert.equal(criterion(result, 'PROJECT_TYPE').complete, false);
});

test('an unknown deferrable criterion advances only with its own owned, dated follow-up', () => {
  const result = evaluateReceptionReadiness(inquiry({
    legacyReviewStatus: 'REVIEWED',
    criterionStates: [{ criterionId: 'PROPERTY_ACCESS', answerState: 'UNKNOWN' }],
    workItems: [{ criterionId: 'PROPERTY_ACCESS', status: 'OPEN', ownerId: 'admin-1', dueAt: new Date('2026-10-02T12:00:00Z') }],
  }));
  assert.equal(criterion(result, 'PROPERTY_ACCESS').deferred, true);
  assert.equal(criterion(result, 'PROPERTY_ACCESS').complete, true);
});

test('a legacy site-meeting candidate without explicit onsite mode cannot satisfy the onsite gate', () => {
  const result = evaluateReceptionReadiness(inquiry({
    legacyReviewStatus: 'PENDING',
    consultations: [{ id: 'meeting-1', activityType: 'SITE_MEETING', title: 'Site meeting', status: 'COMPLETED', outcome: 'Ready' }],
  }));
  assert.equal(criterion(result, 'SITE_MEETING_OUTCOME').answerState, 'NEEDS_REVIEW');
  assert.equal(criterion(result, 'SITE_MEETING_OUTCOME').complete, false);
});

test('survey Not applicable requires an Admin reason and attributable state update', () => {
  const result = evaluateReceptionReadiness(inquiry({
    legacyReviewStatus: 'REVIEWED',
    discovery: { surveyStatus: 'Not applicable' },
    criterionStates: [{ criterionId: 'SURVEY_STATUS', answerState: 'NOT_APPLICABLE', reason: 'No survey is required for this parcel.', updatedBy: 'admin-1', updatedAt: new Date() }],
  }));
  assert.equal(criterion(result, 'SURVEY_STATUS').complete, true);
});

test('converted inquiries are excluded from the active phase assignment', () => {
  const result = evaluateReceptionReadiness(inquiry({ qualificationStatus: 'CONVERTED', projectId: 'project-1' }));
  assert.equal(result.activeReceptionPhase, null);
});

test('a ROM brief is not ready if its saved snapshot belongs to an older intake revision', () => {
  const base = inquiry({
    legacyReviewStatus: 'REVIEWED', intakeRevision: 8, romAmount: '$120k–$160k',
    romPreviewSnapshot: '{"version":1}', romPreviewHash: 'hash', romPreviewRevision: 7,
    criterionStates: [{ criterionId: 'PRELIMINARY_BRIEF', answerState: 'CONFIRMED' }],
  });
  assert.equal(criterion(evaluateReceptionReadiness(base), 'PRELIMINARY_BRIEF').complete, false);
  assert.equal(criterion(evaluateReceptionReadiness({ ...base, romPreviewRevision: 8 }), 'PRELIMINARY_BRIEF').complete, true);
});

test('only a reviewed, attributable Proceed to Design disposition satisfies the client gate', () => {
  const pending = inquiry({
    legacyReviewStatus: 'REVIEWED', clientDisposition: 'PROCEED_TO_DESIGN',
    clientDispositionReviewStatus: 'PENDING_REVIEW', clientDispositionAt: new Date(),
    clientDispositionRecordedBy: 'client-user', clientDispositionEvidenceActivityId: 'activity-1',
    criterionStates: [{ criterionId: 'CLIENT_DISPOSITION', answerState: 'CONFIRMED' }],
  });
  assert.equal(criterion(evaluateReceptionReadiness(pending), 'CLIENT_DISPOSITION').complete, false);
  const reviewed = {
    ...pending, clientDispositionReviewStatus: 'REVIEWED', clientDispositionReviewedAt: new Date(), clientDispositionReviewedBy: 'admin-1',
  };
  assert.equal(criterion(evaluateReceptionReadiness(reviewed), 'CLIENT_DISPOSITION').complete, true);
  assert.equal(criterion(evaluateReceptionReadiness({ ...reviewed, clientDisposition: 'PAUSE' }), 'CLIENT_DISPOSITION').complete, false);
});

test('handoff approval is revision-, workflow-, and ROM-hash-bound', () => {
  const base = inquiry({
    legacyReviewStatus: 'REVIEWED', intakeRevision: 12, romPreviewHash: 'rom-hash',
    criterionStates: [{ criterionId: 'HANDOFF_REVIEW', answerState: 'CONFIRMED' }],
    handoffReview: { result: 'APPROVED', intakeRevision: 12, workflowVersion: RECEPTION_WORKFLOW_VERSION, romPreviewHash: 'rom-hash' },
  });
  assert.equal(criterion(evaluateReceptionReadiness(base), 'HANDOFF_REVIEW').complete, true);
  assert.equal(criterion(evaluateReceptionReadiness({ ...base, handoffReview: { ...base.handoffReview, intakeRevision: 11 } }), 'HANDOFF_REVIEW').complete, false);
  assert.equal(criterion(evaluateReceptionReadiness({ ...base, handoffReview: { ...base.handoffReview, romPreviewHash: 'different' } }), 'HANDOFF_REVIEW').complete, false);
});
