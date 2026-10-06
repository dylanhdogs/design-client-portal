import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const projectRoot = path.resolve(__dirname, '..', '..');
const read = (relativePath: string) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('Hostinger package isolates staging and production', () => {
  const ciWorkflow = read('.github/workflows/ci.yml');
  const service = read('deployment/hostinger/signature-portal@.service');
  const deploy = read('deployment/hostinger/deploy.sh');
  const rollback = read('deployment/hostinger/rollback.sh');
  const productionEnv = read('deployment/hostinger/portal.env.example');
  const stagingEnv = read('deployment/hostinger/staging.env.example');
  const productionNginx = read('deployment/hostinger/nginx-production.conf');
  const stagingNginx = read('deployment/hostinger/nginx-staging.conf');
  const provisioning = read('deployment/hostinger/provision-ubuntu.sh');
  const hostVerification = read('deployment/hostinger/verify-host.sh');
  const fail2ban = read('deployment/hostinger/fail2ban-sshd.local');

  assert.match(service, /signature-portal-%i\/current/);
  assert.match(service, /\/etc\/signature-portal\/%i\.env/);
  assert.match(service, /\/srv\/signature-portal-%i/);
  assert.match(service, /ExecStartPre=\/usr\/local\/bin\/npm run preflight/);
  assert.match(deploy, /production\|staging/);
  assert.match(deploy, /outside the release root/);
  assert.match(deploy, /release-verification\.json/);
  assert.match(deploy, /lockfiles\.backend/);
  assert.match(deploy, /sourceSha256/);
  assert.match(deploy, /clean protected Git checkout/);
  assert.match(rollback, /flock -n/);
  assert.match(rollback, /original application links were restored/);
  const releaseVerifier = read('deployment/hostinger/verify-release-candidate.sh');
  assert.match(releaseVerifier, /exec -- prisma migrate deploy --schema "\$SOURCE_DIRECTORY\/backend\/prisma\/schema\.prisma"/);
  assert.match(releaseVerifier, /run_check shell-syntax bash -c/);
  assert.match(releaseVerifier, /run_check prisma-generate npm --prefix "\$SOURCE_DIRECTORY\/backend" exec -- prisma generate --schema "\$SOURCE_DIRECTORY\/backend\/prisma\/schema\.prisma"/);
  assert.match(releaseVerifier, /run_check workflow-backfill npm --prefix "\$SOURCE_DIRECTORY\/backend" run db:backfill/);
  assert.match(releaseVerifier, /const checks = \[[\s\S]*'shell-syntax', 'root-install'[\s\S]*'fresh-migration', 'prisma-generate', 'demo-seed', 'workflow-backfill'/);
  assert.match(releaseVerifier, /node - "\$EVIDENCE_DIRECTORY\/release-verification\.json"/);
  assert.equal(releaseVerifier.includes('jq -n'), false);
  assert.match(releaseVerifier, /run_check production-preflight/);
  assert.match(releaseVerifier, /NODE_ENV=production/);
  assert.match(releaseVerifier, /release-verification\.invalid/);
  assert.match(releaseVerifier, /const checks = \[[\s\S]*'production-preflight'/);
  assert.match(ciWorkflow, /run: npm run db:seed[\s\S]*run: npm run db:backfill[\s\S]*run: npm run verify:parity/);
  assert.match(productionEnv, /PORT=4000/);
  assert.match(productionEnv, /HOST=127\.0\.0\.1/);
  assert.match(productionEnv, /signature-portal-production/);
  assert.match(productionEnv, /BACKUP_SCHEDULER_MODE=external/);
  assert.match(stagingEnv, /PORT=4001/);
  assert.match(stagingEnv, /HOST=127\.0\.0\.1/);
  assert.match(stagingEnv, /STAGING_MODE=true/);
  assert.match(stagingEnv, /signature-portal-staging/);
  assert.match(stagingEnv, /BACKUP_SCHEDULER_MODE=internal/);
  assert.match(productionNginx, /127\.0\.0\.1:4000/);
  assert.match(stagingNginx, /127\.0\.0\.1:4001/);
  assert.match(productionNginx, /ssl_protocols TLSv1\.2 TLSv1\.3/);
  assert.match(stagingNginx, /ssl_protocols TLSv1\.2 TLSv1\.3/);
  assert.match(productionNginx, /\$portal_production_safe_uri/);
  assert.match(stagingNginx, /\$portal_staging_safe_uri/);
  assert.match(productionNginx, /\/api\/invite\/\[REDACTED\]/);
  assert.match(stagingNginx, /\/api\/invite\/\[REDACTED\]/);
  assert.match(productionNginx, /\/var\/log\/signature-portal\/production-access\.log/);
  assert.match(stagingNginx, /\/var\/log\/signature-portal\/staging-access\.log/);
  assert.equal(productionNginx.includes('$request_uri'), false);
  assert.equal(stagingNginx.includes('$request_uri'), false);
  assert.match(provisioning, /fail2ban-sshd\.local/);
  assert.match(hostVerification, /fail2ban-client status sshd/);
  assert.match(fail2ban, /enabled = true/);
  assert.equal(productionEnv.includes('signature-portal-staging'), false);
  assert.equal(stagingEnv.includes('signature-portal-production'), false);
});

test('Hostinger package contains every executable operational control', () => {
  for (const document of [
    'docs/RECOVERY_ACCEPTANCE_CHECKLIST.md',
    'docs/PRODUCTION_ACCESS_REVIEW.md',
    'docs/PILOT_OPERATIONS_LOG.md',
    'docs/DNS_CUTOVER_AND_REVERSAL_WORKSHEET.md',
    'docs/SUPPORTED_CLIENT_ACCEPTANCE_MATRIX.md',
    'docs/LAUNCH_EVIDENCE_INDEX.md',
    'docs/CLIENT_DATA_REQUEST_RUNBOOK.md',
  ]) assert.ok(read(document).length > 500, `${document} must contain an actionable operator template.`);

  for (const artifact of [
    'provision-ubuntu.sh', 'harden-ssh.sh', 'capture-host-inventory.sh', 'verify-release-candidate.sh', 'configure-nginx-site.sh', 'deploy.sh', 'rollback.sh',
    'verify-host.sh', 'hosted-smoke-test.sh', 'consistent-backup.sh', 'mirror-backups.sh', 'monitor-production.sh',
  ]) {
    const contents = read(`deployment/hostinger/${artifact}`);
    assert.match(contents, /^#!\/usr\/bin\/env bash/);
    assert.match(contents, /set -Eeuo pipefail/);
  }

  const consistentBackup = read('deployment/hostinger/consistent-backup.sh');
  assert.match(consistentBackup, /signature-portal-production-deploy\.lock/);
  assert.match(consistentBackup, /systemctl stop/);
  assert.match(consistentBackup, /backup:create/);
  assert.match(consistentBackup, /api\/health\/ready/);

  const hostedSmoke = read('deployment/hostinger/hosted-smoke-test.sh');
  assert.match(hostedSmoke, /PORTAL_TEST_CLIENT_ID/);
  assert.match(hostedSmoke, /\/communications/);
  assert.match(hostedSmoke, /\/documents/);
  assert.match(hostedSmoke, /--form/);
  assert.match(hostedSmoke, /--request DELETE/);
  assert.match(hostedSmoke, /cmp /);
  assert.equal(hostedSmoke.includes('--arg password'), false);

  const monitor = read('deployment/hostinger/monitor-production.sh');
  assert.match(monitor, /webhook_config/);
  assert.match(monitor, /unset ALERT_WEBHOOK_URL/);
  assert.match(monitor, /duplicate webhook suppressed/);
  assert.match(monitor, /ALERT_REPEAT_MINUTES/);
  assert.match(monitor, /CPU_LOAD_PER_CORE_LIMIT must be a positive number/);
  assert.match(monitor, /MEMORY_USED_PERCENT_LIMIT must be an integer from 1 to 100/);
  assert.match(monitor, /CERTIFICATE_MIN_DAYS must be an integer from 1 to 365/);
  assert.match(monitor, /UPLOAD_DIR and BACKUP_DIR must be absolute paths/);
  assert.equal(monitor.includes('"$ALERT_WEBHOOK_URL" >/dev/null'), false);

  const mirror = read('deployment/hostinger/mirror-backups.sh');
  assert.match(mirror, /BACKUP_RETENTION_DAYS/);
  assert.match(mirror, /rclone.*delete/s);
  assert.match(mirror, /--min-age/);
  assert.match(mirror, /non-root, traversal-free rclone path/);
});
