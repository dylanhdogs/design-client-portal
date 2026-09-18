# Production Deployment Status

## Current production release

- **Status:** Live and healthy
- **Deployed:** September 4, 2026
- **Public URL:** `https://app.srv1633240.hstgr.cloud`
- **Release image:** `signature-portal:20260904-invite-fix`
- **Runtime:** Node.js 22.23.2 in Docker behind the existing Traefik proxy
- **Active Compose file:** `/docker/webapp/docker-compose.yml`

## Verified during deployment

- Production preflight passed.
- All 24 Prisma migrations were applied successfully, including
  `20260904140002_preconstruction_evidence`.
- Existing production data and all 18 uploaded files were preserved.
- Workflow backfill verified 3 projects, 3 properties, 3 converted inquiries,
  15 lifecycle stages, and 13 project gates.
- Container health check reports `healthy`.
- Internal readiness endpoint returned HTTP 200.
- Public login and readiness endpoints returned HTTP 200.
- Unauthenticated `/api/auth/me` correctly returned HTTP 401.
- The production login page loaded without browser console errors.
- Automated encrypted backup creation was confirmed.
- The updated production frontend asset is `assets/index-Csr0PGM-.js`.

## Recovery points retained on the VPS

- Final pre-cutover snapshot: `/docker/webapp/backups/final-cutover-20260903-2139`
- Earlier pre-update snapshot: `/docker/webapp/backups/pre-update-20260903`
- Previous Compose definition: `/docker/webapp/docker-compose.pre-20260903.yml`
- Immediate pre-update Compose definition: `/docker/webapp/docker-compose.pre-20260904.yml`
- Pre-update encrypted backup:
  `/srv/signature-portal-production/backups/portal-2026-09-04T15-19-31-487Z-667d3a46.backup.json`
- Post-migration encrypted backup:
  `/srv/signature-portal-production/backups/portal-2026-09-04T15-21-00-210Z-efdb7726.backup.json`
- Previous release image `signature-portal:20260903` and source release
  `/docker/webapp/releases/20260903` remain available for rollback.
- Immediate previous release image `signature-portal:20260904-bugfix`, source
  release `/docker/webapp/releases/20260904-bugfix`, and Compose definition
  `/docker/webapp/docker-compose.pre-20260904-invite-fix.yml` remain available
  for rollback.
- Previous application source remains under `/docker/webapp/app` for rollback.

## September 4 invitation-fix release

- Fixed the Invite Client dialog so long invitation links wrap inside the
  window and the dialog remains usable on small screens.
- Added a dedicated Copy Link control with visible success and failure states.
- Matched client-side password checks to the account-creation requirements.
- Improved account-creation errors so the user sees the specific invalid field
  instead of only `Request validation failed`.
- Trimmed client names and added clear name-length validation on the server.
- Frontend and backend builds passed; all 34 backend tests passed before
  deployment.
- Public live and readiness checks passed after cutover, and the production
  container reported `healthy`.
- Pre-deployment encrypted backup:
  `/srv/signature-portal-production/backups/portal-2026-09-04T16-46-15-820Z-c24142d2.backup.json`
- Post-deployment encrypted backup:
  `/srv/signature-portal-production/backups/portal-2026-09-04T16-48-11-223Z-f1291cb2.backup.json`

## September 4 bug-fix release

- Added mandatory pre-construction evidence and assignment checks.
- Made empty compliance and procurement gates fail closed.
- Synchronized legacy and client-visible phase status.
- Enforced separation of duties for approvals.
- Added inline purchase-order creation and normalized date-time handling.
- Temporary deployment access was removed after verification.

## Follow-up security action

The `admin@example.com` password was rotated during deployment. The legacy demo
accounts `staff@example.com` and `client@example.com` remain active pending
explicit approval to deactivate their access. Their associated historical client
and project records can be retained when the logins are disabled.
