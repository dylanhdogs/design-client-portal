# Production Deployment Status

## Current production release

- **Status:** Live and healthy
- **Deployed:** September 23, 2026
- **Public URL:** `https://app.srv1633240.hstgr.cloud`
- **Release image:** `signature-portal:20260923-1107`
- **Runtime:** Node.js 22.23.2 in Docker behind the existing Traefik proxy
- **Active Compose file:** `/docker/webapp/docker-compose.yml`

## September 23 in-app compliance research release

- Added inquiry-scoped public-web compliance research to Reception; findings and source excerpts are shown for representative review and never marked verified automatically.
- Added the `20260923120000_compliance_research_jobs` migration. It creates research-job and source tables without dropping or rewriting existing tables.
- Node.js 22.23.2 release build passed in isolation; all 45 backend tests passed.
- Pre-deployment encrypted backup: `/srv/signature-portal-production/backups/portal-2026-09-23T15-09-31-358Z-23e4fd48.backup.json`.
- Post-deployment encrypted backup: `/srv/signature-portal-production/backups/portal-2026-09-23T15-13-01-108Z-fc3c2100.backup.json`.
- All 30 Prisma migrations applied successfully. Workflow backfill completed for 4 projects, 4 properties, 4 converted inquiries, 20 stages, and 18 gates.
- Container is healthy; public live/readiness endpoints and login return HTTP 200. The served bundle is `assets/index-BPWInbPf.js` and contains the compliance-research UI.
- All 18 existing uploaded files were retained. Previous release `signature-portal:20260922-2001` and Compose definition `/docker/webapp/docker-compose.pre-20260923-1107.yml` remain available for recovery.
- Frontend dependency audit still reports one moderate and one high advisory; the production build also reports a large JavaScript chunk warning.

## September 22 Reception intake release

- Updated the reception workflow with structured phone-call discovery, multiple site-meeting tracking, ROM approval, design-agreement and handoff fields, compliance review, and phase requirements.
- Added the `20260922120000_reception_design_foundation` migration. It adds columns only; it does not drop or rewrite existing tables.
- The production Docker build completed both the frontend and backend TypeScript/Prisma builds. The container started with all 29 migrations applied and passed its health check.
- Public `/api/health/live` and `/api/health/ready` returned `ok` and `ready`; the live page serves `assets/index-Dt88GVsQ.js` and `assets/index-B6h5rdAp.css`.
- All 18 existing upload files were retained. Production readiness reports database integrity, database storage, upload storage, backup, and single-instance checks passing.
- Automated tests were not run for this deployment. Frontend dependency installation reported one high and one moderate advisory in build-tool dependencies (`browserslist` and `baseline-browser-mapping`); both reported available fixes and should be updated in a follow-up dependency change.
- Pre-deployment backup: `/srv/signature-portal-production/backups/portal-2026-09-22T20-01-16-256Z-8741017a.backup.json`
- Post-deployment backup: `/srv/signature-portal-production/backups/portal-2026-09-22T20-07-33-117Z-71de00c8.backup.json`
- Previous release retained: image `signature-portal:20260904-invite-fix`, release `/docker/webapp/releases/20260904-invite-fix`, and Compose definition `/docker/webapp/docker-compose.pre-20260922-2001.yml`.

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

## September 23 ROM preview release (`20260923-1751`)

- Added a ROM proposal preview to the inquiry Handoff section, using the
  inquiry's recorded project narrative, design scope, site notes, community
  references, schedule, and budget context.
- Kept the entered ROM estimate separate from the client's stated budget and
  labeled the preview preliminary and non-contractual. Missing values are
  shown as not entered rather than inferred.
- Frontend and production Docker builds passed. The backend test suite reported
  45 passing tests and one failure because the local development SQLite database
  does not contain the already-deployed `inquiry_compliance_links` migration;
  production was verified at that migration before this frontend-only release.
- No pending production database migrations. Container is healthy; public live
  and readiness endpoints returned `ok` and `ready`; served frontend bundle
  contains the ROM preview control.
- Pre-deployment encrypted backup:
  `/srv/signature-portal-production/backups/portal-2026-09-23T17-55-22-756Z-601f95e4.backup.json`
- Post-deployment encrypted backup:
  `/srv/signature-portal-production/backups/portal-2026-09-23T17-56-24-268Z-969a79e3.backup.json`
- Previous release retained: `signature-portal:20260923-1726` and
  `/docker/webapp/docker-compose.pre-20260923-1751.yml`.

## September 23 editable ROM release (`20260923-1807`)

- Added a Handoff ROM editor with proposal-specific narrative, design/build
  overview, scope, exclusions, deliverables, client responsibilities, target
  milestones, allowances/options, assumptions, deposit terms, and next steps.
- Inquiry answers prefill the editor by default. Proposal overrides are saved
  separately from discovery answers and can be reset to their inquiry source.
- Added the additive `20260923180000_rom_proposal_details` migration. It was
  applied successfully; the new column and migration record were verified.
- Frontend production build, schema validation, TypeScript no-emit check, and
  production Docker build passed. Container healthy; public live and readiness
  endpoints returned `ok` and `ready`; served bundle includes editor, reset,
  and preview controls. Backend tests were not rerun against a fresh local
  migrated test database; the earlier local suite had one unrelated failure
  because its development database predates an existing compliance migration.
- Pre-deployment encrypted backup:
  `/srv/signature-portal-production/backups/portal-2026-09-23T18-08-18-289Z-a40a7c05.backup.json`
- Post-deployment encrypted backup:
  `/srv/signature-portal-production/backups/portal-2026-09-23T18-09-16-761Z-b97b9722.backup.json`
- Previous release retained: `signature-portal:20260923-1751` and
  `/docker/webapp/docker-compose.pre-20260923-1807.yml`.

### ROM proposal authorization follow-up (`20260923-1810`)

- Restricted updates to proposal-specific ROM overrides to internal
  representatives at the API layer.
- Production Docker build passed; container reports healthy; public live and
  readiness endpoints returned `ok` and `ready`. No database migration was
  pending during this follow-up.
- Pre-deployment encrypted backup:
  `/srv/signature-portal-production/backups/portal-2026-09-23T18-10-39-185Z-aba38380.backup.json`
- Post-deployment encrypted backup:
  `/srv/signature-portal-production/backups/portal-2026-09-23T18-11-30-334Z-7c45f54f.backup.json`
- Previous release retained: `signature-portal:20260923-1807` and
  `/docker/webapp/docker-compose.pre-20260923-1810.yml`.

## September 23 inquiry form layout polish (`20260923-1827`)

- Standardized inquiry-modal text inputs, selects, and textareas with consistent
  dimensions, spacing, borders, focus states, and disabled states.
- Aligned form captions and responsive field grids across discovery questions,
  community/compliance details, and the discovery call tracker.
- Frontend and production Docker builds passed. Container is healthy; public
  live and readiness endpoints returned `ok` and `ready`. The deployed frontend
  serves the updated JavaScript and CSS bundles.
- No API or database changes were made.
- Pre-deployment encrypted backup:
  `/srv/signature-portal-production/backups/portal-2026-09-23T18-28-46-839Z-14c31918.backup.json`
- Previous release retained: `signature-portal:20260923-1810` and
  `/docker/webapp/docker-compose.pre-20260923-1827.yml`.
