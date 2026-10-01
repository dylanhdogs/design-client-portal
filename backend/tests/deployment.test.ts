import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { validateEnvironment } from '../src/utils/config';
import { sanitizeRequestPath } from '../src/middleware/operations';
import { passwordSchema } from '../src/utils/password';
import { validateUploadType } from '../src/middleware/upload';
import { createEncryptedBackup } from '../src/operations/backup';
import { canViewHealthDetails } from '../src/utils/health';
import { createGracefulShutdown } from '../src/utils/shutdown';

const backendDirectory = path.resolve(__dirname, '..');
const npmCli = process.env.npm_execpath;

const runNpm = (args: string[], env: NodeJS.ProcessEnv, timeout: number) => {
  if (!npmCli) throw new Error('npm_execpath is required for deployment tests.');
  return spawnSync(process.execPath, [npmCli, ...args], {
    cwd: backendDirectory,
    env,
    encoding: 'utf8',
    timeout,
  });
};

test('production deploy stays empty until the one-time administrator bootstrap runs', async () => {
  const directory = fs.mkdtempSync(path.join(backendDirectory, 'prisma', '.test-deploy-'));
  const relativeDirectory = path.basename(directory);
  fs.writeFileSync(path.join(directory, 'production.db'), '');
  const databaseUrl = `file:./${relativeDirectory}/production.db?connection_limit=1&socket_timeout=10`;
  const env = { ...process.env, DATABASE_URL: databaseUrl };
  let isolated: PrismaClient | undefined;

  try {
    const deploy = runNpm(['run', 'db:deploy'], env, 120_000);
    assert.equal(deploy.status, 0, `${deploy.error || ''}\n${deploy.stdout}\n${deploy.stderr}`);

    isolated = new PrismaClient({ datasourceUrl: databaseUrl });
    assert.equal(await isolated.user.count(), 0, 'Production deploy must not create demo users.');

    const demoSeed = runNpm(['run', 'db:seed'], { ...env, NODE_ENV: 'production' }, 60_000);
    assert.notEqual(demoSeed.status, 0, 'The fixed-credential demo seed must refuse to run in production.');
    assert.match(`${demoSeed.stdout}\n${demoSeed.stderr}`, /demo seed is disabled in production/i);
    assert.equal(await isolated.user.count(), 0, 'A blocked production demo seed must leave the database empty.');

    const bootstrapEnv = {
      ...env,
      BOOTSTRAP_ADMIN_EMAIL: 'owner@signature.test',
      BOOTSTRAP_ADMIN_NAME: 'Portal Owner',
      BOOTSTRAP_ADMIN_PASSWORD: 'Correct-Horse-42!',
    };
    const bootstrap = runNpm(['run', 'admin:bootstrap'], bootstrapEnv, 60_000);
    assert.equal(bootstrap.status, 0, `${bootstrap.stdout}\n${bootstrap.stderr}`);
    assert.equal(await isolated.user.count({ where: { role: 'ADMIN' } }), 1);
    const onlyAdministrator = await isolated.user.findFirstOrThrow({ where: { role: 'ADMIN', active: true } });
    await assert.rejects(
      () => isolated!.user.update({ where: { id: onlyAdministrator.id }, data: { active: false } }),
      'The database must reject removal of the last active administrator even outside the route layer.',
    );
    await assert.rejects(() => isolated!.user.update({ where: { id: onlyAdministrator.id }, data: { role: 'STAFF' } }));
    await assert.rejects(() => isolated!.user.delete({ where: { id: onlyAdministrator.id } }));
    assert.equal((await isolated.user.findUniqueOrThrow({ where: { id: onlyAdministrator.id } })).active, true);

    const repeated = runNpm(['run', 'admin:bootstrap'], { ...bootstrapEnv, BOOTSTRAP_ADMIN_PASSWORD: 'Different-Password-43!' }, 60_000);
    assert.notEqual(repeated.status, 0, 'Bootstrap must refuse to overwrite an existing administrator.');
    assert.equal(await isolated.user.count({ where: { role: 'ADMIN' } }), 1);

    await isolated.$queryRawUnsafe('PRAGMA busy_timeout = 10000');
    await isolated.$queryRawUnsafe('PRAGMA journal_mode = WAL');
    await Promise.all(Array.from({ length: 24 }, (_, index) => isolated.client.create({
      data: { name: `Concurrent Client ${index}`, email: `concurrent-${index}@signature.test` },
    })));
    assert.equal(await isolated.client.count(), 24, 'Concurrent SQLite writes must complete without lock errors or lost records.');
    const integrity = await isolated.$queryRawUnsafe<Array<{ integrity_check: string }>>('PRAGMA integrity_check');
    assert.equal(integrity[0]?.integrity_check, 'ok');

    const manifestDirectory = path.join(directory, 'manifests');
    const manifestResult = runNpm(['run', 'manifest:create'], {
      ...env,
      RELEASE_ID: 'test-release-001',
      MANIFEST_DIR: manifestDirectory,
      JWT_SECRET: 'manifest-test-secret-that-must-not-be-recorded',
    }, 60_000);
    assert.equal(manifestResult.status, 0, `${manifestResult.stdout}\n${manifestResult.stderr}`);
    const manifestText = fs.readFileSync(path.join(manifestDirectory, 'test-release-001.json'), 'utf8');
    const manifest = JSON.parse(manifestText);
    assert.equal(manifest.releaseId, 'test-release-001');
    assert.ok(manifest.migrations.length > 0);
    assert.ok(manifest.configuredNames.includes('JWT_SECRET'));
    assert.equal(manifestText.includes('manifest-test-secret-that-must-not-be-recorded'), false);

    const inventoryPath = path.join(directory, 'source-inventory.json');
    const inventory = runNpm(['run', 'inventory:create', '--', inventoryPath], {
      ...env,
      UPLOAD_DIR: path.join(directory, 'uploads'),
      MIGRATION_INVENTORY_ACK: 'writes-frozen',
    }, 60_000);
    assert.equal(inventory.status, 0, `${inventory.stdout}\n${inventory.stderr}`);
    const inventoryData = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
    assert.equal(inventoryData.database.tableCounts.clients, 24);
    assert.match(inventoryData.database.sha256, /^[a-f0-9]{64}$/);

    const destinationInventoryPath = path.join(directory, 'destination-inventory.json');
    fs.copyFileSync(inventoryPath, destinationInventoryPath);
    const comparisonPath = path.join(directory, 'inventory-comparison.json');
    const comparison = runNpm(['run', 'inventory:compare', '--', inventoryPath, destinationInventoryPath, comparisonPath], {
      ...env,
      MIGRATION_RECONCILIATION_ACK: 'source-and-destination-writes-frozen',
    }, 60_000);
    assert.equal(comparison.status, 0, `${comparison.stdout}\n${comparison.stderr}`);
    assert.equal(JSON.parse(fs.readFileSync(comparisonPath, 'utf8')).passed, true);

    const mismatchedInventoryPath = path.join(directory, 'mismatched-inventory.json');
    inventoryData.database.tableCounts.clients += 1;
    fs.writeFileSync(mismatchedInventoryPath, JSON.stringify(inventoryData));
    const mismatch = runNpm(['run', 'inventory:compare', '--', inventoryPath, mismatchedInventoryPath, path.join(directory, 'mismatch-comparison.json')], {
      ...env,
      MIGRATION_RECONCILIATION_ACK: 'source-and-destination-writes-frozen',
    }, 60_000);
    assert.notEqual(mismatch.status, 0, 'Inventory comparison must fail when record counts differ.');

    await isolated.$queryRawUnsafe('PRAGMA wal_checkpoint(FULL)');
    const backupSecret = 'deployment-restore-test-key-that-is-long-enough';
    const backup = await createEncryptedBackup({
      databasePath: path.join(directory, 'production.db'),
      uploadDirectory: path.join(directory, 'uploads'),
      outputDirectory: path.join(directory, 'backups'),
      secret: backupSecret,
    });
    const restoreDirectory = path.join(directory, 'restore-verification');
    const restore = runNpm(['run', 'backup:restore', '--', backup.backupPath, restoreDirectory], {
      ...env,
      BACKUP_ENCRYPTION_KEY: backupSecret,
    }, 60_000);
    assert.equal(restore.status, 0, `${restore.stdout}\n${restore.stderr}`);
    assert.match(restore.stdout, /"verified":true/);
  } finally {
    await isolated?.$disconnect();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('production configuration rejects placeholders and non-persistent paths', () => {
  const original = { ...process.env };
  try {
    process.env.NODE_ENV = 'production';
    process.env.HOST = '127.0.0.1';
    process.env.APP_INSTANCE_COUNT = '1';
    process.env.TRUST_PROXY_HOPS = '1';
    process.env.REQUIRED_NODE_VERSION = '22.23.2';
    process.env.JWT_SECRET = 'replace-with-a-random-secret-of-at-least-32-characters';
    process.env.HEALTH_CHECK_TOKEN = 'test-health-token-that-is-long-and-unique-123';
    process.env.PRIVACY_NOTICE_URL = 'https://signature.test/privacy';
    process.env.SUPPORT_EMAIL = 'support@signature.test';
    process.env.FRONTEND_URL = 'https://portal.signature.test';
    process.env.CORS_ORIGINS = 'https://portal.signature.test';
    process.env.DATABASE_URL = process.platform === 'win32' ? 'file:C:/portal/data/production.db' : 'file:/srv/portal/data/production.db';
    process.env.UPLOAD_DIR = process.platform === 'win32' ? 'C:/portal/data/uploads' : '/srv/portal/data/uploads';
    process.env.BACKUP_DIR = process.platform === 'win32' ? 'C:/portal/data/backups' : '/srv/portal/data/backups';
    process.env.MANIFEST_DIR = process.platform === 'win32' ? 'C:/portal/data/manifests' : '/srv/portal/data/manifests';
    process.env.BACKUP_ENABLED = 'true';
    process.env.BACKUP_ENCRYPTION_KEY = 'test-backup-secret-that-is-long-and-unique-123';
    assert.throws(() => validateEnvironment(), /JWT_SECRET/);

    process.env.JWT_SECRET = 'test-production-secret-that-is-long-and-unique-123';
    process.env.UPLOAD_DIR = 'uploads';
    assert.throws(() => validateEnvironment(), /UPLOAD_DIR/);

    process.env.UPLOAD_DIR = process.platform === 'win32' ? 'C:/portal/data/uploads' : '/srv/portal/data/uploads';
    process.env.PRIVACY_NOTICE_URL = 'https://user:password@signature.test/privacy';
    assert.throws(() => validateEnvironment(), /PRIVACY_NOTICE_URL/);

    process.env.PRIVACY_NOTICE_URL = 'https://signature.test/privacy';
    process.env.SUPPORT_EMAIL = '';
    assert.throws(() => validateEnvironment(), /SUPPORT_EMAIL/);

    process.env.SUPPORT_EMAIL = 'support@signature.test';
    process.env.HOST = '0.0.0.0';
    assert.throws(() => validateEnvironment(), /HOST/);

    process.env.REVERSE_PROXY_MODE = 'container-network';
    const containerConfig = validateEnvironment();
    assert.equal(containerConfig.host, '0.0.0.0');
    assert.equal(containerConfig.reverseProxyMode, 'container-network');

    process.env.REVERSE_PROXY_MODE = 'loopback';

    process.env.HOST = '127.0.0.1';
    process.env.FRONTEND_URL = 'https://portal.signature.test/path';
    assert.throws(() => validateEnvironment(), /FRONTEND_URL/);

    process.env.FRONTEND_URL = 'https://portal.signature.test';
    process.env.JWT_EXPIRES_IN = 'forever';
    assert.throws(() => validateEnvironment(), /JWT_EXPIRES_IN/);

    process.env.JWT_EXPIRES_IN = '8h';
    process.env.EXTERNAL_NOTIFICATION_MODE = 'pretend-email';
    assert.throws(() => validateEnvironment(), /EXTERNAL_NOTIFICATION_MODE/);

    process.env.EXTERNAL_NOTIFICATION_MODE = 'disabled';
    process.env.BACKUP_ENABLED = 'false';
    assert.throws(() => validateEnvironment(), /BACKUP_ENABLED/);

    process.env.BACKUP_ENABLED = 'true';
    process.env.DOCUMENT_RETENTION_DAYS = 'not-a-number';
    assert.throws(() => validateEnvironment(), /DOCUMENT_RETENTION_DAYS/);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
  }
});

test('credential-bearing paths are redacted before logging', () => {
  const secret = 'a'.repeat(64);
  const sanitized = sanitizeRequestPath(`/api/invite/${secret}/accept`);
  assert.equal(sanitized, '/api/invite/[REDACTED]/accept');
  assert.equal(sanitized.includes(secret), false);
  const querySanitized = sanitizeRequestPath(`/accept-invite?token=${secret}&email=private@example.com`);
  assert.equal(querySanitized, '/accept-invite?[REDACTED]');
  assert.equal(querySanitized.includes(secret), false);
  assert.equal(querySanitized.includes('private@example.com'), false);
});

test('production health details distinguish the proxied client IP from the local Nginx peer', () => {
  const token = 'health-detail-token-that-is-long-and-random-123';
  assert.equal(canViewHealthDetails({ production: false, requestIp: '203.0.113.10', expectedToken: '', suppliedToken: '' }), true);
  assert.equal(canViewHealthDetails({ production: true, requestIp: '127.0.0.1', expectedToken: token, suppliedToken: '' }), true);
  assert.equal(canViewHealthDetails({ production: true, requestIp: '203.0.113.10', expectedToken: token, suppliedToken: '' }), false);
  assert.equal(canViewHealthDetails({ production: true, requestIp: '203.0.113.10', expectedToken: token, suppliedToken: 'wrong-token' }), false);
  assert.equal(canViewHealthDetails({ production: true, requestIp: '203.0.113.10', expectedToken: token, suppliedToken: token }), true);
});

test('graceful shutdown stops once, disconnects the database, and preserves failure status', async () => {
  let closeCallback: ((error?: Error) => void) | undefined;
  let closeCalls = 0;
  let disconnectCalls = 0;
  let forcedExit: (() => void) | undefined;
  let timerUnrefCalls = 0;
  const exitCodes: number[] = [];
  const logs: string[] = [];
  const shutdown = createGracefulShutdown({
    closeServer: (callback) => { closeCalls += 1; closeCallback = callback; },
    disconnectDatabase: async () => { disconnectCalls += 1; },
    exitProcess: (code) => { exitCodes.push(code); },
    scheduleForcedExit: (callback, timeoutMs) => {
      assert.equal(timeoutMs, 10_000);
      forcedExit = callback;
      return { unref: () => { timerUnrefCalls += 1; } };
    },
    log: (entry) => logs.push(entry),
  });

  shutdown('SIGTERM');
  shutdown('SIGINT');
  assert.equal(closeCalls, 1);
  assert.equal(timerUnrefCalls, 1);
  assert.match(logs[0], /SIGTERM/);
  closeCallback!(new Error('close failed'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(disconnectCalls, 1);
  assert.deepEqual(exitCodes, [1]);
  forcedExit!();
  assert.deepEqual(exitCodes, [1, 1]);
});

test('new password policy requires length and character diversity', () => {
  assert.equal(passwordSchema.safeParse('short').success, false);
  assert.equal(passwordSchema.safeParse('alllowercasebutlong').success, false);
  assert.equal(passwordSchema.safeParse('Strong-Password-42!').success, true);
});

test('production upload policy blocks unscanned complex documents', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalOverride = process.env.ALLOW_UNSCANNED_COMPLEX_UPLOADS;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_UNSCANNED_COMPLEX_UPLOADS;
    assert.throws(
      () => validateUploadType('untrusted.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
      /requires malware scanning/,
    );
    assert.doesNotThrow(() => validateUploadType('drawing.pdf', 'application/pdf'));
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalNodeEnv;
    if (originalOverride === undefined) delete process.env.ALLOW_UNSCANNED_COMPLEX_UPLOADS;
    else process.env.ALLOW_UNSCANNED_COMPLEX_UPLOADS = originalOverride;
  }
});
