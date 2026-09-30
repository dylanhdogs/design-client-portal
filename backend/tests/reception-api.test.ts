import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { app } from '../src/index';
import { prisma } from '../src/utils/prisma';

let server: ReturnType<typeof app.listen>;
let baseUrl = '';
let adminToken = '';
let clientToken = '';

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
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await prisma.$disconnect();
});

test('compliance verification requires representative evidence before VERIFIED', async () => {
  const inquiry = await prisma.inquiry.findFirst({ where: { qualificationStatus: { not: 'CONVERTED' } }, select: { id: true } });
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
  const inquiry = await prisma.inquiry.findFirst({ where: { qualificationStatus: { not: 'CONVERTED' } }, select: { id: true } });
  assert.ok(inquiry);
  const headers = { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' };
  const source = {
    title: 'Scottsdale pool codes and ordinances',
    url: 'https://www.scottsdaleaz.gov/codes-and-ordinances/swimming-pools',
    domain: 'www.scottsdaleaz.gov',
    summary: 'City pool requirements and permit information.',
    authorityType: 'CITY',
    authorityName: 'City of Scottsdale',
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
  const inquiry = await prisma.inquiry.findFirst({ where: { qualificationStatus: { not: 'CONVERTED' } }, select: { id: true, clientId: true } });
  assert.ok(inquiry);
  const response = await request(`/api/clients/${inquiry.clientId}/consultations`, {
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'HOA requirements follow-up', activityType: 'HOA_ARC', subject: 'Confirm barrier standards',
      date: new Date().toISOString(), status: 'SCHEDULED', inquiryId: inquiry.id,
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

test('client inquiry projection hides internal Reception fields', async () => {
  const clientUser = await prisma.user.findUniqueOrThrow({ where: { email: 'client@example.com' }, select: { clientId: true } });
  const inquiry = await prisma.inquiry.findFirst({ where: { clientId: clientUser.clientId! }, select: { id: true } });
  assert.ok(inquiry);
  const response = await request(`/api/inquiries/${inquiry.id}`, { headers: { authorization: `Bearer ${clientToken}` } });
  const body = await response.json() as any;
  assert.equal(response.status, 200);
  assert.equal(body.owner, null);
  assert.equal(body.nextAction, null);
  assert.equal(body.proposalClientResponse, null);
  assert.ok((body.workItems || []).every((item: any) => item.clientVisible === true));
});
