import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { app } from '../src/index';
import { prisma } from '../src/utils/prisma';

let server: ReturnType<typeof app.listen>;
let baseUrl = '';
let adminToken = '';
let clientToken = '';
let testInquiryId = '';

const request = (path: string, options: RequestInit = {}) => fetch(`${baseUrl}${path}`, options);

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const response = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-auth-mode': 'bearer' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'admin123' }),
  });
  assert.equal(response.status, 200);
  adminToken = (await response.json() as { token: string }).token;
  const clientLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-auth-mode': 'bearer' },
    body: JSON.stringify({ email: 'client@example.com', password: 'client123' }),
  });
  assert.equal(clientLogin.status, 200);
  clientToken = (await clientLogin.json() as { token: string }).token;
  const clientUser = await prisma.user.findUniqueOrThrow({ where: { email: 'client@example.com' }, select: { clientId: true } });
  assert.ok(clientUser.clientId);
  const testInquiry = await prisma.inquiry.create({ data: {
    clientId: clientUser.clientId!, source: 'TEST', description: 'Reception API test inquiry',
    objectives: 'Exercise the Reception API against an isolated active inquiry.',
  } });
  testInquiryId = testInquiry.id;
});

after(async () => {
  if (testInquiryId) await prisma.inquiry.deleteMany({ where: { id: testInquiryId } });
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await prisma.$disconnect();
});

test('compliance verification requires representative evidence before VERIFIED', async () => {
  const inquiry = await prisma.inquiry.findUnique({ where: { id: testInquiryId }, select: { id: true, intakeRevision: true } });
  assert.ok(inquiry);
  const response = await request(`/api/inquiries/${inquiry.id}/compliance-verification`, {
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'VERIFIED', source: '', categories: '' }),
  });
  const body = await response.json() as { error?: { code?: string } };
  assert.equal(response.status, 400);
  assert.equal(body.error?.code, 'VALIDATION_ERROR');
});

test('saved compliance links persist on an inquiry and duplicate saves are idempotent', async () => {
  const inquiry = await prisma.inquiry.findUnique({ where: { id: testInquiryId }, select: { id: true, intakeRevision: true } });
  assert.ok(inquiry);
  const headers = { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' };
  const source = {
    title: 'Scottsdale pool codes and ordinances',
    url: 'https://www.scottsdaleaz.gov/codes-and-ordinances/swimming-pools',
    domain: 'www.scottsdaleaz.gov',
    summary: 'City pool requirements and permit information.',
    authorityType: 'CITY',
    authorityName: 'City of Scottsdale',
    expectedIntakeRevision: inquiry.intakeRevision,
  };
  let savedId = '';
  try {
    const firstResponse = await request(`/api/inquiries/${inquiry.id}/compliance-links`, {
      method: 'POST', headers, body: JSON.stringify(source),
    });
    const first = await firstResponse.json() as { id: string; url: string };
    assert.equal(firstResponse.status, 200);
    assert.equal(first.url, source.url);
    savedId = first.id;

    const duplicateResponse = await request(`/api/inquiries/${inquiry.id}/compliance-links`, {
      method: 'POST', headers, body: JSON.stringify(source),
    });
    const duplicate = await duplicateResponse.json() as { id: string };
    assert.equal(duplicateResponse.status, 200);
    assert.equal(duplicate.id, first.id);

    const snapshotResponse = await request(`/api/inquiries/${inquiry.id}/compliance-research`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const snapshot = await snapshotResponse.json() as { savedLinks: Array<{ id: string; url: string }> };
    assert.equal(snapshotResponse.status, 200);
    assert.ok(snapshot.savedLinks.some((link) => link.id === first.id && link.url === source.url));
  } finally {
    if (savedId) await prisma.inquiryComplianceLink.deleteMany({ where: { id: savedId } });
  }
});

test('consultation API persists structured non-site activity metadata', async () => {
  const inquiry = await prisma.inquiry.findUnique({ where: { id: testInquiryId }, select: { id: true, clientId: true, intakeRevision: true } });
  assert.ok(inquiry);
  const response = await request(`/api/clients/${inquiry.clientId}/consultations`, {
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'HOA requirements follow-up', activityType: 'HOA_ARC', subject: 'Confirm barrier standards',
      date: new Date().toISOString(), status: 'SCHEDULED', inquiryId: inquiry.id,
      expectedIntakeRevision: inquiry.intakeRevision,
      participants: 'HOA representative', nextAction: 'Request current standards',
      nextActionDueAt: new Date(Date.now() + 86_400_000).toISOString(),
    }),
  });
  const created = await response.json() as { id: string; activityType: string; subject: string | null; nextAction: string | null };
  assert.equal(response.status, 201);
  assert.equal(created.activityType, 'HOA_ARC');
  assert.equal(created.subject, 'Confirm barrier standards');
  assert.equal(created.nextAction, 'Request current standards');
  await prisma.consultation.delete({ where: { id: created.id } });
});

test('field survey saves for internal users and remains hidden from the client projection', async () => {
  const inquiry = await prisma.inquiry.findUniqueOrThrow({ where: { id: testInquiryId }, select: { id: true, intakeRevision: true } });
  const survey = { poolLengthFt: '32', equipmentAccessWidthFt: '8', excavationNotes: 'Verify rock conditions' };
  const savedResponse = await request(`/api/inquiries/${inquiry.id}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ expectedIntakeRevision: inquiry.intakeRevision, siteAssessmentData: survey }),
  });
  const saved = await savedResponse.json() as { intakeRevision: number; siteAssessmentData: Record<string, string> };
  assert.equal(savedResponse.status, 200);
  assert.equal(saved.siteAssessmentData.poolLengthFt, survey.poolLengthFt);
  assert.equal(saved.siteAssessmentData.equipmentAccessWidthFt, survey.equipmentAccessWidthFt);
  assert.equal(saved.siteAssessmentData.excavationNotes, survey.excavationNotes);
  assert.deepEqual(
    await prisma.inquiry.findUniqueOrThrow({ where: { id: inquiry.id }, select: { siteAssessmentData: true } }).then(({ siteAssessmentData }) => JSON.parse(siteAssessmentData!)),
    saved.siteAssessmentData,
  );

  const previewResponse = await request(`/api/inquiries/${inquiry.id}/rom-preview`, {
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ expectedIntakeRevision: saved.intakeRevision }),
  });
  const preview = await previewResponse.json() as { snapshot: { sourceAnswers: Record<string, unknown> } };
  assert.equal(previewResponse.status, 200);
  assert.deepEqual(preview.snapshot.sourceAnswers.siteAssessmentData, saved.siteAssessmentData);

  const clientResponse = await request(`/api/inquiries/${inquiry.id}`, { headers: { authorization: `Bearer ${clientToken}` } });
  const clientView = await clientResponse.json() as Record<string, unknown>;
  assert.equal(clientResponse.status, 200);
  assert.equal(clientView.siteAssessmentData, undefined);

  const clientEdit = await request(`/api/inquiries/${inquiry.id}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${clientToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ expectedIntakeRevision: saved.intakeRevision, siteAssessmentData: survey }),
  });
  assert.equal(clientEdit.status, 403);
});

test('atomic intake save rolls back all writes when a client, property, or inquiry update fails', async () => {
  const suffix = crypto.randomUUID().replaceAll('-', '');
  const client = await prisma.client.create({ data: { name: 'Rollback test client', email: 'rollback-test@example.invalid', phone: '555-0100' } });
  const property = await prisma.property.create({ data: { clientId: client.id, address: 'Before rollback', city: 'Phoenix', state: 'AZ' } });
  const inquiry = await prisma.inquiry.create({ data: {
    clientId: client.id, propertyId: property.id, source: 'TEST', objectives: 'Original inquiry objective',
  } });
  const scenarios = [
    { target: 'client', table: 'clients', column: 'name', marker: `rollback-client-${suffix}` },
    { target: 'property', table: 'properties', column: 'address', marker: `rollback-property-${suffix}` },
    { target: 'inquiry', table: 'inquiries', column: 'objectives', marker: `rollback-inquiry-${suffix}` },
  ] as const;

  try {
    for (const scenario of scenarios) {
      const triggerName = `codex_intake_rollback_${suffix}_${scenario.target}`;
      await prisma.$executeRawUnsafe(`CREATE TRIGGER "${triggerName}" BEFORE UPDATE OF "${scenario.column}" ON "${scenario.table}" WHEN NEW."${scenario.column}" = '${scenario.marker}' BEGIN SELECT RAISE(ABORT, 'forced rollback test'); END`);
      try {
        const response = await request(`/api/inquiries/${inquiry.id}/intake`, {
          method: 'PUT',
          headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            expectedIntakeRevision: inquiry.intakeRevision,
            client: { name: scenario.target === 'client' ? scenario.marker : `Changed client ${scenario.target}`, email: client.email, phone: client.phone },
            property: { address: scenario.target === 'property' ? scenario.marker : `Changed address ${scenario.target}`, city: 'Tempe', state: 'AZ' },
            inquiry: { objectives: scenario.target === 'inquiry' ? scenario.marker : `Changed objectives ${scenario.target}` },
          }),
        });
        assert.equal(response.status, 500, `${scenario.target} database failure should be reported as a server error`);

        const [savedClient, savedProperty, savedInquiry, auditCount] = await Promise.all([
          prisma.client.findUniqueOrThrow({ where: { id: client.id } }),
          prisma.property.findUniqueOrThrow({ where: { id: property.id } }),
          prisma.inquiry.findUniqueOrThrow({ where: { id: inquiry.id } }),
          prisma.activityLog.count({ where: { entityType: 'Inquiry', entityId: inquiry.id, action: 'INTAKE_UPDATE' } }),
        ]);
        assert.equal(savedClient.name, client.name, `${scenario.target} failure must roll back the client write`);
        assert.equal(savedProperty.address, property.address, `${scenario.target} failure must roll back the property write`);
        assert.equal(savedInquiry.objectives, inquiry.objectives, `${scenario.target} failure must roll back the inquiry write`);
        assert.equal(savedInquiry.intakeRevision, inquiry.intakeRevision, `${scenario.target} failure must roll back the revision`);
        assert.equal(auditCount, 0, `${scenario.target} failure must not write an audit event`);
      } finally {
        await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}"`);
      }
    }
  } finally {
    await prisma.inquiry.delete({ where: { id: inquiry.id } });
    await prisma.property.delete({ where: { id: property.id } });
    await prisma.client.delete({ where: { id: client.id } });
  }
});

test('client inquiry projection hides internal Reception fields', async () => {
  const clientUser = await prisma.user.findUniqueOrThrow({ where: { email: 'client@example.com' }, select: { clientId: true } });
  const inquiry = await prisma.inquiry.findUnique({ where: { id: testInquiryId }, select: { id: true } });
  assert.ok(inquiry);
  const response = await request(`/api/inquiries/${inquiry.id}`, { headers: { authorization: `Bearer ${clientToken}` } });
  const body = await response.json() as any;
  assert.equal(response.status, 200);
  assert.equal(body.owner, null);
  assert.equal(body.nextAction, null);
  assert.equal(body.proposalClientResponse, null);
  assert.ok((body.workItems || []).every((item: any) => item.clientVisible === true));
});

test('client completion records one internal response event with revision-safe replay', async () => {
  const clientUser = await prisma.user.findUniqueOrThrow({ where: { email: 'client@example.com' }, select: { id: true, clientId: true } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@example.com' }, select: { id: true } });
  const inquiry = await prisma.inquiry.findUniqueOrThrow({ where: { id: testInquiryId }, select: { id: true, clientId: true, intakeRevision: true } });
  const idempotencyKey = `client-response-${crypto.randomUUID()}`;
  const sourceEventId = `${clientUser.id}:${idempotencyKey}`;
  const item = await prisma.workItem.create({ data: {
    inquiryId: inquiry.id, stage: 'INQUIRY', type: 'TASK', title: 'Provide a property survey',
    description: 'Attach the current survey for this test request.', status: 'OPEN', priority: 'NORMAL',
    ownerId: clientUser.id, clientVisible: true, createdBy: admin.id,
  } });
  const staleItem = await prisma.workItem.create({ data: {
    inquiryId: inquiry.id, stage: 'INQUIRY', type: 'TASK', title: 'Confirm equipment access',
    description: 'Confirm access for the local stale-write test.', status: 'OPEN', priority: 'NORMAL',
    ownerId: clientUser.id, clientVisible: true, createdBy: admin.id,
  } });
  const staleSourceEventId = `${clientUser.id}:stale-response-${crypto.randomUUID()}`;
  try {
    const headers = { authorization: `Bearer ${clientToken}`, 'content-type': 'application/json' };
    const body = { expectedIntakeRevision: inquiry.intakeRevision, idempotencyKey };
    const firstResponse = await request(`/api/work-items/${item.id}/complete`, { method: 'POST', headers, body: JSON.stringify(body) });
    assert.equal(firstResponse.status, 200);
    const first = await firstResponse.json() as { status: string; inquiryRevision: number };
    assert.equal(first.status, 'COMPLETED');
    assert.equal(first.inquiryRevision, inquiry.intakeRevision + 1);

    const replayResponse = await request(`/api/work-items/${item.id}/complete`, { method: 'POST', headers, body: JSON.stringify(body) });
    assert.equal(replayResponse.status, 200);
    assert.equal((await replayResponse.json() as { inquiryRevision: number }).inquiryRevision, first.inquiryRevision);
    assert.equal(await prisma.inquiryActivity.count({ where: { origin: 'CLIENT_PORTAL', sourceEventId, outcomeCode: 'CLIENT_RESPONSE_RECEIVED' } }), 1);

    const staleResponse = await request(`/api/work-items/${staleItem.id}/complete`, {
      method: 'POST', headers,
      body: JSON.stringify({ expectedIntakeRevision: inquiry.intakeRevision, idempotencyKey: staleSourceEventId.slice(clientUser.id.length + 1) }),
    });
    assert.equal(staleResponse.status, 409);
    assert.equal((await prisma.workItem.findUniqueOrThrow({ where: { id: staleItem.id }, select: { status: true } })).status, 'OPEN');
    assert.equal(await prisma.inquiryActivity.count({ where: { origin: 'CLIENT_PORTAL', sourceEventId: staleSourceEventId } }), 0);

    const clientViewResponse = await request(`/api/inquiries/${inquiry.id}`, { headers: { authorization: `Bearer ${clientToken}` } });
    const clientView = await clientViewResponse.json() as Record<string, unknown>;
    assert.equal(clientViewResponse.status, 200);
    assert.equal(clientView.activities, undefined);
    assert.equal(clientView.dispositionEvidenceActivity, undefined);
    const internalTimelineResponse = await request(`/api/inquiries/${inquiry.id}/activities`, { headers: { authorization: `Bearer ${clientToken}` } });
    assert.equal(internalTimelineResponse.status, 403);
  } finally {
    await prisma.inquiryActivity.deleteMany({ where: { origin: 'CLIENT_PORTAL', sourceEventId } });
    await prisma.inquiryActivity.deleteMany({ where: { origin: 'CLIENT_PORTAL', sourceEventId: staleSourceEventId } });
    await prisma.workItem.delete({ where: { id: staleItem.id } });
    await prisma.workItem.delete({ where: { id: item.id } });
  }
});
