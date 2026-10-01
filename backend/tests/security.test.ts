import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { AddressInfo } from 'node:net';
import path from 'node:path';
import { after, before, test } from 'node:test';
import bcrypt from 'bcryptjs';
import { app } from '../src/index';
import { prisma } from '../src/utils/prisma';
import { createPoolProjectWithPhases } from '../src/utils/poolProject';
import { getUploadDirectory } from '../src/utils/storage';
import { sanitizeSpreadsheetCell } from '../src/reporting/clientStatusExports';
import { currentDateInZone } from '../src/reporting/clientStatus';

let server: ReturnType<typeof app.listen>;
let baseUrl = '';
let adminToken = '';
let adminUserId = '';
let staffToken = '';
let staffUserId = '';
let clientToken = '';
let secondClientToken = '';
let clientId = '';
let secondClientId = '';
let secondUserId = '';
let secondDocumentId = '';
let secondDocumentFilename = '';
let secondPhaseId = '';
let secondItemId = '';
let secondProjectId = '';
const uploadedDocumentIds: string[] = [];
const uploadedFilenames: string[] = [];
const procurementVendorIds: string[] = [];

const removeFixtureClient = async (email: string) => {
  const fixtureClient = await prisma.client.findFirst({ where: { email } });
  if (!fixtureClient) return;
  const project = await prisma.poolProject.findUnique({ where: { clientId: fixtureClient.id } });
  if (project) {
    await prisma.approval.deleteMany({ where: { projectId: project.id } });
    await prisma.poolProject.delete({ where: { id: project.id } });
  }
  await prisma.user.deleteMany({ where: { clientId: fixtureClient.id } });
  await prisma.client.delete({ where: { id: fixtureClient.id } });
};

const request = async (path: string, options: RequestInit = {}) => {
  const response = await fetch(`${baseUrl}${path}`, options);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  return { response, body: body as any };
};

const login = async (email: string, password: string) => {
  const { response, body } = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-auth-mode': 'bearer' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200);
  return body.token as string;
};

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;

  adminToken = await login('admin@example.com', 'admin123');
  adminUserId = (await prisma.user.findUniqueOrThrow({ where: { email: 'admin@example.com' } })).id;
  await prisma.user.upsert({
    where: { email: 'staff@example.com' },
    update: { passwordHash: await bcrypt.hash('staff123', 10), name: 'Design Coordinator', role: 'ADMIN', active: true, sessionVersion: { increment: 1 } },
    create: { email: 'staff@example.com', passwordHash: await bcrypt.hash('staff123', 10), name: 'Design Coordinator', role: 'ADMIN' },
  });
  staffToken = await login('staff@example.com', 'staff123');
  staffUserId = (await prisma.user.findUniqueOrThrow({ where: { email: 'staff@example.com' } })).id;
  clientToken = await login('client@example.com', 'client123');
  const clientUser = await prisma.user.findUniqueOrThrow({ where: { email: 'client@example.com' } });
  clientId = clientUser.clientId!;

  await removeFixtureClient('security-client-2@example.com');

  const secondClient = await prisma.client.create({
    data: {
      name: 'Security Test Client',
      email: 'security-client-2@example.com',
      status: 'ACTIVE',
    },
  });
  secondClientId = secondClient.id;
  const secondUser = await prisma.user.create({
    data: {
      email: 'security-client-2@example.com',
      passwordHash: await bcrypt.hash('security123', 10),
      name: 'Security Test Client',
      role: 'CLIENT',
      clientId: secondClient.id,
    },
  });
  secondUserId = secondUser.id;
  secondClientToken = await login('security-client-2@example.com', 'security123');

  const project = await createPoolProjectWithPhases(secondClient.id, { poolType: 'Test' });
  secondProjectId = project.id;
  const phase = await prisma.projectPhase.findFirstOrThrow({
    where: { projectId: project.id },
    orderBy: { order: 'asc' },
    include: { checklistItems: { orderBy: { order: 'asc' } } },
  });
  secondPhaseId = phase.id;
  secondItemId = phase.checklistItems[0].id;

  await prisma.consultation.create({
    data: {
      clientId: secondClient.id,
      userId: secondUser.id,
      title: 'Private Consultation',
      date: new Date(),
    },
  });

  secondDocumentFilename = 'security-test.pdf';
  fs.writeFileSync(path.join(getUploadDirectory(), secondDocumentFilename), Buffer.from('%PDF-1.4\nsecurity test'));
  const document = await prisma.document.create({
    data: {
      clientId: secondClient.id,
      userId: secondUser.id,
      filename: secondDocumentFilename,
      originalName: 'security-test.pdf',
      mimeType: 'application/pdf',
      size: 22,
    },
  });
  secondDocumentId = document.id;
});

after(async () => {
  if (uploadedDocumentIds.length) {
    await prisma.document.deleteMany({ where: { id: { in: uploadedDocumentIds } } }).catch(() => undefined);
  }
  for (const filename of uploadedFilenames) {
    const uploadedPath = path.join(getUploadDirectory(), filename);
    if (fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
  }
  await removeFixtureClient('security-client-2@example.com').catch(() => undefined);
  await removeFixtureClient('inquiry-client@example.com').catch(() => undefined);
  await prisma.user.deleteMany({ where: { email: 'recovery-user@example.com' } }).catch(() => undefined);
  await prisma.user.deleteMany({ where: { email: 'staff@example.com' } }).catch(() => undefined);
  if (procurementVendorIds.length) await prisma.vendor.deleteMany({ where: { id: { in: procurementVendorIds } } }).catch(() => undefined);
  const fixturePath = path.join(getUploadDirectory(), secondDocumentFilename);
  if (fs.existsSync(fixturePath)) fs.unlinkSync(fixturePath);
  await prisma.$disconnect();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('client cannot list another client consultations', async () => {
  const { response, body } = await request(`/api/clients/${secondClientId}/consultations`, {
    headers: { authorization: `Bearer ${clientToken}` },
  });
  assert.equal(response.status, 403);
  assert.equal(body.error.code, 'FORBIDDEN');

  const forgedOutbound = await request(`/api/clients/${clientId}/communications`, {
    method: 'POST',
    headers: { authorization: `Bearer ${clientToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'EMAIL', direction: 'OUTBOUND', body: 'This must not be recorded as a company-originated message.' }),
  });
  assert.equal(forgedOutbound.response.status, 400);
});

test('daily client status reports are internal, traceable, reusable, and exportable', async () => {
  assert.equal(sanitizeSpreadsheetCell('=HYPERLINK("https://malicious.invalid")'), '\'=HYPERLINK("https://malicious.invalid")');
  assert.equal(sanitizeSpreadsheetCell('@SUM(1+1)'), '\'@SUM(1+1)');
  const asOfDate = currentDateInZone();
  const denied = await request(`/api/clients/${secondClientId}/status-reports`, {
    method: 'POST',
    headers: { authorization: `Bearer ${secondClientToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ projectId: secondProjectId, asOfDate }),
  });
  assert.equal(denied.response.status, 403);

  const generated = await request(`/api/clients/${secondClientId}/status-reports`, {
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ projectId: secondProjectId, asOfDate }),
  });
  assert.equal(generated.response.status, 201);
  assert.equal(generated.body.generationMode, 'FACTS_ONLY');
  assert.equal(generated.body.snapshot.report.clientId, secondClientId);
  assert.equal(generated.body.snapshot.report.projectId, secondProjectId);
  assert.ok(generated.body.snapshot.sourceSummary.total > 0);
  assert.match(generated.body.sourceFingerprint, /^[a-f0-9]{64}$/);

  const reused = await request(`/api/clients/${secondClientId}/status-reports`, {
    method: 'POST',
    headers: { authorization: `Bearer ${staffToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ projectId: secondProjectId, asOfDate }),
  });
  assert.equal(reused.response.status, 200);
  assert.equal(reused.body.id, generated.body.id);
  assert.equal(reused.body.reused, true);

  const list = await request(`/api/clients/${secondClientId}/status-reports`, { headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(list.response.status, 200);
  assert.ok(list.body.data.some((item: any) => item.id === generated.body.id));

  for (const format of ['pdf', 'xlsx'] as const) {
    const response = await fetch(`${baseUrl}/api/clients/${secondClientId}/status-reports/${generated.body.id}/export?format=${format}`, { headers: { authorization: `Bearer ${adminToken}` } });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-disposition') || '', new RegExp(`\\.${format}`));
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.ok(bytes.length > 1000);
    assert.equal(format === 'pdf' ? bytes.subarray(0, 4).toString() : bytes.subarray(0, 2).toString(), format === 'pdf' ? '%PDF' : 'PK');
  }

  const ownClientDenied = await request(`/api/clients/${clientId}/status-reports`, {
    method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ projectId: secondProjectId, asOfDate }),
  });
  assert.equal(ownClientDenied.response.status, 404);
  assert.equal(ownClientDenied.body.error.code, 'REPORT_NOT_FOUND');
});

test('browser session cookie authenticates reads and requires CSRF for mutations', async () => {
  const loginResult = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'admin123' }),
  });
  assert.equal(loginResult.response.status, 200);
  assert.equal(loginResult.body.token, undefined);
  const setCookies = loginResult.response.headers.getSetCookie();
  const sessionCookie = setCookies.find((value) => value.startsWith('portal_session='));
  const csrfCookie = setCookies.find((value) => value.startsWith('portal_csrf='));
  assert.ok(sessionCookie?.includes('HttpOnly'));
  assert.ok(sessionCookie?.includes('SameSite=Strict'));
  assert.ok(csrfCookie && !csrfCookie.includes('HttpOnly'));
  const cookieHeader = [sessionCookie, csrfCookie].map((value) => value!.split(';')[0]).join('; ');
  const csrfToken = csrfCookie!.split(';')[0].split('=')[1];

  const me = await request('/api/auth/me', { headers: { cookie: cookieHeader } });
  assert.equal(me.response.status, 200);
  assert.equal(me.body.email, 'admin@example.com');

  const rejected = await request('/api/auth/logout', { method: 'POST', headers: { cookie: cookieHeader } });
  assert.equal(rejected.response.status, 403);

  const accepted = await request('/api/auth/logout', {
    method: 'POST',
    headers: { cookie: cookieHeader, 'x-csrf-token': csrfToken },
  });
  assert.equal(accepted.response.status, 200);
});

test('weak passwords are rejected for new accounts', async () => {
  const result = await request('/api/auth/register', {
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'weak-password@example.com', password: 'password', name: 'Weak Password', role: 'STAFF' }),
  });
  assert.equal(result.response.status, 400);
  assert.equal(await prisma.user.count({ where: { email: 'weak-password@example.com' } }), 0);
});

test('administrator can recover an account without database editing', async () => {
  const recoveryUser = await prisma.user.upsert({
    where: { email: 'recovery-user@example.com' },
    update: { passwordHash: await bcrypt.hash('Original-Password-42!', 12), active: true, sessionVersion: { increment: 1 } },
    create: {
      email: 'recovery-user@example.com',
      name: 'Recovery User',
      role: 'ADMIN',
      passwordHash: await bcrypt.hash('Original-Password-42!', 12),
    },
  });
  const originalToken = await login('recovery-user@example.com', 'Original-Password-42!');

  const denied = await request(`/api/auth/users/${recoveryUser.id}/password`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${clientToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ newPassword: 'Recovered-Password-43!' }),
  });
  assert.equal(denied.response.status, 403);

  const recovered = await request(`/api/auth/users/${recoveryUser.id}/password`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ newPassword: 'Recovered-Password-43!' }),
  });
  assert.equal(recovered.response.status, 200);
  const revoked = await request('/api/auth/me', { headers: { authorization: `Bearer ${originalToken}` } });
  assert.equal(revoked.response.status, 401);
  const recoveredToken = await login('recovery-user@example.com', 'Recovered-Password-43!');
  assert.ok(recoveredToken);

  await prisma.projectAssignment.upsert({
    where: { projectId_userId_scope: { projectId: secondProjectId, userId: recoveryUser.id, scope: 'PROJECT_OWNER' } },
    update: { active: true },
    create: { projectId: secondProjectId, userId: recoveryUser.id, scope: 'PROJECT_OWNER' },
  });

  const suspended = await request(`/api/auth/users/${recoveryUser.id}/access`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ active: false }),
  });
  assert.equal(suspended.response.status, 200);
  assert.equal(suspended.body.deactivatedAssignments, 1);
  assert.equal(await prisma.projectAssignment.count({ where: { userId: recoveryUser.id, active: true } }), 0);
  const suspendedSession = await request('/api/auth/me', { headers: { authorization: `Bearer ${recoveredToken}` } });
  assert.equal(suspendedSession.response.status, 401);
  const suspendedLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-auth-mode': 'bearer' },
    body: JSON.stringify({ email: 'recovery-user@example.com', password: 'Recovered-Password-43!' }),
  });
  assert.equal(suspendedLogin.response.status, 401);
  const suspendedAssignment = await request('/api/inquiries', {
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ clientId: secondClientId, ownerId: recoveryUser.id, description: 'Suspended assignment rejection test.' }),
  });
  assert.equal(suspendedAssignment.response.status, 400);
  assert.match(suspendedAssignment.body.error.message, /active internal user/i);
  const reactivated = await request(`/api/auth/users/${recoveryUser.id}/access`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ active: true }),
  });
  assert.equal(reactivated.response.status, 200);

  const selfSuspension = await request(`/api/auth/users/${adminUserId}/access`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ active: false }),
  });
  assert.equal(selfSuspension.response.status, 409);
});

test('deleting a client revokes linked sessions until both client and account are deliberately restored', async () => {
  const email = 'deleted-client-access@example.com';
  const password = 'Deletion-Test-42!';
  await prisma.user.deleteMany({ where: { email } });
  await prisma.client.deleteMany({ where: { email } });
  const client = await prisma.client.create({ data: { name: 'Deleted Client Access Test', email, status: 'ACTIVE' } });
  const user = await prisma.user.create({
    data: { email, name: 'Deleted Client Access Test', passwordHash: await bcrypt.hash(password, 12), role: 'CLIENT', clientId: client.id },
  });
  const project = await prisma.poolProject.create({ data: { clientId: client.id, workflowEnabled: true, currentLifecycleStage: 'INQUIRY' } });
  const invitation = await prisma.invitation.create({
    data: { email: 'pending-deleted-client@example.com', clientId: client.id, token: `deleted-client-${crypto.randomUUID()}`, expiresAt: new Date(Date.now() + 86_400_000) },
  });

  try {
    const token = await login(email, password);
    const deletion = await request(`/api/clients/${client.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${adminToken}` } });
    assert.equal(deletion.response.status, 200);
    assert.equal(deletion.body.revokedUsers, 1);
    assert.equal(deletion.body.revokedInvitations, 1);
    assert.equal((await prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } })).status, 'REVOKED');

    const staleSession = await request('/api/auth/me', { headers: { authorization: `Bearer ${token}` } });
    assert.equal(staleSession.response.status, 401);
    const archived = await request('/api/clients?archived=true', { headers: { authorization: `Bearer ${adminToken}` } });
    assert.equal(archived.response.status, 200);
    assert.ok(archived.body.data.some((item: any) => item.id === client.id));
    const staffArchived = await request('/api/clients?archived=true', { headers: { authorization: `Bearer ${clientToken}` } });
    assert.equal(staffArchived.response.status, 403);
    const nestedArchived = await request(`/api/clients/${client.id}/communications`, { headers: { authorization: `Bearer ${clientToken}` } });
    assert.equal(nestedArchived.response.status, 404);
    const archivedWorkflow = await request(`/api/projects/${project.id}/command-center`, { headers: { authorization: `Bearer ${clientToken}` } });
    assert.equal(archivedWorkflow.response.status, 404);
    const prematureReactivation = await request(`/api/auth/users/${user.id}/access`, {
      method: 'PUT', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ active: true }),
    });
    assert.equal(prematureReactivation.response.status, 409);

    const restored = await request(`/api/clients/${client.id}/restore`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}` } });
    assert.equal(restored.response.status, 200);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).active, false);

    const reactivated = await request(`/api/auth/users/${user.id}/access`, {
      method: 'PUT', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ active: true }),
    });
    assert.equal(reactivated.response.status, 200);
    assert.equal(reactivated.body.active, true);
  } finally {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.client.deleteMany({ where: { id: client.id } });
  }
});

test('authentication only accepts the Bearer authorization scheme', async () => {
  const result = await request('/api/auth/me', { headers: { authorization: `Basic ${adminToken}` } });
  assert.equal(result.response.status, 401);
});

test('client cannot update or download another client document', async () => {
  const update = await request(`/api/clients/${clientId}/documents/${secondDocumentId}`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${clientToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ description: 'unauthorized' }),
  });
  assert.equal(update.response.status, 404);

  const download = await request(`/api/clients/${clientId}/documents/${secondDocumentId}/download`, {
    headers: { authorization: `Bearer ${clientToken}` },
  });
  assert.equal(download.response.status, 404);

  const preview = await request(`/api/files/${secondDocumentId}`, {
    headers: { authorization: `Bearer ${clientToken}` },
  });
  assert.equal(preview.response.status, 403);
});

test('soft-deleted document cannot be previewed', async () => {
  await prisma.document.update({ where: { id: secondDocumentId }, data: { deletedAt: new Date() } });
  const clientArchiveList = await request(`/api/clients/${secondClientId}/documents?includeDeleted=true`, {
    headers: { authorization: `Bearer ${secondClientToken}` },
  });
  assert.equal(clientArchiveList.response.status, 403);
  const staffArchiveList = await request(`/api/clients/${secondClientId}/documents?includeDeleted=true`, {
    headers: { authorization: `Bearer ${staffToken}` },
  });
  assert.equal(staffArchiveList.response.status, 200);
  assert.ok(staffArchiveList.body.data.some((item: any) => item.id === secondDocumentId));
  const result = await request(`/api/files/${secondDocumentId}`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(result.response.status, 404);
  await prisma.document.update({ where: { id: secondDocumentId }, data: { deletedAt: null } });
});

test('phase and checklist mutations reject children from another project', async () => {
  const phaseResult = await request(`/api/clients/${clientId}/project/phases/${secondPhaseId}`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${adminToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ status: 'IN_PROGRESS' }),
  });
  assert.equal(phaseResult.response.status, 404);

  const itemResult = await request(`/api/clients/${clientId}/project/phases/${secondPhaseId}/checklist/${secondItemId}`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${adminToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ isCompleted: true }),
  });
  assert.equal(itemResult.response.status, 404);
});

test('incomplete phase returns structured gate blockers', async () => {
  const result = await request(`/api/clients/${secondClientId}/project/phases/${secondPhaseId}`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${adminToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ status: 'COMPLETED' }),
  });
  assert.equal(result.response.status, 409);
  assert.equal(result.body.error.code, 'GATE_BLOCKED');
  assert.ok(result.body.error.blockers.length > 0);
});

test('validation failures use the standard error envelope', async () => {
  const result = await request('/api/clients', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${adminToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ name: '', email: 'not-an-email' }),
  });
  assert.equal(result.response.status, 400);
  assert.equal(result.body.error.code, 'VALIDATION_ERROR');
  assert.equal(typeof result.body.error.message, 'string');
});

test('upload rejects spoofed file content and removes the stored file', async () => {
  const before = new Set(fs.readdirSync(getUploadDirectory()));
  const form = new FormData();
  form.append('file', new Blob(['not a pdf'], { type: 'application/pdf' }), 'spoofed.pdf');

  const result = await request(`/api/clients/${clientId}/documents`, {
    method: 'POST',
    headers: { authorization: `Bearer ${clientToken}` },
    body: form,
  });

  assert.equal(result.response.status, 400);
  assert.equal(result.body.error.code, 'VALIDATION_ERROR');
  const afterFiles = fs.readdirSync(getUploadDirectory()).filter((filename) => !before.has(filename));
  assert.deepEqual(afterFiles, []);
});

test('upload accepts a valid signature through configured storage', async () => {
  const form = new FormData();
  form.append('file', new Blob(['%PDF-1.4\nvalid test'], { type: 'application/pdf' }), 'valid.pdf');

  const result = await request(`/api/clients/${clientId}/documents`, {
    method: 'POST',
    headers: { authorization: `Bearer ${clientToken}` },
    body: form,
  });

  assert.equal(result.response.status, 201);
  uploadedDocumentIds.push(result.body.id);
  uploadedFilenames.push(result.body.filename);
  assert.ok(fs.existsSync(path.join(getUploadDirectory(), result.body.filename)));

  await prisma.document.update({ where: { id: result.body.id }, data: { originalName: 'client "quote".pdf' } });
  const preview = await fetch(`${baseUrl}/api/files/${result.body.id}`, {
    headers: { authorization: `Bearer ${clientToken}` },
  });
  assert.equal(preview.status, 200);
  assert.equal(preview.headers.get('cache-control'), 'private, no-store');
  assert.match(preview.headers.get('content-disposition') || '', /filename="client _quote_\.pdf"/);
  assert.match(preview.headers.get('content-disposition') || '', /filename\*=UTF-8''client%20%22quote%22\.pdf/);

  const download = await fetch(`${baseUrl}/api/clients/${clientId}/documents/${result.body.id}/download`, {
    headers: { authorization: `Bearer ${clientToken}` },
  });
  assert.equal(download.status, 200);
  assert.equal(download.headers.get('cache-control'), 'private, no-store');
});

test('CORS permits configured frontend and rejects other origins', async () => {
  const allowed = await fetch(`${baseUrl}/api/health`, {
    headers: { origin: 'http://localhost:3000' },
  });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:3000');

  const denied = await fetch(`${baseUrl}/api/health`, {
    headers: { origin: 'https://untrusted.example' },
  });
  assert.equal(denied.status, 403);
});

test('workflow foundation enforces access, transitions, audit, and idempotency', async () => {
  const denied = await request(`/api/projects/${secondProjectId}/command-center`, {
    headers: { authorization: `Bearer ${clientToken}` },
  });
  assert.equal(denied.response.status, 403);

  const commandCenter = await request(`/api/projects/${secondProjectId}/command-center`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(commandCenter.response.status, 200);
  assert.equal(commandCenter.body.lifecycle.length, 5);
  assert.equal(commandCenter.body.project.currentLifecycleStage, 'INQUIRY');

  const otherClientUser = await prisma.user.findFirstOrThrow({ where: { clientId, role: 'CLIENT' } });
  const crossClientAssignment = await request(`/api/projects/${secondProjectId}/work-items`, {
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 'INQUIRY', title: 'Invalid cross-client task', ownerId: otherClientUser.id, clientVisible: true }),
  });
  assert.equal(crossClientAssignment.response.status, 400);
  assert.match(crossClientAssignment.body.error.message, /belong to this project client/i);

  const created = await request(`/api/projects/${secondProjectId}/work-items`, {
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 'INQUIRY', title: 'Confirm project objectives', clientVisible: false }),
  });
  assert.equal(created.response.status, 201);

  const blocked = await request(`/api/projects/${secondProjectId}/stages/INQUIRY/advance`, {
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ expectedVersion: 0, idempotencyKey: 'workflow-blocked-attempt' }),
  });
  assert.equal(blocked.response.status, 409);
  assert.equal(blocked.body.error.code, 'GATE_BLOCKED');
  assert.ok(blocked.body.error.blockers.some((item: any) => item.id === created.body.id));

  const completed = await request(`/api/work-items/${created.body.id}/complete`, {
    method: 'POST', headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(completed.response.status, 200);
  const verified = await request(`/api/work-items/${created.body.id}/verify`, {
    method: 'POST', headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(verified.response.status, 200);
  assert.equal(verified.body.status, 'VERIFIED');

  const decision = await request(`/api/projects/${secondProjectId}/decisions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 'INQUIRY', title: 'Accept inquiry', options: ['Accept', 'Decline'] }),
  });
  assert.equal(decision.response.status, 201);

  const approved = await request(`/api/decisions/${decision.body.id}/approve`, {
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json', 'idempotency-key': 'decision-accept-0001' },
    body: JSON.stringify({ selectedOption: 'Accept' }),
  });
  assert.equal(approved.response.status, 200);
  assert.equal(approved.body.status, 'APPROVED');

  const [advanceA, advanceB] = await Promise.all([
    request(`/api/projects/${secondProjectId}/stages/INQUIRY/advance`, {
      method: 'POST',
      headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json', 'idempotency-key': 'stage-inquiry-design-0001' },
      body: JSON.stringify({ expectedVersion: 0 }),
    }),
    request(`/api/projects/${secondProjectId}/stages/INQUIRY/advance`, {
      method: 'POST',
      headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json', 'idempotency-key': 'stage-inquiry-design-0001' },
      body: JSON.stringify({ expectedVersion: 0 }),
    }),
  ]);
  assert.ok([200, 409].includes(advanceA.response.status));
  assert.ok([200, 409].includes(advanceB.response.status));
  assert.ok(advanceA.response.status === 200 || advanceB.response.status === 200);

  const project = await prisma.poolProject.findUniqueOrThrow({ where: { id: secondProjectId } });
  assert.equal(project.currentLifecycleStage, 'DESIGN');
  assert.equal(project.workflowVersion, 1);
  const gate = await prisma.projectGate.findUniqueOrThrow({
    where: { projectId_fromStage_toStage: { projectId: secondProjectId, fromStage: 'INQUIRY', toStage: 'DESIGN' } },
  });
  assert.equal(gate.status, 'APPROVED');
  assert.equal(await prisma.approval.count({ where: { gateId: gate.id } }), 1);
  assert.ok(await prisma.activityLog.count({ where: { entityType: 'ProjectGate', entityId: gate.id, action: 'ADVANCE' } }));

  await prisma.$transaction([
    prisma.poolProject.update({ where: { id: secondProjectId }, data: { currentLifecycleStage: 'INQUIRY' } }),
    prisma.lifecycleStage.update({ where: { projectId_stage: { projectId: secondProjectId, stage: 'INQUIRY' } }, data: { status: 'IN_PROGRESS', completedAt: null } }),
    prisma.lifecycleStage.update({ where: { projectId_stage: { projectId: secondProjectId, stage: 'DESIGN' } }, data: { status: 'NOT_STARTED', startedAt: null } }),
  ]);
  await prisma.workItem.create({
    data: { projectId: secondProjectId, stage: 'INQUIRY', title: 'Document accepted risk', createdBy: adminUserId },
  });
  const override = await request(`/api/projects/${secondProjectId}/stages/INQUIRY/override`, {
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json', 'idempotency-key': 'stage-override-0001' },
    body: JSON.stringify({
      expectedVersion: 1,
      reason: 'Leadership accepted the documented schedule exception.',
      risk: 'The missing information may affect scope.',
      mitigation: 'Owner will confirm the information before procurement.',
      ownerId: adminUserId,
      dueAt: new Date(Date.now() + 86_400_000).toISOString(),
    }),
  });
  assert.equal(override.response.status, 200);
  const overriddenGate = await prisma.projectGate.findUniqueOrThrow({
    where: { projectId_fromStage_toStage: { projectId: secondProjectId, fromStage: 'INQUIRY', toStage: 'DESIGN' } },
  });
  assert.equal(overriddenGate.status, 'OVERRIDDEN');
  assert.equal(overriddenGate.overrideOwnerId, adminUserId);
  assert.ok(overriddenGate.overrideReason);
});

test('inquiry submission, qualification, documents, consultation, and conversion preserve data', async () => {
  await removeFixtureClient('inquiry-client@example.com');
  const inquiryClient = await prisma.client.create({
    data: { name: 'Inquiry Client', email: 'inquiry-client@example.com', status: 'LEAD' },
  });
  await prisma.user.create({
    data: {
      email: 'inquiry-client@example.com', passwordHash: await bcrypt.hash('inquiry123', 10),
      name: 'Inquiry Client', role: 'CLIENT', clientId: inquiryClient.id,
    },
  });
  const inquiryToken = await login('inquiry-client@example.com', 'inquiry123');

  const invalidSubmission = await request('/api/inquiries', {
    method: 'POST',
    headers: { authorization: `Bearer ${inquiryToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ objectives: 'Missing the required project description.' }),
  });
  assert.equal(invalidSubmission.response.status, 400);
  assert.equal(invalidSubmission.body.error.code, 'VALIDATION_ERROR');

  const submitted = await request('/api/inquiries', {
    method: 'POST',
    headers: { authorization: `Bearer ${inquiryToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      source: 'WEBSITE', description: 'New pool and outdoor living project.',
      objectives: 'Create a family-focused backyard.', preliminaryScope: 'Pool, patio, and drainage review.',
      budgetExpectation: '$100,000', desiredTiming: 'Spring 2027', ownerId: adminUserId,
      property: { address: '500 Inquiry Way', city: 'Phoenix', state: 'AZ', postalCode: '85001' },
    }),
  });
  assert.equal(submitted.response.status, 201);
  assert.equal(submitted.body.qualificationStatus, 'NEW');
  assert.equal(submitted.body.ownerId, null);
  assert.ok(submitted.body.property.id);
  const internalRecipientCount = await prisma.user.count({ where: { role: 'ADMIN', active: true } });
  assert.equal(await prisma.notification.count({ where: { inquiryId: submitted.body.id, type: 'INQUIRY_RECEIVED' } }), internalRecipientCount);
  assert.equal(await prisma.notification.count({ where: { inquiryId: submitted.body.id, type: 'INQUIRY_ACKNOWLEDGED' } }), 1);

  const invalidTransition = await request(`/api/inquiries/${submitted.body.id}/status`, {
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'QUALIFIED', expectedIntakeRevision: submitted.body.intakeRevision }),
  });
  assert.equal(invalidTransition.response.status, 409);
  assert.equal(invalidTransition.body.error.code, 'INVALID_TRANSITION');

  const informationRequest = await request(`/api/inquiries/${submitted.body.id}/missing-information`, {
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Provide a recent site survey', dueAt: new Date(Date.now() + 86_400_000).toISOString(), expectedIntakeRevision: submitted.body.intakeRevision }),
  });
  assert.equal(informationRequest.response.status, 201);
  assert.equal(informationRequest.body.type, 'MISSING_INFORMATION');
  assert.ok(await prisma.notification.count({ where: { itemId: informationRequest.body.id, type: 'MISSING_INFORMATION' } }));

  const phaseOneStarted = await request(`/api/inquiries/${submitted.body.id}/status`, {
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'IN_REVIEW', expectedIntakeRevision: submitted.body.intakeRevision + 1 }),
  });
  assert.equal(phaseOneStarted.response.status, 409);
  assert.equal(phaseOneStarted.body.error.code, 'GATE_BLOCKED');

  const clientUpdate = await request(`/api/inquiries/${submitted.body.id}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${inquiryToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      preliminaryScope: 'Pool, patio, drainage review, and a recent site survey.',
      property: { address: '502 Updated Inquiry Way', city: 'Phoenix', state: 'AZ', postalCode: '85001' },
      expectedIntakeRevision: submitted.body.intakeRevision + 1,
    }),
  });
  assert.equal(clientUpdate.response.status, 200);
  assert.equal(clientUpdate.body.preliminaryScope, 'Pool, patio, drainage review, and a recent site survey.');
  assert.equal(clientUpdate.body.property.address, '502 Updated Inquiry Way');
  assert.ok(await prisma.activityLog.count({ where: { entityType: 'Inquiry', entityId: submitted.body.id, action: 'CLIENT_UPDATE' } }));

  const duplicateSubmission = await request('/api/inquiries', {
    method: 'POST',
    headers: { authorization: `Bearer ${inquiryToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      description: 'Accidental duplicate inquiry.', objectives: 'This should update the existing inquiry.',
      property: { address: '502 Updated Inquiry Way' },
    }),
  });
  assert.equal(duplicateSubmission.response.status, 409);
  assert.equal(duplicateSubmission.body.error.code, 'CONFLICT');

  const requestCompleted = await request(`/api/work-items/${informationRequest.body.id}/complete`, {
    method: 'POST', headers: { authorization: `Bearer ${inquiryToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ expectedIntakeRevision: clientUpdate.body.intakeRevision, idempotencyKey: `security-client-response-${crypto.randomUUID()}` }),
  });
  assert.equal(requestCompleted.response.status, 200);
  assert.equal(requestCompleted.body.status, 'READY_FOR_REVIEW');
  assert.equal(await prisma.notification.count({ where: { itemId: informationRequest.body.id, type: 'INQUIRY_INFORMATION_PROVIDED', userId: adminUserId } }), 1);
  const requestVerified = await request(`/api/work-items/${informationRequest.body.id}/verify`, {
    method: 'POST', headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(requestVerified.response.status, 200);
  assert.equal(requestVerified.body.status, 'VERIFIED');

  const forbidden = await request(`/api/inquiries/${submitted.body.id}`, {
    headers: { authorization: `Bearer ${clientToken}` },
  });
  assert.equal(forbidden.response.status, 404);

  const form = new FormData();
  form.append('file', new Blob(['%PDF-1.4\ninquiry'], { type: 'application/pdf' }), 'inquiry.pdf');
  form.append('inquiryId', submitted.body.id);
  const upload = await request(`/api/clients/${inquiryClient.id}/documents`, {
    method: 'POST', headers: { authorization: `Bearer ${inquiryToken}` }, body: form,
  });
  assert.equal(upload.response.status, 201);
  assert.equal(upload.body.inquiryId, submitted.body.id);
  uploadedDocumentIds.push(upload.body.id);
  uploadedFilenames.push(upload.body.filename);

  const assigned = await request(`/api/inquiries/${submitted.body.id}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ ownerId: adminUserId, nextAction: 'Complete qualification review', nextActionDueAt: new Date(Date.now() + 86_400_000).toISOString(), expectedIntakeRevision: requestCompleted.body.inquiryRevision }),
  });
  assert.equal(assigned.response.status, 200);
  assert.equal(await prisma.notification.count({ where: { inquiryId: submitted.body.id, type: 'INQUIRY_ASSIGNED', userId: adminUserId } }), 1);

  const reviewStarted = await request(`/api/inquiries/${submitted.body.id}/status`, {
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'IN_REVIEW', expectedIntakeRevision: assigned.body.intakeRevision }),
  });
  assert.equal(reviewStarted.response.status, 200);

  const qualificationBlocked = await request(`/api/inquiries/${submitted.body.id}/status`, {
    method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'QUALIFIED', expectedIntakeRevision: reviewStarted.body.intakeRevision }),
  });
  assert.equal(qualificationBlocked.response.status, 409);
  assert.equal(qualificationBlocked.body.error.code, 'GATE_BLOCKED');

  const consultation = await request(`/api/clients/${inquiryClient.id}/consultations`, {
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'Qualification discovery call', activityType: 'PHONE_CALL', meetingMode: 'PHONE',
      date: new Date().toISOString(), status: 'COMPLETED', inquiryId: submitted.body.id,
      outcome: 'Initial project goals and follow-up needs were discussed.',
      expectedIntakeRevision: reviewStarted.body.intakeRevision,
    }),
  });
  assert.equal(consultation.response.status, 201);
  assert.equal(consultation.body.inquiryId, submitted.body.id);

  const currentInquiry = await prisma.inquiry.findUniqueOrThrow({ where: { id: submitted.body.id }, select: { intakeRevision: true } });
  const conversionBlocked = await request(`/api/inquiries/${submitted.body.id}/convert`, {
    method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ expectedIntakeRevision: currentInquiry.intakeRevision }),
  });
  assert.equal(conversionBlocked.response.status, 409);
  assert.equal(conversionBlocked.body.error.code, 'INVALID_TRANSITION');

  const preserved = await prisma.inquiry.findUniqueOrThrow({
    where: { id: submitted.body.id },
    include: { property: true, documents: true, consultations: true },
  });
  assert.equal(preserved.qualificationStatus, 'IN_REVIEW');
  assert.equal(preserved.projectId, null);
  assert.equal(preserved.documents.length, 1);
  assert.equal(preserved.consultations.length, 1);
  assert.equal(preserved.property?.address, '502 Updated Inquiry Way');
  assert.equal(await prisma.activityLog.count({ where: { entityType: 'Inquiry', entityId: submitted.body.id, action: 'CONVERT' } }), 0);
});

test('design and scope versions preserve history, evidence, approvals, and stale gates', async () => {
  const forbidden = await request(`/api/projects/${secondProjectId}/design`, {
    headers: { authorization: `Bearer ${clientToken}` },
  });
  assert.equal(forbidden.response.status, 403);

  const designV1 = await request(`/api/projects/${secondProjectId}/design-versions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ summary: 'Freeform concept with integrated spa.', requirements: 'Family use, shade, and safe access.', siteInformation: 'Existing grade falls toward the rear property line.', costImpact: 2500, scheduleImpact: 'Adds one design week.' }),
  });
  assert.equal(designV1.response.status, 201);
  assert.equal(designV1.body.versionNumber, 1);

  const scopeV1 = await request(`/api/projects/${secondProjectId}/scope-versions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ inclusions: 'Pool shell, spa, equipment, decking, and startup.', exclusions: 'Landscaping beyond disturbed areas.', allowances: 'Tile allowance: $4,000.', estimateAmount: 125000 }),
  });
  assert.equal(scopeV1.response.status, 201);
  assert.equal(scopeV1.body.versionNumber, 1);

  for (const [kind, id] of [['design-versions', designV1.body.id], ['scope-versions', scopeV1.body.id]]) {
    const submitted = await request(`/api/${kind}/${id}/submit`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}` } });
    assert.equal(submitted.response.status, 200);
    const approved = await request(`/api/${kind}/${id}/approve`, {
      method: 'POST', headers: { authorization: `Bearer ${secondClientToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ comment: 'Client approval recorded.' }),
    });
    assert.equal(approved.response.status, 200);
    assert.equal(approved.body.status, 'APPROVED');
  }

  const evidence = await request(`/api/projects/${secondProjectId}/evidence`, {
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ documentId: secondDocumentId, designVersionId: designV1.body.id, purpose: 'Approved concept drawing' }),
  });
  assert.equal(evidence.response.status, 201);
  const foreignEvidence = await request(`/api/projects/${secondProjectId}/evidence`, {
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ documentId: uploadedDocumentIds[0], designVersionId: designV1.body.id, purpose: 'Wrong client file' }),
  });
  assert.equal(foreignEvidence.response.status, 400);

  const designV2 = await request(`/api/projects/${secondProjectId}/design-versions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ summary: 'Materially relocated pool concept.', materialChange: true, changeSummary: 'Pool moved to protect drainage.', costImpact: 12000, scheduleImpact: 'Adds three weeks.' }),
  });
  assert.equal(designV2.response.status, 201);
  assert.equal(designV2.body.versionNumber, 2);
  const staleGate = await prisma.projectGate.findUniqueOrThrow({ where: { projectId_fromStage_toStage: { projectId: secondProjectId, fromStage: 'DESIGN', toStage: 'COMPLIANCE' } } });
  assert.equal(staleGate.status, 'STALE');
  assert.equal((await prisma.designVersion.findUniqueOrThrow({ where: { id: designV1.body.id } })).status, 'SUPERSEDED');

  await request(`/api/design-versions/${designV2.body.id}/submit`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}` } });
  const missingReason = await request(`/api/design-versions/${designV2.body.id}/reject`, {
    method: 'POST', headers: { authorization: `Bearer ${secondClientToken}`, 'content-type': 'application/json' }, body: '{}',
  });
  assert.equal(missingReason.response.status, 400);
  const rejected = await request(`/api/design-versions/${designV2.body.id}/reject`, {
    method: 'POST', headers: { authorization: `Bearer ${secondClientToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ comment: 'The relocation conflicts with the client priority.' }),
  });
  assert.equal(rejected.response.status, 200);

  const blockedProject = await prisma.poolProject.findUniqueOrThrow({ where: { id: secondProjectId } });
  const blocked = await request(`/api/projects/${secondProjectId}/stages/DESIGN/advance`, {
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ expectedVersion: blockedProject.workflowVersion }),
  });
  assert.equal(blocked.response.status, 409);
  assert.equal(blocked.body.error.code, 'GATE_BLOCKED');
  assert.ok(blocked.body.error.blockers.some((item: any) => item.id === 'approved-design'));

  const designV3 = await request(`/api/projects/${secondProjectId}/design-versions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ summary: 'Reconciled concept retaining drainage and client priorities.', changeSummary: 'Responds to rejected relocation.' }),
  });
  assert.equal(designV3.body.versionNumber, 3);
  await request(`/api/design-versions/${designV3.body.id}/submit`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}` } });
  const finalApproval = await request(`/api/design-versions/${designV3.body.id}/approve`, {
    method: 'POST', headers: { authorization: `Bearer ${secondClientToken}`, 'content-type': 'application/json' }, body: '{}',
  });
  assert.equal(finalApproval.response.status, 200);

  const workspace = await request(`/api/projects/${secondProjectId}/design`, { headers: { authorization: `Bearer ${secondClientToken}` } });
  assert.equal(workspace.response.status, 200);
  assert.equal(workspace.body.designVersions.length, 2);
  assert.equal(workspace.body.designVersions[0].versionNumber, 3);
  assert.equal(workspace.body.designVersions.filter((item: any) => item.status === 'APPROVED').length, 1);
  assert.equal(await prisma.approval.count({ where: { projectId: secondProjectId, approvalType: { in: ['DESIGN_DIRECTION', 'SCOPE_AUTHORIZATION'] } } }), 4);

  const readyProject = await prisma.poolProject.findUniqueOrThrow({ where: { id: secondProjectId } });
  const advanced = await request(`/api/projects/${secondProjectId}/stages/DESIGN/advance`, {
    method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ expectedVersion: readyProject.workflowVersion }),
  });
  assert.equal(advanced.response.status, 200);
  assert.equal(advanced.body.currentLifecycleStage, 'COMPLIANCE');
});

test('compliance register enforces evidence, review, external delays, visibility, exceptions, and gate blockers', async () => {
  const hoa = await request(`/api/projects/${secondProjectId}/compliance`, {
    method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ category: 'HOA', description: 'Obtain HOA architectural approval.', externalAgency: 'Test HOA', required: true, ownerId: adminUserId, reviewerId: adminUserId, dueAt: new Date(Date.now() - 86400000).toISOString(), evidenceRequired: true, clientVisible: true }),
  });
  assert.equal(hoa.response.status, 201);
  const missingEvidence = await request(`/api/compliance/${hoa.body.id}/submit`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(missingEvidence.response.status, 409);
  assert.equal(missingEvidence.body.error.code, 'GATE_BLOCKED');
  const evidence = await request(`/api/compliance/${hoa.body.id}/evidence`, {
    method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ documentId: secondDocumentId, purpose: 'HOA approval package' }),
  });
  assert.equal(evidence.response.status, 201);
  const pendingExternal = await request(`/api/compliance/${hoa.body.id}/submit`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(pendingExternal.body.status, 'PENDING_EXTERNAL');
  const rejected = await request(`/api/compliance/${hoa.body.id}/review`, {
    method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ approved: false, reason: 'HOA requested a revised screening detail.' }),
  });
  assert.equal(rejected.body.status, 'REJECTED');
  await request(`/api/compliance/${hoa.body.id}`, {
    method: 'PUT', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ status: 'IN_PROGRESS' }),
  });
  await request(`/api/compliance/${hoa.body.id}/submit`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}` } });
  const approvedHoa = await request(`/api/compliance/${hoa.body.id}/review`, {
    method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ approved: true }),
  });
  assert.equal(approvedHoa.body.status, 'APPROVED');

  const engineering = await request(`/api/projects/${secondProjectId}/compliance`, {
    method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ category: 'ENGINEERING', description: 'Confirm structural engineering requirements.', ownerId: adminUserId, reviewerId: adminUserId, clientVisible: false }),
  });
  await request(`/api/compliance/${engineering.body.id}/submit`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}` } });
  await request(`/api/compliance/${engineering.body.id}/review`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ approved: true }) });

  const access = await request(`/api/projects/${secondProjectId}/compliance`, {
    method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ category: 'ACCESS', description: 'Confirm equipment and emergency access.', ownerId: adminUserId, reviewerId: adminUserId, dueAt: new Date(Date.now() - 86400000).toISOString(), clientVisible: true }),
  });
  const internalList = await request(`/api/projects/${secondProjectId}/compliance`, { headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(internalList.response.status, 200);
  assert.ok(await prisma.notification.count({ where: { type: 'COMPLIANCE_OVERDUE', itemId: access.body.id, userId: adminUserId } }));
  const clientList = await request(`/api/projects/${secondProjectId}/compliance`, { headers: { authorization: `Bearer ${secondClientToken}` } });
  assert.equal(clientList.response.status, 200);
  assert.equal(clientList.body.requirements.length, 2);
  assert.ok(!clientList.body.requirements.some((item: any) => item.id === engineering.body.id));

  const project = await prisma.poolProject.findUniqueOrThrow({ where: { id: secondProjectId } });
  const blocked = await request(`/api/projects/${secondProjectId}/stages/COMPLIANCE/advance`, {
    method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ expectedVersion: project.workflowVersion }),
  });
  assert.equal(blocked.response.status, 409);
  assert.ok(blocked.body.error.blockers.some((item: any) => item.id === access.body.id));

  const exception = await request(`/api/compliance/${access.body.id}/exceptions`, {
    method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ reason: 'Access confirmation depends on the excavation subcontractor.', risk: 'Mobilization could be delayed.', mitigation: 'Confirm route before release.', ownerId: adminUserId, dueAt: new Date(Date.now() + 86400000).toISOString() }),
  });
  assert.equal(exception.response.status, 201);
  const approvedException = await request(`/api/compliance-exceptions/${exception.body.id}/approve`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(approvedException.body.status, 'APPROVED');
  const ready = await prisma.poolProject.findUniqueOrThrow({ where: { id: secondProjectId } });
  const advanced = await request(`/api/projects/${secondProjectId}/stages/COMPLIANCE/advance`, {
    method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ expectedVersion: ready.workflowVersion }),
  });
  assert.equal(advanced.response.status, 200);
  assert.equal(advanced.body.currentLifecycleStage, 'PRE_CONSTRUCTION');
});

test('Pre-Construction readiness enforces reconciliation, completeness, client deadlines, leadership exceptions, review audit, and gate approval', async () => {
  const workspace = await request(`/api/projects/${secondProjectId}/preconstruction`, { headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(workspace.response.status, 200);
  assert.equal(workspace.body.items.length, 19);
  assert.equal(workspace.body.readiness.score, 0);

  const scope = workspace.body.items.find((item: any) => item.category === 'SCOPE_RECONCILIATION');
  await request(`/api/preconstruction/items/${scope.id}`, {
    method: 'PUT', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ sourceReference: 'Contract scope v1', targetReference: 'Approved scope v2' }),
  });
  const mismatch = await request(`/api/preconstruction/items/${scope.id}/complete`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(mismatch.response.status, 409);
  assert.equal(mismatch.body.error.code, 'GATE_BLOCKED');
  await request(`/api/preconstruction/items/${scope.id}`, {
    method: 'PUT', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ targetReference: 'Contract scope v1' }),
  });
  assert.equal((await request(`/api/preconstruction/items/${scope.id}/complete`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}` } })).body.status, 'READY');
  await request(`/api/preconstruction/items/${scope.id}/evidence`, {
    method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ documentId: secondDocumentId, purpose: 'Approved scope reconciliation' }),
  });

  for (const scope of ['PROJECT_OWNER', 'READINESS_REVIEWER']) {
    const assignment = await request(`/api/projects/${secondProjectId}/assignments`, {
      method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ userId: staffUserId, scope }),
    });
    assert.equal(assignment.response.status, 201);
  }

  const responsibility = workspace.body.items.find((item: any) => item.category === 'CLIENT_RESPONSIBILITY');
  await request(`/api/preconstruction/items/${responsibility.id}`, {
    method: 'PUT', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ dueAt: new Date(Date.now() - 86400000).toISOString(), clientVisible: true, responsibilityParty: 'CLIENT' }),
  });
  await request(`/api/projects/${secondProjectId}/preconstruction`, { headers: { authorization: `Bearer ${adminToken}` } });
  assert.ok(await prisma.notification.count({ where: { type: 'PRECONSTRUCTION_OVERDUE', itemId: responsibility.id, userId: secondUserId } }));
  const clientWorkspace = await request(`/api/projects/${secondProjectId}/preconstruction`, { headers: { authorization: `Bearer ${secondClientToken}` } });
  assert.equal(clientWorkspace.response.status, 200);
  assert.ok(clientWorkspace.body.items.every((item: any) => item.clientVisible));
  assert.equal((await request(`/api/preconstruction/items/${responsibility.id}/complete`, { method: 'POST', headers: { authorization: `Bearer ${secondClientToken}` } })).body.status, 'READY');

  const selection = workspace.body.items.find((item: any) => item.category === 'SELECTION_ALLOWANCE');
  const firstReview = await request(`/api/projects/${secondProjectId}/readiness-review`, {
    method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ reviewerId: staffUserId }),
  });
  assert.equal(firstReview.response.status, 201);
  const blockedReview = await request(`/api/readiness-reviews/${firstReview.body.id}/submit`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(blockedReview.response.status, 409);
  assert.ok(blockedReview.body.error.blockers.some((item: any) => item.id === selection.id));

  for (const item of workspace.body.items) {
    if ([scope.id, responsibility.id, selection.id].includes(item.id)) continue;
    const completed = await request(`/api/preconstruction/items/${item.id}/complete`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}` } });
    assert.equal(completed.response.status, 200, `Expected ${item.category} to complete`);
  }

  for (const item of workspace.body.items.filter((entry: any) => ['CONTRACT', 'PLANS_SPECIFICATIONS', 'ENGINEERING_PERMITS'].includes(entry.category))) {
    const evidence = await request(`/api/preconstruction/items/${item.id}/evidence`, {
      method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ documentId: secondDocumentId, purpose: `${item.category} readiness evidence` }),
    });
    assert.equal(evidence.response.status, 201);
  }

  const exception = await request(`/api/preconstruction/items/${selection.id}/exceptions`, {
    method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ reason: 'Final tile selection is scheduled after procurement release.', risk: 'Finish pricing may vary.', mitigation: 'Carry the approved allowance and require selection before ordering.', ownerId: adminUserId, dueAt: new Date(Date.now() + 86400000).toISOString(), highRisk: true }),
  });
  assert.equal(exception.response.status, 201);
  const deniedApproval = await request(`/api/readiness-exceptions/${exception.body.id}/approve`, { method: 'POST', headers: { authorization: `Bearer ${clientToken}` } });
  assert.equal(deniedApproval.response.status, 403);
  const approvedException = await request(`/api/readiness-exceptions/${exception.body.id}/approve`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(approvedException.body.status, 'APPROVED');

  const finalReview = await request(`/api/projects/${secondProjectId}/readiness-review`, {
    method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ reviewerId: staffUserId }),
  });
  assert.equal(finalReview.body.score, 100);
  assert.equal(finalReview.body.blockerCount, 0);
  const submitted = await request(`/api/readiness-reviews/${finalReview.body.id}/submit`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(submitted.body.status, 'SUBMITTED');
  const approvedReview = await request(`/api/readiness-reviews/${finalReview.body.id}/approve`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(approvedReview.body.status, 'APPROVED');
  assert.equal(approvedReview.body.result, 'CONSTRUCTION_READY');
  assert.ok(await prisma.activityLog.count({ where: { entityType: 'ReadinessReview', entityId: finalReview.body.id, action: 'APPROVE' } }));

  const project = await prisma.poolProject.findUniqueOrThrow({ where: { id: secondProjectId } });
  const advanced = await request(`/api/projects/${secondProjectId}/stages/PRE_CONSTRUCTION/advance`, {
    method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ expectedVersion: project.workflowVersion }),
  });
  assert.equal(advanced.response.status, 200);
  assert.equal(advanced.body.currentLifecycleStage, 'PROCUREMENT');
});

test('Procurement controls vendors, quotes, authorization, deliveries, substitutions, three-way matching, and field handoff', async () => {
  const clientVendorList = await request('/api/vendors', { headers: { authorization: `Bearer ${secondClientToken}` } });
  assert.equal(clientVendorList.response.status, 403);

  const vendors = [] as any[];
  for (const data of [
    { name: 'Aqua Equipment Supply', category: 'EQUIPMENT', complianceStatus: 'APPROVED', email: 'aqua@example.com' },
    { name: 'Reliable Pool Wholesale', category: 'EQUIPMENT', complianceStatus: 'APPROVED', email: 'reliable@example.com' },
  ]) {
    const result = await request('/api/vendors', { method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: JSON.stringify(data) });
    assert.equal(result.response.status, 201); vendors.push(result.body); procurementVendorIds.push(result.body.id);
  }

  const procurement = await request(`/api/projects/${secondProjectId}/procurement/requests`, {
    method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ description: 'Variable-speed circulation pumps', specification: 'Two 3 HP variable-speed pumps with controls', quantity: 10, unit: 'EA', requiredBy: new Date(Date.now() - 86400000).toISOString(), estimatedCostCents: 110000, currencyCode: 'USD', costCode: 'EQ-210', ownerId: adminUserId, clientVisible: true }),
  });
  assert.equal(procurement.response.status, 201);
  const clientWorkspace = await request(`/api/projects/${secondProjectId}/procurement`, { headers: { authorization: `Bearer ${secondClientToken}` } });
  assert.equal(clientWorkspace.response.status, 200);
  assert.equal(clientWorkspace.body.requests.length, 1);
  assert.equal(clientWorkspace.body.requests[0].quotes, undefined);

  const wrongCurrency = await request(`/api/procurement/requests/${procurement.body.id}/quotes`, {
    method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ vendorId: vendors[0].id, amountCents: 100000, taxCents: 8000, currencyCode: 'EUR', scope: 'Equipment and freight' }),
  });
  assert.equal(wrongCurrency.response.status, 400);

  const quotes = [] as any[];
  for (const data of [
    { vendorId: vendors[0].id, amountCents: 100000, taxCents: 8000, currencyCode: 'USD', scope: 'Equipment and freight', leadTimeDays: 45 },
    { vendorId: vendors[1].id, amountCents: 95000, taxCents: 7600, currencyCode: 'USD', scope: 'Equipment, controls, and freight', leadTimeDays: 35 },
  ]) {
    const quote = await request(`/api/procurement/requests/${procurement.body.id}/quotes`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: JSON.stringify(data) });
    assert.equal(quote.response.status, 201); quotes.push(quote.body);
  }
  const deniedSelection = await request(`/api/procurement/requests/${procurement.body.id}/select-quote`, { method: 'POST', headers: { authorization: `Bearer ${clientToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ quoteId: quotes[1].id }) });
  assert.equal(deniedSelection.response.status, 403);
  const selected = await request(`/api/procurement/requests/${procurement.body.id}/select-quote`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ quoteId: quotes[1].id }) });
  assert.equal(selected.response.status, 200);
  assert.equal(selected.body.selectedQuote.id, quotes[1].id);

  const deniedPo = await request(`/api/procurement/requests/${procurement.body.id}/purchase-order`, { method: 'POST', headers: { authorization: `Bearer ${clientToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ orderNumber: 'PO-TEST-DENIED' }) });
  assert.equal(deniedPo.response.status, 403);
  const po = await request(`/api/procurement/requests/${procurement.body.id}/purchase-order`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ orderNumber: `PO-${Date.now()}` }) });
  assert.equal(po.response.status, 201);
  assert.equal(po.body.approvedAmountCents, 102600);
  const duplicatePo = await request(`/api/procurement/requests/${procurement.body.id}/purchase-order`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ orderNumber: `PO-DUP-${Date.now()}` }) });
  assert.equal(duplicatePo.response.status, 409);

  const blockedGate = await request(`/api/projects/${secondProjectId}/procurement/gate/approve`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(blockedGate.response.status, 409);
  assert.equal(blockedGate.body.error.code, 'GATE_BLOCKED');

  const delivery = async (quantityReceived: number, condition: string) => request(`/api/procurement/purchase-orders/${po.body.id}/deliveries`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ quantityReceived, condition, receivedAt: new Date().toISOString() }) });
  const partial = await delivery(4, 'GOOD'); assert.equal(partial.response.status, 201);
  assert.equal((await request(`/api/procurement/deliveries/${partial.body.id}/inspect`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ passed: true }) })).body.inspectionStatus, 'PASSED');
  const damaged = await delivery(6, 'DAMAGED'); assert.equal(damaged.response.status, 201);
  const failedInspection = await request(`/api/procurement/deliveries/${damaged.body.id}/inspect`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ passed: false, notes: 'Housing damaged in transit; replacement required.' }) });
  assert.equal(failedInspection.body.inspectionStatus, 'FAILED');
  assert.ok(await prisma.notification.count({ where: { type: 'DELIVERY_EXCEPTION', itemId: damaged.body.id, userId: adminUserId } }));
  const replacement = await delivery(6, 'GOOD'); assert.equal(replacement.response.status, 201);
  assert.equal((await request(`/api/procurement/deliveries/${replacement.body.id}/inspect`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ passed: true }) })).body.inspectionStatus, 'PASSED');

  const substitution = await request(`/api/procurement/requests/${procurement.body.id}/substitutions`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ proposedSpecification: 'Equivalent updated pump controller revision B', reason: 'Original controller revision is discontinued by the manufacturer.', costImpactCents: 0, scheduleImpactDays: 2, clientAuthorizationRequired: true }) });
  assert.equal(substitution.response.status, 201);
  const internalApproval = await request(`/api/procurement/substitutions/${substitution.body.id}/approve`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(internalApproval.body.status, 'WAITING_CLIENT');
  const clientApproval = await request(`/api/procurement/substitutions/${substitution.body.id}/client-authorize`, { method: 'POST', headers: { authorization: `Bearer ${secondClientToken}` } });
  assert.equal(clientApproval.body.status, 'APPROVED');

  const variance = await request(`/api/procurement/requests/${procurement.body.id}/invoice-match`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ invoiceReference: 'INV-VARIANCE', deliveredAmountCents: 102600, invoicedAmountCents: 103100 }) });
  assert.equal(variance.body.status, 'VARIANCE');
  assert.equal(variance.body.varianceAmountCents, 500);
  const matched = await request(`/api/procurement/requests/${procurement.body.id}/invoice-match`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ invoiceReference: 'INV-MATCHED', deliveredAmountCents: 102600, invoicedAmountCents: 102600 }) });
  assert.equal(matched.body.status, 'MATCHED');
  assert.equal(matched.body.deliveredQuantity, 10);
  const closed = await request(`/api/procurement/requests/${procurement.body.id}/close`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(closed.body.status, 'CLOSED');

  const gate = await request(`/api/projects/${secondProjectId}/procurement/gate/approve`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(gate.response.status, 200);
  assert.equal(gate.body.status, 'APPROVED');
  const project = await prisma.poolProject.findUniqueOrThrow({ where: { id: secondProjectId } });
  assert.equal(project.status, 'FIELD_EXECUTION');
  assert.equal(project.currentLifecycleStage, null);
  assert.ok(await prisma.activityLog.count({ where: { entityType: 'ProjectGate', entityId: gate.body.id, action: 'ADVANCE' } }));
  assert.ok(await prisma.projectAssignment.count({ where: { projectId: secondProjectId, userId: staffUserId, active: true } }) >= 2);
});

test('Automation remains reviewable and non-authoritative while notifications retry and management metrics reconcile', async () => {
  const denied = await request('/api/automation/run', { method: 'POST', headers: { authorization: `Bearer ${secondClientToken}` } });
  assert.equal(denied.response.status, 403);
  const matrix = await request('/api/automation/notification-matrix', { headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(matrix.response.status, 200);
  assert.ok(matrix.body.data.length >= 10);

  const overdue = await prisma.workItem.create({ data: { projectId: secondProjectId, stage: 'PROCUREMENT', type: 'AUTOMATION_TEST', title: 'Automation overdue action', ownerId: adminUserId, dueAt: new Date(Date.now() - 5 * 86400000), createdBy: adminUserId } });
  const incompleteInquiry = await prisma.inquiry.create({ data: { clientId: secondClientId, description: 'Automation missing information test.', objectives: 'Test suggestion review.', qualificationStatus: 'NEW' } });
  const archivedClient = await prisma.client.create({ data: { name: 'Archived Automation Exclusion', email: 'archived-automation@example.com', status: 'ACTIVE', deletedAt: new Date() } });
  const archivedProject = await prisma.poolProject.create({ data: { clientId: archivedClient.id, workflowEnabled: true, currentLifecycleStage: 'INQUIRY' } });
  const archivedOverdue = await prisma.workItem.create({ data: { projectId: archivedProject.id, stage: 'INQUIRY', type: 'ARCHIVED_AUTOMATION_TEST', title: 'Archived action must stay out of automation', ownerId: adminUserId, dueAt: new Date(Date.now() - 5 * 86400000), createdBy: adminUserId } });
  const archivedInquiry = await prisma.inquiry.create({ data: { clientId: archivedClient.id, projectId: archivedProject.id, description: 'Archived inquiry must stay out of automation.', qualificationStatus: 'NEW' } });
  await prisma.consultation.updateMany({ where: { clientId: secondClientId }, data: { notes: 'Client confirmed access route. Team will validate staging and send the revised plan.' } });
  const closedRequest = await prisma.procurementRequest.findFirstOrThrow({ where: { projectId: secondProjectId } });
  await prisma.procurementRequest.update({ where: { id: closedRequest.id }, data: { status: 'ORDERED', closedAt: null } });

  delete process.env.EXTERNAL_NOTIFICATION_MODE;
  const firstRun = await request('/api/automation/run', { method: 'POST', headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(firstRun.response.status, 200);
  assert.equal(firstRun.body.run.status, 'COMPLETED_WITH_ERRORS');
  assert.ok(firstRun.body.metrics.suggestionCount > 0);
  assert.ok(firstRun.body.metrics.deliveryFailures > 0);
  const escalationCount = await prisma.notification.count({ where: { type: 'ESCALATION', itemId: overdue.id, userId: adminUserId } });
  assert.equal(escalationCount, 1);
  assert.equal(await prisma.notification.count({ where: { itemId: archivedOverdue.id } }), 0);
  assert.equal(await prisma.automationSuggestion.count({ where: { sourceEntityType: 'Inquiry', sourceEntityId: archivedInquiry.id } }), 0);

  const suggestionList = await request('/api/automation/suggestions?status=PENDING_REVIEW', { headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(suggestionList.response.status, 200);
  const missingSuggestion = suggestionList.body.data.find((item: any) => item.type === 'MISSING_INFORMATION' && item.sourceEntityId === incompleteInquiry.id);
  assert.ok(missingSuggestion);
  const accepted = await request(`/api/automation/suggestions/${missingSuggestion.id}/review`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ decision: 'ACCEPT', comment: 'Coordinator confirmed this should become an internal action.', createWorkItem: true }) });
  assert.equal(accepted.response.status, 200);
  assert.ok(accepted.body.workItemId);
  assert.equal(accepted.body.suggestion.status, 'ACCEPTED');
  assert.ok(await prisma.activityLog.count({ where: { entityType: 'AutomationSuggestion', entityId: missingSuggestion.id, action: 'ACCEPT' } }));

  const quoteSuggestion = suggestionList.body.data.find((item: any) => item.type === 'QUOTE_COMPARISON');
  assert.ok(quoteSuggestion);
  const rejected = await request(`/api/automation/suggestions/${quoteSuggestion.id}/review`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ decision: 'REJECT', comment: 'Comparison reviewed; no action required.', createWorkItem: false }) });
  assert.equal(rejected.body.suggestion.status, 'REJECTED');

  const secondRun = await request('/api/automation/run', { method: 'POST', headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(secondRun.response.status, 200);
  assert.equal(await prisma.notification.count({ where: { type: 'ESCALATION', itemId: overdue.id, userId: adminUserId } }), escalationCount);
  assert.equal((await prisma.automationSuggestion.findUniqueOrThrow({ where: { id: missingSuggestion.id } })).status, 'ACCEPTED');

  const failedDelivery = await prisma.notificationDelivery.findFirstOrThrow({ where: { status: 'FAILED' } });
  process.env.EXTERNAL_NOTIFICATION_MODE = 'test-success';
  const retried = await request(`/api/automation/deliveries/${failedDelivery.id}/retry`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}` } });
  delete process.env.EXTERNAL_NOTIFICATION_MODE;
  assert.equal(retried.response.status, 200);
  assert.equal(retried.body.status, 'SENT');
  assert.ok(retried.body.attemptCount >= 2);

  const dashboard = await request('/api/management/dashboard', { headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(dashboard.response.status, 200);
  assert.equal(dashboard.body.overview.activeProjects, await prisma.poolProject.count({ where: { workflowEnabled: true, client: { deletedAt: null } } }));
  assert.ok(!dashboard.body.stageAging.some((item: any) => item.projectId === archivedProject.id));
  assert.equal(dashboard.body.procurement.requests, await prisma.procurementRequest.count());
  assert.equal(dashboard.body.compliance.total, await prisma.complianceRequirement.count());
  assert.equal(dashboard.body.automation.pendingSuggestions, await prisma.automationSuggestion.count({ where: { status: 'PENDING_REVIEW' } }));
  assert.ok(Array.isArray(dashboard.body.stageAging));
  assert.equal(dashboard.body.clientExperience.communicationsLast30Days, await prisma.communication.count({ where: { deletedAt: null, date: { gte: new Date(Date.now() - 30 * 86400000) } } }));
  await prisma.client.delete({ where: { id: archivedClient.id } });
});

test('production controls expose health and feature state while legal holds prevent deletion', async()=>{
  const health=await request('/api/health');assert.equal(health.response.status,200);assert.equal(health.body.checks.database.ok,true);assert.equal(health.body.checks.uploadStorage.ok,true);assert.ok(health.response.headers.get('x-request-id'));
  const ready=await request('/api/health/ready');assert.equal(ready.body.status,'ready');
  const denied=await request('/api/management/legal-holds',{method:'POST',headers:{authorization:`Bearer ${clientToken}`,'content-type':'application/json'},body:JSON.stringify({entityType:'Document',entityId:secondDocumentId,reason:'A client must not be allowed to create a legal hold.'})});assert.equal(denied.response.status,403);
  const created=await request('/api/management/legal-holds',{method:'POST',headers:{authorization:`Bearer ${adminToken}`,'content-type':'application/json'},body:JSON.stringify({entityType:'Document',entityId:secondDocumentId,reason:'Litigation preservation test requires this document to remain immutable.'})});assert.equal(created.response.status,201);
  const deletion=await request(`/api/clients/${secondClientId}/documents/${secondDocumentId}`,{method:'DELETE',headers:{authorization:`Bearer ${adminToken}`}});assert.equal(deletion.response.status,409);assert.match(deletion.body.error.message,/legal hold/i);
  const released=await request(`/api/management/legal-holds/${created.body.id}/release`,{method:'POST',headers:{authorization:`Bearer ${adminToken}`}});assert.equal(released.body.active,false);
  const features=await request('/api/management/features',{headers:{authorization:`Bearer ${adminToken}`}});assert.equal(features.response.status,200);assert.equal(features.body.legacyPathsRetained,true);assert.equal(features.body.decommissionRequiresParityApproval,true);assert.equal(features.body.flags.PROCUREMENT,true);
  process.env.FEATURE_PROCUREMENT='false';const disabled=await request('/api/vendors',{headers:{authorization:`Bearer ${adminToken}`}});delete process.env.FEATURE_PROCUREMENT;assert.equal(disabled.response.status,503);
});
