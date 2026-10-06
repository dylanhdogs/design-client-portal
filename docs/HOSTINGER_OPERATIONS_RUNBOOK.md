# Hostinger VPS Operations Runbook

## Supported Initial Topology

- Ubuntu LTS Hostinger VPS
- Node.js 22 LTS
- isolated `signature-portal@staging` and `signature-portal@production` systemd services
- Nginx terminating HTTPS and proxying production to `127.0.0.1:4000` and staging to `127.0.0.1:4001`
- environment-specific releases under `/opt/signature-portal-{environment}/releases`
- environment-specific current and previous release symlinks under `/opt/signature-portal-{environment}`
- environment-specific database and uploads under `/srv/signature-portal-{environment}`; keep each SQLite database at one Prisma connection (`connection_limit=1`) with a 10-second socket timeout
- separate secrets in `/etc/signature-portal/production.env` and `/etc/signature-portal/staging.env`

Do not run a second application instance against either SQLite database. Never point staging at production storage or secrets. The `systemd` unit reruns production preflight before every service start, including boot recovery, so unsafe runtime, secrets, path permissions, storage capacity, frontend build, or database integrity prevents the process from accepting traffic.

## Initial Provisioning Checklist

1. Create the `portal` system user with no interactive password.
2. Install Node.js 22 LTS, npm, Nginx, Certbot, rsync, curl, Git, and rclone.
3. Enable unattended security updates and time synchronization.
4. Permit inbound SSH, HTTP, and HTTPS only in both Hostinger and operating-system firewalls.
5. Configure SSH keys, run `sudo bash deployment/hostinger/harden-ssh.sh`, keep the original session open, and prove a second key-authenticated login before disconnecting. The script refuses to proceed without a root authorized-key file and disables password-based SSH/root login.
6. Run `provision-ubuntu.sh` with a trusted `ADMIN_SSH_CIDR`; it creates isolated production/staging release and persistent paths with least-privilege ownership.
7. Populate `production.env` and `staging.env` from their examples without committing or displaying secrets.
   Set `PRIVACY_NOTICE_URL` to the approved HTTPS notice and `SUPPORT_EMAIL` to a monitored address; production startup rejects missing or malformed values.
8. Configure rclone for a separately owned backup destination and a protected alert webhook, then install and enable the supplied application services, consistent-backup timer, backup-mirror timer, production-monitor timer, and Nginx configurations.
9. Test the mirror service, verify an encrypted backup from the separate provider/account, and confirm only portal backup objects older than `BACKUP_RETENTION_DAYS` are removed from the configured non-root remote path.
10. Obtain the TLS certificate and verify automatic renewal.
11. Configure staging Basic Authentication and `STAGING_MODE=true`; never use real client data in staging.
12. After each environment is active, create a sanitized inventory with `sudo bash deployment/hostinger/capture-host-inventory.sh <environment> /srv/signature-portal-<environment>/evidence/host-inventory-<date>.json` and retain it with release evidence.
13. Send a synthetic alert with `sudo bash deployment/hostinger/monitor-production.sh test-alert`; confirm the named primary recipient receives and acknowledges it. The monitor also routes unacknowledged application operational-alert counts without exposing alert messages or client data.
14. Complete `DNS_CUTOVER_AND_REVERSAL_WORKSHEET.md` before changing public DNS. Verify Hostinger/registrar renewal, MFA, and account recovery with the primary and backup custodians.

Recommended command sequence after copying a reviewed release to the VPS:

```bash
sudo ADMIN_SSH_CIDR=<trusted-cidr> bash deployment/hostinger/provision-ubuntu.sh
sudo bash deployment/hostinger/harden-ssh.sh
read -rsp 'Staging Basic Auth password: ' STAGING_BASIC_AUTH_PASSWORD && export STAGING_BASIC_AUTH_PASSWORD
sudo --preserve-env=STAGING_BASIC_AUTH_PASSWORD bash deployment/hostinger/configure-nginx-site.sh staging <staging-domain> <certificate-email>
unset STAGING_BASIC_AUTH_PASSWORD
sudo bash deployment/hostinger/configure-nginx-site.sh production <production-domain> <certificate-email>
sudo bash deployment/hostinger/deploy.sh <absolute-source-directory> <release-id> staging
sudo systemctl enable --now signature-portal@staging.service
sudo deployment/hostinger/verify-host.sh staging
```

Do not put passwords directly in retained shell history. Use the operator's approved protected environment/secret-entry method. Configure production only after staging acceptance; after production deployment, enable and test `signature-portal@production.service`, `signature-portal-consistent-backup.timer`, `signature-portal-backup-mirror.timer`, and `signature-portal-monitor.timer`.

## Release Procedure

1. Use a clean checkout of the approved protected Git commit. Record a release identifier and create isolated evidence with `sudo bash deployment/hostinger/verify-release-candidate.sh <absolute-source-directory> /srv/signature-portal-<environment>/evidence/releases/<release-id> <release-id>`. This pins the runtime, uses temporary databases and persistent-style directories, runs migration/seed/tests/builds, production-mode preflight, performance/parity serially, audits production dependencies, hashes each lockfile and a deterministic source snapshot, and never records its generated test secrets. `deploy.sh` refuses to continue unless this immutable evidence matches the release ID, Node version, Git commit, full source hash, and all three source lockfiles.
2. Copy or check out the reviewed source into a temporary source directory.
3. Run `sudo bash deployment/hostinger/deploy.sh <absolute-source-directory> <release-id> staging` or `production`.
4. Confirm `/api/health/live` and `/api/health/ready` over the public HTTPS URL.
5. Complete the production smoke check and record the deployment manifest. For the authenticated acceptance path, use a designated non-client-facing verification client and supply `PORTAL_TEST_EMAIL`, `PORTAL_TEST_PASSWORD`, and `PORTAL_TEST_CLIENT_ID` through the approved protected environment method before running `hosted-smoke-test.sh`. The check signs in with secure cookies, creates and cleans up a sanitized communication, uploads and retrieves a 1×1 PNG, soft-deletes both records according to retention policy, confirms the document is no longer retrievable, and logs out. Never use a real client's record for this check.
6. Confirm a fresh encrypted backup exists and has been copied off the VPS.
7. Complete `SUPPORTED_CLIENT_ACCEPTANCE_MATRIX.md` and the fictional rehearsal in `CLIENT_DATA_REQUEST_RUNBOOK.md` before real-client pilot approval.
8. Index the exact release's decisions, verification, access, DNS, acceptance, recovery, alert, data, and smoke evidence in `LAUNCH_EVIDENCE_INDEX.md`.

Because application deletion is intentionally recoverable, the authenticated smoke check leaves only soft-deleted synthetic database records and the retained upload governed by the configured retention policy. Record the generated `hosted-smoke-*` marker in release evidence and verify those records are excluded from normal views. Do not bypass retention by deleting them directly from the production database.

The deployment script builds before stopping the service, then stops writes, creates an application backup, applies forward migrations, switches the release symlink, starts the service, and waits for readiness.

### Existing Hostinger Docker/Traefik variant

For a Hostinger template already using Traefik, use `deployment/hostinger/Dockerfile.traefik` and `deployment/hostinger/docker-compose.traefik.yml`. Replace the release and host placeholders, set `REVERSE_PROXY_MODE=container-network` with `HOST=0.0.0.0`, retain one backend replica, and never add a backend `ports` mapping. Bind-mount the four persistent directories outside the release, take a write-consistent backup before changing the active image, build the immutable release image before stopping the old container, and retain the prior Compose file/image/data snapshot for rollback. Traefik remains the only public ingress. The same preflight, migration, smoke, backup, restore, and evidence requirements apply.

## Rollback Procedure

Use `sudo bash deployment/hostinger/rollback.sh staging` or `production` only when the previous application release supports that environment's current database schema. The script does not reverse migrations. If schema compatibility is uncertain, stop writes and follow the recovery procedure instead of guessing.

Production uses `BACKUP_SCHEDULER_MODE=external`. The consistent-backup timer runs twice daily in approved low-use windows and briefly stops the application, checkpoints SQLite, captures the database and uploads while writes are paused, restarts the service, and verifies readiness. The off-server mirror follows each backup. Monitoring recognizes the active maintenance lock so this planned pause does not generate a false internal alert; the independent external uptime monitor remains separate. Staging may use the internal scheduler because it contains fictional data only.

## Routine Checks

Daily during pilot:

- public HTTPS availability;
- readiness health;
- open critical operational alerts;
- failed notification deliveries;
- backup freshness;
- backup-mirror timer status and remote-copy freshness;
- production-monitor timer status, plus a separate external HTTPS uptime check that does not run on the VPS;
- disk, CPU, memory, load, and process count;
- certificate expiry monitor.

Monthly after pilot:

- operating-system and dependency update status;
- disk growth and upload capacity;
- user access and Hostinger/repository/DNS privileges;
- SQLite `quick_check` health result;
- backup retention and off-server copy status.

Quarterly:

- restore the latest backup into a separate verification directory;
- verify database record counts and uploaded-file checksums;
- measure recovery time and update the recovery evidence.

Record process, database-path, upload-path, and complete-VPS exercises in `RECOVERY_ACCEPTANCE_CHECKLIST.md`. Use `PRODUCTION_ACCESS_REVIEW.md` for the pre-pilot least-privilege review and `PILOT_OPERATIONS_LOG.md` for the required two-week evidence.

Use `npm --prefix backend run backup:restore -- <backup-file> <new-empty-directory>` for an application-level restore rehearsal. The command refuses a nonempty destination, verifies encrypted-file checksums, and runs SQLite integrity verification before reporting success.

## Incident Priorities

- **Data exposure or suspected credential theft:** disable affected access, rotate secrets, preserve logs, notify the business owner.
- **Database integrity warning:** stop writes, preserve database/WAL files, create a forensic copy, restore separately, and reconcile.
- **Disk warning:** stop nonessential uploads, identify growth, preserve backups, and expand or clean only approved targets.
- **Failed deployment:** retain the failed release and logs; roll back only when schema-compatible.
- **VPS loss:** provision replacement infrastructure, restore the verified off-server backup, update DNS, and test all roles.

Never paste secrets or unredacted client data into support tickets.

The supplied Nginx sites use environment-specific safe access-log formats: query strings are omitted and `/api/invite/<credential>` is recorded only as `/api/invite/[REDACTED]`. Verify this behavior with a fictional expired invitation during hosted acceptance; never place a real credential in retained test evidence.

The login page obtains only the public privacy-notice URL and support address from `/api/public/config`. Do not place internal contacts, secret values, or private operational details in either setting.
