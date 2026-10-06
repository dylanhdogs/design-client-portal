# Functional Stabilization Plan

## Purpose

This plan focuses on making the application dependable for real daily use. It intentionally prioritizes working workflows, data safety, access control, and recoverability over visual perfection or additional features.

## Stabilization Goal

The application is considered ready for normal use when a small internal team can manage 3–5 real projects for two consecutive weeks—from inquiry through procurement—without:

- losing or exposing client data;
- becoming blocked by a workflow defect;
- needing a developer to complete a routine task;
- bypassing an approval or compliance requirement;
- being unable to recover from a failed deployment or lost server.

## Current Functional Readiness Score: 7.5/10

This is a strong controlled-pilot score, not yet an unrestricted production-launch score.

| Area | Score | Current assessment |
|---|---:|---|
| Core business workflow | 9/10 | The full Inquiry → Design → Compliance → Pre-Construction → Procurement journey exists, with gates and field handoff. |
| Build and automated correctness | 9/10 | Frontend and backend production builds pass. The expanded deployment, security, operations, and workflow test suite passes. |
| Access and data protection | 8/10 | Role boundaries, authenticated file access, upload validation, rate limits, legal holds, and audit behavior are covered. Production secrets and session handling still need deployment verification. |
| Day-to-day usability | 7/10 | The major workspaces, next actions, blockers, client portal, and management view exist. Real users have not yet completed a documented acceptance pilot. |
| Operations and recovery | 7/10 | Health checks, structured logs, alerts, encrypted backup/restore, and a runbook exist. Off-machine backup storage and live alert routing still need to be configured and tested. |
| Deployment readiness | 8/10 | Production startup is hardened and the Hostinger deployment package is implemented locally. Live staging, independent backup, alerts, DNS/TLS, and pilot evidence remain. |

### Why the score is not lower

The application is no longer just a visual prototype. It builds successfully, has a real database and permissions model, enforces workflow gates, supports document handling, and has tested backup and recovery logic.

### Why the score is not higher

Automated tests cannot prove that staff can comfortably run real projects. Production startup no longer seeds demonstration users and production builds no longer display local demonstration credentials. Hosting, off-machine backups, outbound email, alert delivery, and a short real-user pilot remain unproven.

## Crucial Application Sections

### 1. Identity and Access

**Purpose:** Ensure administrators, staff, and clients see and change only what they are allowed to.

Must work:

- secure login and logout;
- administrator-controlled staff and client accounts;
- client access limited to the client's own records and files;
- password reset and account recovery;
- safe session expiration and production secrets.

Current state: Functionally strong and test-covered. Production credentials, password-reset delivery, and session behavior need live verification.

### 2. Client and Property Records

**Purpose:** Maintain the authoritative contact, property, consultation, communication, note, and document history.

Must work:

- create, find, update, and archive a client;
- retain accurate property and contact information;
- upload, preview, download, and remove permitted files;
- preserve a clear history of client activity.

Current state: Implemented. It needs real-user validation using representative documents and project records.

### 3. Inquiry and Qualification

**Purpose:** Convert a new opportunity into a sufficiently defined project.

Must work:

- capture objectives, property, budget, timing, and decision-makers;
- expose missing information and blockers;
- record qualification decisions;
- prevent advancement until required conditions are satisfied or formally overridden.

Current state: Implemented and test-covered.

### 4. Project Command Center and Workflow Gates

**Purpose:** Give the team one reliable place to see project status, ownership, next actions, blockers, approvals, and history.

Must work:

- show the authoritative current stage;
- assign and complete work items;
- record decisions and approvals;
- explain why advancement is blocked;
- prevent duplicate or conflicting transitions;
- retain an audit trail.

Current state: Implemented and test-covered. This should be the primary workspace during the pilot.

### 5. Design and Scope Control

**Purpose:** Turn client intent into an approved, versioned scope that downstream work can trust.

Must work:

- manage requirements, selections, alternatives, and scope versions;
- capture internal and client approvals;
- identify unresolved design decisions;
- prevent later stages from relying on an unapproved scope.

Current state: Implemented and test-covered.

### 6. Compliance and Permitting

**Purpose:** Track requirements, submissions, inspections, approvals, expirations, and evidence.

Must work:

- maintain a compliance register;
- attach supporting records;
- identify missing, rejected, or expired requirements;
- block readiness when required approvals are incomplete.

Current state: Implemented and test-covered.

### 7. Pre-Construction Readiness

**Purpose:** Confirm that the project can be handed to construction without unresolved administrative or site risks.

Must work:

- readiness checklist and owner assignments;
- blocker and exception handling;
- final readiness approval;
- field handoff package.

Current state: Implemented and test-covered.

### 8. Procurement

**Purpose:** Control vendors, quotes, purchasing, delivery, substitutions, and invoice matching.

Must work:

- vendor and quote comparison;
- purchase authorization;
- purchase-order duplicate prevention;
- delivery inspection and discrepancy handling;
- substitution approval, including client authorization when required;
- three-way matching and closeout.

Current state: Implemented and test-covered.

### 9. Client Portal and Communications

**Purpose:** Give clients a clear, limited view of their project and the actions that require them.

Must work:

- show understandable progress without exposing internal-only information;
- allow permitted uploads, notes, decisions, and approvals;
- provide reliable in-application notifications;
- clearly show when an action succeeded or failed.

Current state: Implemented. Outbound email delivery and client usability need live testing.

### 10. Management, Operations, and Recovery

**Purpose:** Help management identify stalled work and keep the service safe and recoverable.

Must work:

- authoritative workload and risk metrics;
- reviewable automation that does not silently make binding decisions;
- service health and actionable alerts;
- encrypted backups stored away from the application server;
- a rehearsed restore process.

Current state: Application controls exist. The production connections and operating routine still need to be established.

## Practical Stabilization Plan

### Phase 1 — Remove Launch Blockers

Target: 1–2 working days.

- Separate production migration from development/demo seeding.
- Ensure production startup never creates predictable demo users or resets a client password.
- Add a deliberate first-administrator setup process.
- validate all required production environment variables at startup;
- choose the initial hosting and durable storage arrangement;
- configure HTTPS, allowed frontend origin, strong secrets, and file-size/storage limits;
- run a clean-database migration and startup rehearsal.

Exit criteria:

- a clean production-like environment starts without demo records;
- no default password can log in;
- the designated administrator can be created securely;
- readiness health is green.

### Phase 2 — Prove the Critical Happy Path

Target: 2–3 working days.

Run one representative project through the application using separate ADMIN, STAFF, and CLIENT accounts:

1. Create the client and property.
2. Capture and qualify the inquiry.
3. Complete design requirements and approvals.
4. Complete compliance evidence and approval.
5. Complete pre-construction readiness.
6. Create procurement requests, compare quotes, issue a purchase order, inspect delivery, and close the request.
7. Confirm the client sees only the intended information.
8. Export or inspect the final audit history and handoff records.

Record every issue. Fix only severity 0 and severity 1 issues before moving to the pilot.

Exit criteria:

- all three roles complete their expected tasks without developer intervention;
- no cross-client or internal-only information is exposed;
- no data is lost after application restart;
- workflow blockers explain the corrective action.

### Phase 3 — Establish Recovery and Communication

Target: 1–2 working days.

- Store encrypted backups on durable off-machine storage.
- Perform and document a restore into a separate verification environment.
- Connect critical operational alerts to a monitored destination.
- Configure the actual outbound email provider, or explicitly operate with in-app notifications only for the pilot.
- Verify password reset, failed notification retry, and administrator account recovery.

Exit criteria:

- a non-developer follows the runbook and verifies a restored database and uploaded files;
- backup freshness is visible in health checks;
- failed notifications and server errors reach an accountable person.

### Phase 4 — Controlled Real-Project Pilot

Target: 2 consecutive weeks.

- Use 3–5 real, lower-risk projects.
- Name one internal application owner and one backup owner.
- Hold a 10-minute daily issue review during the first week.
- Freeze new feature requests unless they fix a pilot blocker.
- Track task completion, incorrect permissions, missing information, confusing screens, and manual workarounds.
- Fix severity 0 immediately and severity 1 before expanding use.

Exit criteria:

- zero severity 0 issues;
- no unresolved severity 1 issue;
- no lost data or cross-client exposure;
- at least 90% of routine actions are completed without assistance;
- backup and restore evidence is current;
- the business owner approves normal use.

### Phase 5 — Expand Carefully

After the pilot passes:

- add remaining active projects in small batches;
- monitor failures, blocked gates, notification retries, and support requests daily for the first two weeks;
- remove or consolidate legacy workflow screens only after parity and user acceptance are documented;
- schedule visual refinement and convenience features separately.

## Issue Priorities

| Severity | Meaning | Response |
|---|---|---|
| 0 — Critical | Data loss, security exposure, unavailable service, or incorrect binding approval | Stop affected use and fix immediately. |
| 1 — Blocking | A routine project task cannot be completed or requires developer/database intervention | Fix before pilot expansion. |
| 2 — Workaround | The task can be completed safely with a documented workaround | Schedule after critical-path stability. |
| 3 — Polish | Cosmetic, wording, spacing, or convenience improvement | Defer until the application is functioning reliably. |

## Explicitly Deferred Until After Stabilization

- broad visual redesign;
- animation and micro-interaction refinement;
- additional dashboards that do not resolve a current operating decision;
- speculative automation or AI decisions;
- uncommon workflow variants not encountered in the pilot;
- removal of legacy paths before parity approval;
- performance optimization beyond measured thresholds.

## Go-Live Checklist

- [ ] Production startup does not seed demo accounts.
- [ ] Strong production secrets are injected and documented by owner, not committed.
- [ ] HTTPS and the exact allowed frontend origin are configured.
- [ ] Clean migration and restart rehearsal passes.
- [ ] ADMIN, STAFF, and CLIENT happy-path acceptance passes.
- [ ] Client-boundary and internal-data visibility checks pass.
- [ ] Representative uploads can be previewed, downloaded, and restored.
- [ ] Off-machine encrypted backup is current.
- [ ] Restore rehearsal has named evidence and an owner.
- [ ] Alert destination and response owner are active.
- [ ] Password reset and account recovery work in the deployment environment.
- [ ] Notification approach is explicit: provider active or in-app only.
- [ ] Two-week pilot exit criteria pass.
- [ ] Business owner approves normal use.

## Score Targets

- **Current:** 7.5/10 — suitable for a controlled pilot after the production-startup blocker is removed.
- **Pilot-ready target:** 8.5/10 — production-safe startup, clean deployment rehearsal, and critical happy-path acceptance complete.
- **Normal-use target:** 9/10 — two-week pilot passes, recovery is rehearsed, and operating ownership is established.
- **10/10:** Reserved for demonstrated reliability over time. It should not delay useful deployment once the 9/10 normal-use standard is met.
