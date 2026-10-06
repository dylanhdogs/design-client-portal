import assert from 'node:assert/strict';
import { test } from 'node:test';
import { incompleteInquiryPhaseRequirements, inquiryPhaseRequirements } from '../src/routes/inquiries';

const completeDiscovery = {
  projectType: 'New pool', primaryUse: 'Family recreation', decisionMakers: 'Homeowners together',
  propertyAccess: 'Equipment access confirmed', siteConditions: 'No known concerns', utilities: 'Utilities identified',
  surveyStatus: 'Current survey available', mustHaveFeatures: 'Spa', budgetRange: '$100,000-$150,000',
  targetCompletion: '6-12 months', complianceFollowUpStatus: '', complianceCategories: '', hoaArcContact: '', hoaRequirements: '',
};

const baseInquiry = () => ({
  client: { name: 'Jordan Lee', email: 'jordan@example.com' }, source: 'WEBSITE', ownerId: 'owner-1',
  nextAction: 'Review intake', nextActionDueAt: new Date().toISOString(), propertyId: 'property-1',
  description: 'New pool project', objectives: 'Create a family backyard', preliminaryScope: 'Pool and patio',
  budgetExpectation: '$100,000', desiredTiming: 'Spring', discovery: completeDiscovery, siteAssessment: 'Access and measurements recorded',
  workItems: [], consultations: [], complianceVerificationStatus: null,
  romAmount: '$125,000', romStatus: 'APPROVED', romDecisionAt: new Date().toISOString(), romApprovedBy: 'owner-1',
  designAgreementStatus: 'ACCEPTED', designAgreementAcceptedAt: new Date().toISOString(), designAgreementAcceptedBy: 'owner-1',
  handoffSummary: 'Approved pool and patio scope for Design.', projectId: null, qualificationStatus: 'QUALIFIED',
});

test('Phase 3 requires every scheduled site meeting to be resolved', () => {
  const inquiry = baseInquiry();
  inquiry.consultations = [{ activityType: 'SITE_MEETING', title: 'First meeting', status: 'COMPLETED', outcome: 'Ready to continue' }];
  assert.equal(inquiryPhaseRequirements(inquiry, 2).every((item) => item.complete), true);

  inquiry.consultations.push({ activityType: 'SITE_MEETING', title: 'Follow-up', status: 'SCHEDULED', outcome: null });
  assert.ok(incompleteInquiryPhaseRequirements(inquiry, 2).some((item) => item.title.includes('site meeting')));

  inquiry.consultations[1] = { activityType: 'SITE_MEETING', title: 'Follow-up', status: 'CANCELLED', outcome: null };
  assert.equal(inquiryPhaseRequirements(inquiry, 2).find((item) => item.title.includes('site meeting'))?.complete, true);
});

test('Non-site activities do not satisfy the completed site meeting requirement', () => {
  const inquiry = baseInquiry();
  inquiry.consultations = [{ activityType: 'PHONE_CALL', title: 'Client call', status: 'COMPLETED', outcome: 'Client will review scope' }];
  assert.equal(inquiryPhaseRequirements(inquiry, 2).find((item) => item.title.includes('site meeting'))?.complete, false);
});

test('Compliance context requires verification, while explicit TBD remains a visible blocker', () => {
  const inquiry = baseInquiry();
  inquiry.consultations = [{ activityType: 'SITE_MEETING', title: 'Site meeting', status: 'COMPLETED', outcome: 'Ready' }];
  inquiry.discovery = { ...completeDiscovery, complianceCategories: 'HOA / ARC review', complianceFollowUpStatus: 'TBD' };
  const compliance = () => inquiryPhaseRequirements(inquiry, 2).find((item) => item.title.includes('Compliance review'))?.complete;
  assert.equal(compliance(), false);
  inquiry.complianceVerificationStatus = 'VERIFIED';
  assert.equal(compliance(), true);
});

test('Phase 4 requires explicit ROM approval, agreement state, and handoff summary', () => {
  const inquiry = baseInquiry();
  const requirements = inquiryPhaseRequirements(inquiry, 3);
  assert.equal(requirements.find((item) => item.title.includes('ROM approved'))?.complete, true);
  assert.equal(requirements.find((item) => item.title.includes('Design Agreement'))?.complete, true);
  assert.equal(requirements.find((item) => item.title.includes('handoff summary'))?.complete, true);

  inquiry.romStatus = 'PRESENTED';
  assert.equal(inquiryPhaseRequirements(inquiry, 3).find((item) => item.title.includes('ROM approved'))?.complete, false);
});

test('Converted inquiries are terminal and reflect every phase as complete', () => {
  const inquiry = baseInquiry();
  inquiry.qualificationStatus = 'CONVERTED';
  inquiry.projectId = 'project-1';
  for (const phaseIndex of [0, 1, 2, 3]) {
    assert.equal(inquiryPhaseRequirements(inquiry, phaseIndex).every((item) => item.complete), true);
    assert.equal(incompleteInquiryPhaseRequirements(inquiry, phaseIndex).length, 0);
  }
});
