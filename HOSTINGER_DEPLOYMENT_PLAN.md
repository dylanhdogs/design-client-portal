# Hostinger Deployment and Functional Launch Plan

## Document Status

- **Status:** Phase 1 application hardening complete; owner decisions and Hostinger provisioning remain open
- **Implementation authorized:** Local application and deployment-package work completed; infrastructure purchase, DNS changes, and production launch still require owner approval/access
- **Recommended hosting path:** Hostinger VPS
- **First deployment:** Private staging with demonstration data only
- **Production launch:** Only after every required gate in this document passes

### Review score

- **Plan quality: 10/10.** Scope, dependencies, owners, acceptance evidence, security, recovery, rollback, capacity, data handling, hosted validation, pilot controls, and stop/go gates are all explicit.
- **Current execution readiness: 8/10.** Phase 1 is proven locally and is ready for private staging; the remaining two points require owner decisions, live Hostinger controls, off-server recovery evidence, hosted acceptance, and operating history. A document cannot substitute for those proofs.

## Objective

Prepare, deploy, and prove the Construction Client Portal on Hostinger without sacrificing client privacy, project records, uploaded documents, or recoverability.

The immediate objective is not a perfect application. It is a dependable application that a small team can use to manage 3–5 real projects without developer intervention for routine work.

## Definition of Done

This plan is complete when:

- production startup cannot create predictable demonstration accounts;
- application code can be deployed repeatedly without deleting the database or uploaded files;
- the site runs over HTTPS on the intended domain;
- ADMIN, STAFF, and CLIENT permissions work in the hosted environment;
- one project completes the Inquiry → Design → Compliance → Pre-Construction → Procurement path;
- encrypted off-server backups run automatically and a restore has been proven;
- errors and failed backups reach a named responsible person;
- a two-week pilot with 3–5 projects passes the launch criteria;
- operating and rollback instructions can be followed without editing the database manually.

## Pre-Implementation Audit Outcome

The plan is structurally ready after the additions below. The audit found no reason to abandon the Hostinger VPS approach, but it identified launch risks that must be explicit work rather than assumptions:

- production startup seeded predictable demonstration accounts at the start of the audit;
- bearer tokens were stored in browser local storage at the start of the audit;
- invitation tokens appeared inside unsanitized request paths at the start of the audit;
- the continuous-integration workflow used Node.js 20 at the start of the audit;
- SQLite and local uploads require persistent paths, one application instance, lock testing, disk monitoring, and verified off-server backup;
- password reset reported that email was sent even though a production delivery provider was not connected;
- password policy permitted six-character passwords;
- the source and disposition of any existing local records have not been decided;
- malware scanning, privacy notice, incident contact, and staging search-engine protection were not previously assigned to release gates.

These are now included as tasks, acceptance checks, or documented risk decisions. No real client data should be hosted until the applicable gates pass.

## Decisions Required Before Hosted Implementation

| Decision | Recommended default | Decision owner | Blocks |
|---|---|---|---|
| VPS operating system | Supported Ubuntu LTS without an unnecessary control panel | Technical owner | Phase 2 |
| Node.js runtime | Node.js 22 LTS, matched in CI and Hostinger; Prisma 6 does not support Node.js 24 | Technical owner | Phase 1 completion |
| Process supervision | `systemd` service with automatic restart and least-privilege account | Technical owner | Phase 2 |
| Reverse proxy | Nginx or the selected Hostinger template's supported proxy; document one choice | Technical owner | Phase 2 |
| Production data source | Clean production database unless specific local records are reviewed and approved for migration | Business owner | Phase 6 |
| Browser session strategy | HttpOnly, Secure, SameSite cookie with CSRF protection before real-client pilot | Business and technical owners | Phase 6 |
| Administrator protection | MFA preferred; otherwise a time-limited pilot exception with strong unique credentials and login-alert review | Business owner | Phase 7 |
| Upload malware control | Scan or quarantine untrusted Office/ZIP uploads before normal use; document a pilot restriction if deferred | Business and technical owners | Phase 7 |
| Notification mode | Verified email provider or clearly labeled in-app-only behavior | Business owner | Phase 5 |
| Off-server backup destination | Provider/account separate from the VPS and accessible to two authorized owners | Technical owner | Phase 5 |
| Staging exposure | Authentication/IP restriction plus `noindex`; fictional data only | Business and technical owners | Phase 3 |
| Recovery objectives | Pilot target: 24-hour maximum data loss (RPO) and 4-hour service restoration (RTO), tightened after measured restore tests | Business and technical owners | Phase 5 |
| Pilot capacity | Maximum 5 active projects, 10 simultaneous users, and an approved upload-storage allowance; expand only after measured review | Business owner | Phase 7 |
| Data location and legal requirements | Select a server region and retention/privacy terms approved for the client population and contract obligations | Business owner | Phase 2 |
| Provider-account continuity | Hostinger, registrar/DNS, repository, backup, and email accounts use MFA, two named recovery custodians, tested recovery methods, and monitored renewal/billing contacts | Business and technical owners | Phase 2 |
| DNS cutover and reversal | Preserve the existing DNS zone, identify the authoritative DNS provider, lower TTL before launch when practical, and record the exact rollback target and decision owner | Technical owner | Phase 6 |
| Supported client baseline | Current Chrome, Edge, Firefox, and Safari on supported desktop/mobile operating systems; record any narrower pilot baseline explicitly | Business and application owners | Phase 4 |
| Evidence and privacy-request handling | Retain release, access, acceptance, incident, backup, and recovery evidence for the approved period; name the owner and procedure for access/export/correction/deletion requests | Business owner | Phase 6 |

Record these decisions and named owners in [the Hostinger decision register](docs/HOSTINGER_DECISION_REGISTER.md). A recommended default is not an approval.

## Planning Estimate

These are planning ranges, not delivery guarantees. They assume timely access to Hostinger, DNS, source control, and the selected email/backup providers.

| Work | Estimated effort |
|---|---:|
| Phase 0 decisions | 1–2 working days |
| Phase 1 application hardening | 3–5 working days |
| Phase 2 VPS provisioning | 1–2 working days |
| Phase 3 staging deployment | 1–2 working days |
| Phase 4 hosted acceptance and fixes | 2–4 working days |
| Phase 5 recovery, alerts, and communication | 1–3 working days |
| Phase 6 production preparation | 1–2 working days |
| Phase 7 controlled pilot | 10 business days |

The likely critical path is application hardening → staging persistence test → hosted role acceptance → restore rehearsal → controlled pilot.

## Recommended Hosting Architecture

```text
Users
  ↓ HTTPS
Hostinger firewall and reverse proxy
  ├── production domain → Node/Express :4000
  │     ├── production React/API
  │     ├── production SQLite/uploads
  │     └── encrypted backup → independent provider
  └── protected staging domain → Node/Express :4001
        ├── staging React/API
        └── isolated fictional SQLite/uploads
```

### Initial technical choice

Use one Hostinger VPS for the initial pilot, with isolated `staging` and `production` services. Each environment runs exactly one application process against its own SQLite database, upload directory, backup directory, secrets file, release path, and port. Staging uses port 4001 and fictional data; production uses port 4000. Keep both environments' persistent data outside their replaceable source releases. Staging must never share or copy production secrets or client data.

An existing Hostinger Docker/Traefik installation may use the validated `REVERSE_PROXY_MODE=container-network` variant. In that mode the application binds inside a private Docker network, the backend port must not be published directly on the host, Traefik remains the only public ingress, and persistent database/upload/backup/manifest directories must be bind-mounted outside the replaceable application source. The default systemd/Nginx package continues to use `REVERSE_PROXY_MODE=loopback`.

This is appropriate for a small pilot. “One instance” applies per SQLite database; the two services do not share a database. Migration to PostgreSQL and object storage should be reconsidered before horizontal scaling, multiple processes against one environment, or substantially higher usage.

## Roles

| Role | Responsibility |
|---|---|
| Business owner | Approves workflow behavior, pilot users, and launch decision |
| Application owner | Manages users, reviews operational alerts, and coordinates issues |
| Technical owner | Deploys releases, protects secrets, verifies backups, and performs recovery |
| Pilot staff | Complete real workflows and record defects or unclear steps |

One person may hold multiple roles, but every role must have a named owner before production use.

## Delivery Phases

## Phase 0 — Confirm Hosting and Ownership

**Goal:** Ratify the implemented pilot defaults and make the owner/provider decisions required before purchasing or configuring hosted infrastructure.

| ID | Task | Owner | Depends on | Evidence |
|---|---|---|---|---|
| H0.1 | Confirm Hostinger VPS as the initial hosting model | Business owner | None | Written approval |
| H0.2 | Select the VPS plan, server region, and operating system/template | Technical owner | H0.1 | Plan and region recorded |
| H0.3 | Choose the production domain and a separate staging subdomain | Business owner | H0.1 | DNS names recorded |
| H0.4 | Create or confirm a private source repository and protected deployment branch | Technical owner | None | Repository access verified |
| H0.5 | Name the business, application, and technical owners | Business owner | None | Ownership table completed |
| H0.6 | Decide whether pilot notifications are in-app only or include email | Business owner | None | Notification decision recorded |
| H0.7 | Decide where encrypted off-server backups will be retained | Technical owner | H0.1 | Destination and retention recorded |
| H0.8 | Decide whether production starts clean or receives reviewed local records | Business owner | None | Data disposition decision recorded |
| H0.9 | Approve the minimum privacy notice, retention owner, and incident contact for client data | Business owner | None | Named owner and approved text/source recorded |
| H0.10 | Approve the session, MFA, and upload-malware decisions in this document | Business and technical owners | None | Decisions or time-limited pilot exceptions recorded |
| H0.11 | Approve the pilot capacity envelope and storage allowance | Business and technical owners | H0.2 | Users, active projects, upload allowance, CPU, memory, and free-space threshold recorded |
| H0.12 | Approve recovery point and recovery time objectives | Business and technical owners | H0.7 | RPO/RTO targets and escalation owner recorded |
| H0.13 | Confirm server-region, privacy, retention, and contractual requirements | Business owner | H0.2, H0.9 | Written approval retained before real data is introduced |
| H0.14 | Approve provider-account custody, MFA, recovery, renewal, and billing ownership | Business and technical owners | H0.1 | Primary/backup custodians, recovery method, renewal dates, and payment-alert recipients recorded without secrets |
| H0.15 | Approve the pilot browser, device, and operating-system support baseline | Business and application owners | None | Supported matrix and exception process recorded |
| H0.16 | Approve operational-evidence retention and the client-data access, correction, export, and deletion process | Business owner | H0.9, H0.13 | Retention period, request owner, response path, and legal-hold exception recorded |

### Phase 0 gate

- [ ] Hosting, domain, ownership, notification, backup, data, session, MFA, upload, privacy, capacity, recovery, data-location, provider-account, supported-client, and evidence-retention decisions are documented.
- [ ] No real client data is required for staging.

## Phase 1 — Make the Application Safe to Deploy

**Goal:** Remove code and configuration behaviors that are safe locally but unsafe on a public server.

| ID | Task | Owner | Depends on | Verification |
|---|---|---|---|---|
| H1.1 | Split database migration from demonstration seeding | Technical owner | H0.1 | Production start applies migrations without running the demo seed |
| H1.2 | Remove demonstration seeding from the normal production start command | Technical owner | H1.1 | No default account exists after clean production startup |
| H1.3 | Add a one-time, deliberate first-administrator creation command | Technical owner | H1.2 | Admin can be created securely; rerunning cannot silently reset credentials |
| H1.4 | Add startup validation for required production environment variables | Technical owner | H1.1 | Startup fails clearly when a required value is missing or unsafe |
| H1.5 | Define permanent absolute paths for the SQLite database, uploads, and local backup staging | Technical owner | H0.2 | Paths are outside the release directory and writable only as required |
| H1.6 | Make frontend static-file serving independent of the process working directory | Technical owner | None | App starts correctly from the documented service directory |
| H1.7 | Verify Hostinger-assigned port handling and reverse-proxy awareness | Technical owner | H0.2 | Server uses `PORT`; secure request/rate-limit behavior works behind proxy |
| H1.8 | Add graceful shutdown for HTTP and database connections | Technical owner | None | Restart completes without corruption or a stuck process |
| H1.9 | Review production logging to prevent secrets, tokens, and sensitive form data from being written | Technical owner | H1.4 | Sanitized error and request logs verified |
| H1.10 | Document every production environment variable without recording secret values | Technical owner | H1.4, H1.5 | Environment checklist completed |
| H1.11 | Add deployment-focused automated checks for clean startup and absence of demo users | Technical owner | H1.1–H1.5 | Tests fail if demo accounts return to production startup |
| H1.12 | Run backend tests and both production builds | Technical owner | H1.1–H1.11 | All tests and builds pass |
| H1.13 | Move local development and CI from end-of-life Node.js 20 to the selected supported LTS release | Technical owner | None | Local, CI, and target runtime versions match and pass |
| H1.14 | Replace local-storage bearer-token persistence with the approved secure-cookie session design and CSRF protection | Technical owner | H0.10 | Token is inaccessible to browser scripts; login, logout, expiry, and state-changing requests pass |
| H1.15 | Sanitize parameterized request paths so invitation/reset credentials never enter logs or operational alerts | Technical owner | None | Tests prove secret URL segments and query values are absent from logs |
| H1.16 | Strengthen password requirements and apply them consistently to bootstrap, invitations, reset, and profile changes | Technical owner | H1.3 | Weak passwords are rejected with understandable guidance |
| H1.17 | Make invitation and password-reset messages truthful for the configured delivery mode | Technical owner | H0.6 | UI never claims an email was sent when delivery is disabled |
| H1.18 | Define SQLite production settings and lifecycle checks, including one-instance enforcement, lock timeout, integrity check, and safe backup interaction | Technical owner | H1.5 | Concurrent-write and integrity tests pass without unexplained lock failures |
| H1.19 | Define upload quarantine/scanning behavior or enforce the approved pilot file-type restriction | Technical owner | H0.10 | Untrusted upload decision is enforced and documented |
| H1.20 | Pin supported runtime requirements in package metadata and deployment documentation | Technical owner | H1.13 | Unsupported runtime fails before deployment |
| H1.21 | Add a deployment preflight command covering environment, paths, database access, storage capacity, and writable upload/backup locations | Technical owner | H1.4, H1.5, H1.18 | Preflight passes in a production-like environment and fails safely when misconfigured |
| H1.22 | Rerun dependency audits, backend tests, and both production builds after all Phase 1 changes | Technical owner | H1.13–H1.21 | Release evidence records zero critical/high unresolved findings and all checks pass |

### Required environment categories

- runtime: `NODE_ENV`, loopback-only production `HOST`, and `PORT`;
- security: `JWT_SECRET`, token lifetime, and the separate detailed-health token;
- routing: production frontend URL and exact CORS origins;
- storage: production `DATABASE_URL`, `UPLOAD_DIR`, `BACKUP_DIR`;
- recovery: `BACKUP_ENABLED`, interval, and encryption key;
- public operations: approved HTTPS privacy-notice URL and monitored support email;
- organization and retention configuration;
- notification provider configuration, if activated;
- workflow feature flags.

### Phase 1 gate

- [x] Clean production startup creates no demo accounts.
- [x] Database and files are placed outside replaceable release directories by the deployment package.
- [x] Missing or placeholder secrets prevent startup.
- [x] Browser sessions, credential URLs, and passwords meet the documented recommended pilot baseline; owner ratification remains required in H0.10 before production.
- [x] SQLite lock/integrity behavior and upload controls pass.
- [x] Supported runtime, builds, dependency audits, and automated tests pass.

### Phase 1 implementation record — 2026-09-02

All H1.1–H1.22 tasks are implemented locally. Evidence retained in the project includes:

- Node.js `v22.23.2` production-runtime verification, pinned through package engines, `.nvmrc`, `.node-version`, and CI;
- 34 passing backend tests, including clean migration/bootstrap, cookie/CSRF authentication, account and archived-client recovery, deletion-triggered client access revocation, archived-work exclusion from direct workflow access, automation, and management reporting, active-user assignment enforcement, cross-client assignment rejection, proxied health-detail protection, graceful shutdown, concurrent SQLite writes, integrity, upload policy, backup retention, Hostinger environment isolation, role boundaries, and the full lifecycle;
- passing backend and frontend production builds under Node.js 22;
- passing performance evidence after migration 23 (100 projects, 5,000 work items, 30 runs, 80.78 ms p95 against a 500 ms threshold) and a serial parity audit across 2 current projects with zero discrepancies;
- zero known backend or frontend npm vulnerabilities after the final production-dependency audit;
- a passing production-mode preflight against isolated absolute database, upload, backup, and manifest paths;
- passing Bash syntax validation for every Hostinger provisioning, verification, deployment, recovery, backup, monitoring, and smoke-test script;
- Nginx, `systemd`, environment, release/rollback, runbook, privacy, data-migration, issue-register, and manifest artifacts under `deployment/hostinger/` and `docs/`;
- production-safe login behavior: demonstration credentials are excluded from production builds, while the approved privacy notice and support contact are supplied from validated server configuration.
- atomic encrypted backup publication plus a Hostinger production timer that pauses writes, checkpoints SQLite, captures database/uploads consistently every 12 hours, prevents deployment overlap, and restores service readiness before success.
- loopback-only application binding, explicit SSH password-login hardening, hardened service isolation, and a sanitized host-inventory command that never records environment values.
- database-backed session revocation and audited account suspension/reactivation, so password resets, removed access, deleted accounts, and changed roles invalidate stale authorization immediately; successful logins are audit-recorded, a database invariant protects the last active administrator even under concurrent/direct writes, and suspension atomically deactivates current project-team assignments.
- suspended accounts are excluded from assignment selectors and rejected by authoritative API validation across Inquiry, workflow tasks and decisions, Compliance, Pre-Construction, and Procurement; client task and decision assignments are also constrained to the project client.
- browser cookie lifetime and JWT expiry now share one validated `JWT_EXPIRES_IN` setting (5 minutes to 7 days), and authorization headers accept only the explicit Bearer scheme.
- an immutable release-candidate verifier that records the exact runtime, commit when available, lockfile hashes, clean migration, test/build/performance/parity results, and production dependency audits against an isolated database.
- a sanitized authenticated hosted-smoke path that verifies cookie login, temporary communication creation, representative image upload/download, policy-compliant soft-deletion, post-deletion access denial, and logout against a designated fictional verification client.
- truthful public password-recovery behavior: validated production exposes administrator-led recovery and the approved support address, while unsupported notification modes fail configuration validation instead of claiming delivery.
- exact frozen source/destination inventory reconciliation, detailed four-scenario recovery and encryption-key-rotation acceptance, least-privilege access review, and two-week pilot evidence templates.
- explicit SSH fail2ban jail configuration, validated portal-specific Nginx log rotation, query-stripping HTTP redirects, protected webhook invocation, and duplicate-alert suppression with a configurable reminder interval.

This record proves the application is ready to enter private staging. It does not claim that Hostinger, DNS, TLS, off-server backups, external alerts, email, or the two-week pilot have been completed.

Performance and parity commands both access the configured database and must run serially. CI preserves this order so temporary benchmark fixtures cannot appear in the parity snapshot.

## Phase 2 — Provision and Secure the Hostinger VPS

**Goal:** Establish a minimal, supportable server before deploying the application.

| ID | Task | Owner | Depends on | Verification |
|---|---|---|---|---|
| H2.1 | Provision the VPS in the selected region | Technical owner | Phase 0 gate | VPS is accessible to authorized administrator |
| H2.2 | Apply operating-system updates | Technical owner | H2.1 | No pending critical security update |
| H2.3 | Create a non-root deployment/service account | Technical owner | H2.1 | App cannot run as root |
| H2.4 | Configure SSH keys and disable password-based root access where supported | Technical owner | H2.3 | Key login succeeds; insecure login fails |
| H2.5 | Configure firewall rules for SSH, HTTP, and HTTPS only | Technical owner | H2.1 | Unnecessary public ports are closed |
| H2.6 | Install the exact Node.js LTS release selected in Phase 0 and configure the application as a `systemd` service | Technical owner | H2.2 | Runtime matches CI; automatic restart and boot start are verified |
| H2.7 | Configure reverse proxy and TLS certificate | Technical owner | H2.5, H0.3 | HTTPS works; HTTP redirects to HTTPS |
| H2.8 | Create persistent data, upload, log, and backup directories with least-privilege permissions | Technical owner | H2.3, H1.5 | Service account has required access only |
| H2.9 | Configure time zone, time synchronization, and log rotation | Technical owner | H2.2 | Accurate timestamps and bounded logs verified |
| H2.10 | Record a sanitized server configuration inventory | Technical owner | H2.1–H2.9 | Runbook identifies runtime, paths, and services without exposing secrets |
| H2.11 | Configure automatic security updates and brute-force/SSH protection appropriate to the chosen image | Technical owner | H2.2, H2.4 | Update and access-protection status verified |
| H2.12 | Configure disk, memory, CPU, process, certificate-expiry, and external-uptime monitoring | Technical owner | H2.6, H2.7 | Test threshold or synthetic failure reaches the owner |
| H2.13 | Set reverse-proxy body-size, timeout, security-header, and real-client-IP behavior to match the application | Technical owner | H2.7, H1.7, H1.19 | Valid 10 MB policy works; oversized request and spoofed forwarding fail safely |
| H2.14 | Protect Hostinger and authoritative DNS access from a single-person lockout or unnoticed expiry | Business and technical owners | H0.14 | MFA, two recovery custodians, recovery contact, auto-renewal/payment status, and expiry alerts are verified |
| H2.15 | Complete `docs/DNS_CUTOVER_AND_REVERSAL_WORKSHEET.md` before changing public records | Technical owner | H0.3, H2.7 | Existing zone export/screenshot, authoritative provider, old/new targets, TTL, propagation allowance, rollback trigger, and owner are recorded |

### Phase 2 gate

- [ ] HTTPS and firewall checks pass.
- [ ] Application will run as a non-root service.
- [ ] Persistent directories are mounted or located outside release code.
- [ ] Server restarts automatically restore required services.
- [ ] Resource, uptime, certificate, and disk monitoring reaches a named owner.
- [ ] Provider and DNS accounts have tested recovery, monitored renewal, and no single-person custody.

## Phase 3 — Deploy a Private Staging Environment

**Goal:** Prove deployment mechanics using fictional data.

| ID | Task | Owner | Depends on | Verification |
|---|---|---|---|---|
| H3.1 | Point the staging subdomain to the VPS | Technical owner | Phase 2 gate | DNS and TLS resolve correctly |
| H3.2 | Add staging environment variables through a protected server configuration | Technical owner | H1.10 | No secret is committed to source control |
| H3.3 | Deploy from the protected repository branch | Technical owner | Phase 1 and 2 gates | Repeatable deployment log retained |
| H3.4 | Apply migrations to a clean staging database | Technical owner | H3.3 | All migrations complete successfully |
| H3.5 | Create the first staging administrator using the deliberate bootstrap process | Technical owner | H1.3, H3.4 | Login succeeds and bootstrap cannot be reused unsafely |
| H3.6 | Confirm liveness and readiness endpoints | Technical owner | H3.4 | Both checks return healthy |
| H3.7 | Create fictional STAFF and CLIENT users through normal application screens | Application owner | H3.5 | Each role can log in |
| H3.8 | Restart the Node service and VPS | Technical owner | H3.7 | Data, users, and uploads remain present |
| H3.9 | Redeploy the same release | Technical owner | H3.8 | Data and uploads survive redeployment |
| H3.10 | Verify rollback to the previous application release without reverting data destructively | Technical owner | H3.9 | Previous release starts against supported schema or rollback limitation is documented |
| H3.11 | Protect staging from public discovery and unauthorized use | Technical owner | H3.1 | Access restriction and `noindex` behavior verified |
| H3.12 | Capture a deployment manifest containing application version, migration version, runtime version, and configuration names | Technical owner | H3.3 | Manifest is retained without secret values |

### Phase 3 gate

- [ ] Staging is reachable only by intended testers.
- [ ] Health checks pass after restart and redeployment.
- [ ] Database records and uploads survive both operations.
- [ ] No predictable default credentials exist.
- [ ] Search engines and unauthenticated visitors cannot browse staging.

## Phase 4 — Hosted Functional Acceptance

**Goal:** Verify the real operating path and all three user roles on Hostinger.

### ADMIN acceptance tasks

- [ ] Create and manage staff access.
- [ ] Create a client and securely issue client access.
- [ ] Review management metrics and operational alerts.
- [ ] Place and release a legal hold.
- [ ] Confirm administrator-only functions reject STAFF and CLIENT users.

### STAFF acceptance tasks

- [ ] Create a client, property, and inquiry.
- [ ] Qualify the inquiry and convert it into the project workflow.
- [ ] Complete required work items and decisions.
- [ ] Advance through Design and approve a scope version.
- [ ] Complete Compliance requirements with representative evidence.
- [ ] Complete Pre-Construction readiness and handoff.
- [ ] Compare procurement quotes, create a purchase order, inspect delivery, process a substitution, match an invoice, and close procurement.
- [ ] Confirm every blocker explains what must be corrected.

### CLIENT acceptance tasks

- [ ] Log in and view only the client's own project.
- [ ] Confirm internal-only notes, costs, and decisions are hidden.
- [ ] Upload and retrieve an allowed representative document.
- [ ] Respond to a client-visible approval or authorization.
- [ ] View project progress and notifications in understandable language.
- [ ] Confirm another client's URL or record cannot be accessed.

### Cross-cutting acceptance tasks

- [ ] Test desktop and mobile-width layouts on the critical path.
- [ ] Complete `docs/SUPPORTED_CLIENT_ACCEPTANCE_MATRIX.md` for every browser/device combination in the approved pilot support baseline; record unsupported combinations and workarounds.
- [ ] Complete the automated, keyboard-only, focus, zoom/reflow, contrast, and screen-reader checks in `docs/ACCESSIBILITY_ACCEPTANCE_CHECKLIST.md` for all three roles.
- [ ] Test expired login, incorrect password, and password reset.
- [ ] Confirm authentication uses the approved secure-cookie and CSRF behavior.
- [ ] Test an invalid or oversized upload.
- [ ] Confirm uploaded-file scanning, quarantine, or pilot restriction behaves as approved.
- [ ] Test duplicate submission and repeated button activation.
- [ ] Run simultaneous representative staff actions and verify no SQLite lock error, lost update, or duplicate authoritative action.
- [ ] Verify invitation and reset credentials never appear in application, proxy, or operational-alert logs.
- [ ] Confirm timestamps, audit history, and notification status are accurate.
- [ ] Complete the fictional-data rehearsal in `docs/CLIENT_DATA_REQUEST_RUNBOOK.md`, including owner-reviewed export scope, correction, deletion, and a legal-hold refusal.
- [ ] Restart the service during a controlled test and verify recovery.
- [ ] Simulate low disk space at a safe threshold and verify alerting before writes fail.

### Phase 4 gate

- [ ] Complete lifecycle succeeds without database editing.
- [ ] No cross-client or internal-only data exposure occurs.
- [ ] No Severity 0 or Severity 1 issue remains open.
- [ ] No critical or serious accessibility finding blocks a critical task; accepted lower-severity exceptions have an owner and due date.
- [ ] Business and application owners sign off on the hosted workflow.

## Phase 5 — Backups, Recovery, Alerts, and Email

**Goal:** Make failures visible and recoverable before real data is introduced.

| ID | Task | Owner | Depends on | Verification |
|---|---|---|---|---|
| H5.1 | Configure encrypted application backups at least every 12 hours in approved low-use windows, pausing writes so SQLite and uploads share one recovery point | Technical owner | Phase 3 gate | Consistent-backup timer passes, application returns to readiness, backup age remains below 14 hours, and the ≤24-hour RPO has scheduling margin |
| H5.2 | Copy encrypted backups to the selected off-server destination | Technical owner | H0.7, H5.1 | VPS loss does not remove every backup |
| H5.3 | Set and verify backup retention | Technical owner | H5.2 | Old backups expire according to policy |
| H5.4 | Restore database and uploads into a separate verification location | Technical owner | H5.2 | Checksums and application records match |
| H5.5 | Document restoration and full-server-loss steps | Technical owner | H5.4 | Another authorized person can follow the procedure |
| H5.6 | Route critical application and backup alerts to the named owner | Technical owner | H0.5 | Test alert is received and acknowledged |
| H5.7 | Activate and verify outbound email, or formally approve in-app-only pilot communication | Business owner | H0.6 | Selected communication mode passes acceptance test |
| H5.8 | Verify password-reset delivery and administrator recovery | Application owner | H5.7 | Locked-out test user recovers without database editing |
| H5.9 | If email is active, configure and verify sender authentication and delivery handling | Technical owner | H5.7 | SPF, DKIM, DMARC alignment and bounce/failure behavior are verified |
| H5.10 | Test loss of the application process, database path, upload path, and entire VPS as separate recovery scenarios | Technical owner | H5.4, H5.5 | Recovery evidence identifies procedure and measured recovery time for each case |
| H5.11 | Verify backup encryption-key escrow and rotation procedure with two authorized owners | Technical owner | H5.2 | Current and retained historical backups can be decrypted after planned key rotation |

### Phase 5 gate

- [ ] Off-server encrypted backup exists.
- [ ] A restore has been completed and documented.
- [ ] A real person receives a test critical alert.
- [ ] Password and notification behavior matches the approved operating model.

## Phase 6 — Production Preparation

**Goal:** Create the production environment without immediately opening it to all projects.

| ID | Task | Owner | Depends on | Verification |
|---|---|---|---|---|
| H6.1 | Freeze the release candidate | Technical owner | Phases 4 and 5 gates | Version identifier recorded |
| H6.2 | Run complete builds, tests, dependency audit, migration verification, performance check, and parity check | Technical owner | H6.1 | Release evidence retained |
| H6.3 | Create production secrets independently from staging | Technical owner | H6.1 | No staging secret is reused |
| H6.4 | Create clean production database and persistent storage | Technical owner | H6.3 | Production paths verified |
| H6.5 | Deploy the frozen release and apply migrations | Technical owner | H6.4 | Health checks pass |
| H6.6 | Create the designated production administrator | Technical owner | H6.5 | Secure login and recovery verified |
| H6.7 | Configure production backup, alerts, domain, HTTPS, and notification mode | Technical owner | H6.5 | Phase 5 controls pass in production |
| H6.8 | Run a sanitized production smoke test | Application owner | H6.6, H6.7 | Login, one temporary record, upload, and cleanup succeed |
| H6.9 | Record pre-pilot backup and rollback point | Technical owner | H6.8 | Recovery artifact verified |
| H6.10 | Execute the approved clean-start or controlled data-migration procedure | Technical owner | H0.8, H6.5 | Record counts, file counts, checksums, owners, and rejected records reconcile |
| H6.11 | Publish the approved privacy/contact information and internal retention procedure | Business owner | H0.9 | Pilot users can find the correct notice and incident contact |
| H6.12 | Complete a least-privilege access review for Hostinger, DNS, repository, backup, and email accounts | Business and technical owners | H6.3–H6.7 | Each account has a named owner; unnecessary access is removed |
| H6.13 | Execute the approved DNS cutover with a timed verification and reversal window | Technical owner | H2.15, H6.5 | Old/new DNS values, checks from independent networks, propagation status, decision timestamps, and any reversal are retained |
| H6.14 | Complete `docs/LAUNCH_EVIDENCE_INDEX.md` in the approved owner-accessible location | Application owner | H6.1–H6.13 | Decision register, release evidence, access review, acceptance, recovery, alert, data, and DNS records are indexed and readable by the backup owner |

### Phase 6 gate

- [ ] Frozen release evidence is complete.
- [ ] Production contains no demonstration accounts or projects.
- [ ] Production data is either clean or migrated with reconciled evidence.
- [ ] Health, backup, alert, recovery, and security checks pass.
- [ ] Privacy, retention, session, administrator protection, and upload decisions are active.
- [ ] DNS reversal criteria, provider-account continuity, supported-client baseline, and evidence retention are active.
- [ ] Business owner authorizes the limited pilot.

## Phase 7 — Two-Week Controlled Pilot

**Goal:** Prove normal use with limited risk.

| ID | Task | Owner | Depends on | Verification |
|---|---|---|---|---|
| H7.1 | Select 3–5 lower-risk real projects | Business owner | Phase 6 gate | Pilot list approved |
| H7.2 | Train pilot ADMIN, STAFF, and CLIENT participants using `USER_GUIDE.md` | Application owner | H7.1 | Users confirm access and basic understanding |
| H7.3 | Maintain one issue register with severity, owner, workaround, and resolution | Application owner | H7.1 | Every reported issue is traceable |
| H7.4 | Conduct a brief daily issue review in week one | Business owner | H7.3 | Decisions and owners recorded |
| H7.5 | Review health, failed notifications, alerts, and backup freshness each business day | Technical owner | H7.1 | Daily check recorded |
| H7.6 | Freeze feature expansion during the pilot | Business owner | H7.1 | Changes limited to pilot defects and security fixes |
| H7.7 | Complete an end-of-pilot review | Business owner | H7.1–H7.6 | Launch decision recorded |

### Pilot pass criteria

- zero data loss;
- zero cross-client or internal-only information exposure;
- zero unresolved Severity 0 issues;
- zero unresolved Severity 1 issues;
- at least 90% of routine actions completed without assistance;
- no routine task requires direct database editing;
- current encrypted off-server backup and restore evidence;
- business owner approves expansion.

## Phase 8 — Normal Use and Ongoing Operations

**Goal:** Expand safely and keep the system dependable.

- [ ] Add active projects in small batches.
- [ ] Monitor support requests and operational alerts daily for the first two weeks.
- [ ] Patch operating-system and application dependencies on a defined schedule.
- [ ] Test backup restoration at least quarterly and after storage changes.
- [ ] Review user access when staff responsibilities change.
- [ ] Rotate production secrets after suspected exposure and on the approved schedule.
- [ ] Review storage capacity and backup age monthly.
- [ ] Review external uptime, TLS expiry, disk, CPU, memory, and SQLite integrity reports monthly.
- [ ] Reassess SQLite when concurrency, reporting load, or deployment count increases.
- [ ] Schedule visual polish and convenience improvements separately from operational fixes.

## Issue Severity and Release Rules

| Severity | Definition | Release rule |
|---|---|---|
| Severity 0 — Critical | Data loss, security exposure, corrupt approval, unrecoverable service, or cross-client access | Stop affected use; no launch or expansion |
| Severity 1 — Blocking | Routine work cannot be completed without developer or database intervention | Must be resolved before the next gate |
| Severity 2 — Workaround | Work can be completed safely with a documented workaround | May enter backlog with owner and target |
| Severity 3 — Polish | Cosmetic, wording, spacing, or convenience issue | Defer until functional stabilization is complete |

## Risk Register

| Risk | Rating before control | Required control/gate | Residual position |
|---|---|---|---|
| Predictable demo accounts on public server | Critical | H1.1–H1.3 and Phase 1 gate | Must be eliminated |
| Browser-script-readable session token | High | H1.14 and hosted authentication acceptance | Must be eliminated before real-client pilot unless business owner records a time-limited exception |
| Invitation credential exposed in request logs | High | H1.15 and log inspection in Phase 4 | Must be eliminated |
| SQLite lock or corruption under concurrent use | High | H1.18, single instance, concurrency test, integrity monitoring | Acceptable only at demonstrated pilot load |
| Database/uploads lost during deployment or VPS failure | Critical | Persistent paths, H3.8–H3.9, off-server backup, H5.10 | Must have verified restore |
| Malicious uploaded document | High | H1.19 plus scanning/quarantine or restricted pilot policy | Decision must be explicit; scanning preferred for normal use |
| Weak account credential or administrator compromise | High | H1.16, MFA decision, login alerts, least privilege | MFA preferred before expanded use |
| Notification or reset email silently not delivered | Medium | H1.17 and H5.7–H5.9 | In-app-only mode must be clearly communicated if used |
| Critical workflow inaccessible to keyboard or assistive-technology users | High | Hosted WCAG 2.2 AA acceptance checklist and owned exceptions | Must have no critical/serious blocker before pilot |
| Disk exhaustion stops uploads/database writes | High | H2.12 and Phase 4 low-space alert test | Alert before operational failure |
| Unsupported runtime accumulates vulnerabilities | High | H1.13 and H1.20 | Supported LTS only |
| Existing local data is incomplete or unsafe to import | High | H0.8 and H6.10 | Clean start is default |
| Single VPS outage | Medium | External uptime monitor, service restart, off-server backup, recovery runbook | Accepted for initial pilot within stated RTO |
| Hostinger, registrar, or DNS account expires or becomes inaccessible | High | H0.14, H2.14, H6.12 | Two-person recovery and monitored renewal required before pilot |
| DNS cutover causes prolonged outage or points to the wrong host | High | H2.15 and H6.13 | Preserve prior values and use timed rollback criteria |
| A client request for access, correction, export, or deletion cannot be completed safely | High | H0.16 and hosted acceptance | Procedure and legal-hold behavior must be proven before pilot |
| A supported user cannot complete the critical path in their browser/device | Medium | H0.15 and Phase 4 support-matrix acceptance | Pilot limited to tested combinations |

## Deployment and Rollback Rules

- Never deploy directly from an unreviewed working directory.
- Every deployment must have a version identifier and retained build/test result.
- Back up the database and uploads before applying production migrations.
- Use forward-compatible database changes where practical; document rollback limits for every destructive or irreversible migration.
- Do not roll a database backward by replacing it with an older copy while new production records exist.
- Prefer application rollback compatible with the current database schema.
- The deployment script may restart the prior release automatically only if failure occurs before migrations begin. After migration begins, it stops and requires an explicit compatibility/recovery decision.
- If data integrity is uncertain, stop writes, preserve the current database and files, and restore into a separate location for verification.
- Keep legacy application paths available until parity and business approval permit their removal.
- Do not reuse staging secrets, databases, upload paths, email credentials, or backup destinations in production.
- Do not permit staging to send messages to real clients.

## Tasks Deliberately Deferred

- broad visual redesign;
- nonessential animations and interface polish;
- speculative automation or AI decisions;
- additional dashboards without a defined operating decision;
- multi-server scaling;
- database migration to PostgreSQL unless pilot evidence requires it;
- removal of legacy workflows before parity approval;
- uncommon process variants not encountered during the pilot.

## Implementation Order

Work must follow this sequence:

1. Complete Phase 0 decisions and ratify the already-implemented Phase 1 policy defaults.
2. Re-run Phase 1 release verification after ratification; change code only if an approved decision differs from the implemented baseline.
3. Provision the VPS in Phase 2.
4. Deploy staging and prove persistence in Phase 3.
5. Complete hosted acceptance in Phase 4.
6. Prove recovery and alerts in Phase 5.
7. Prepare production in Phase 6.
8. Run the limited pilot in Phase 7.
9. Expand only after the pilot passes.

No later phase should be treated as complete when an earlier required gate is open.

## Readiness Score Milestones

| Milestone | Expected score | Meaning |
|---|---:|---|
| Current local application | 8/10 | Phase 1 application controls and release checks pass; hosted and owner-controlled gates remain |
| Phase 1 complete | 8/10 | Application is safe to place in staging |
| Phases 2–5 complete | 8.5/10 | Hosted system is ready for a controlled real-project pilot |
| Two-week pilot passes | 9/10 | Ready for normal small-team use |
| Demonstrated operational history | 10/10 | Reliability is proven over time, not assumed before launch |

## Next Authorized Step

Phase 1 is complete. The next authorized work begins with the Phase 0 owner decisions, then Hostinger provisioning in H2.1. Do not introduce real client data until the Phase 2–6 gates pass.

The requirement-by-requirement current evidence boundary is maintained in `docs/HOSTINGER_COMPLETION_AUDIT.md`; it must be updated only from direct execution evidence, not intended configuration.
