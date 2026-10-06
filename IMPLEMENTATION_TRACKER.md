# Signature Exteriors Operational Workflow Implementation Tracker

## Purpose

This tracker sequences implementation of the five-stage workflow defined in `design.md`:

`Inquiry → Design → Compliance → Pre-Construction → Procurement`

Implementation must begin with security and stability remediation. New workflow features should not be enabled until the existing application passes the relevant verification gates.

## Status Legend

- `[ ]` Not started
- `[-]` In progress
- `[x]` Complete
- `[!]` Blocked or requires investigation

## Implementation Rules

- Preserve existing client, project, phase, checklist, document, communication, note, notification, and activity behavior.
- Make additive database migrations wherever practical.
- Enforce permissions on the backend; frontend visibility is not a security boundary.
- Treat stage gates, approvals, verifications, and overrides as auditable state changes.
- Do not allow AI or automation to independently approve, authorize, verify, or advance consequential work.
- Do not enable a phase until its exit criteria and tests pass.

## Phase 0 — Environment and Baseline

### Goal

Establish a reproducible development baseline and verify the current application before changes begin.

### Tasks

- [x] Run `npm ci` at the repository root.
- [x] Run `npm ci` in `backend/`.
- [x] Run `npm ci` in `frontend/`.
- [x] Configure a local backend `.env` from `.env.example`.
- [x] Run Prisma generation.
- [x] Run backend TypeScript build.
- [x] Run frontend TypeScript/Vite build.
- [x] Run database migration and seed commands.
- [x] Record baseline build and runtime results.
- [x] Create test fixtures for ADMIN, STAFF, CLIENT, client, project, phases, documents, and checklist items.

### Exit criteria

- Backend and frontend builds pass.
- Seeded application starts locally.
- Admin, staff, and client demo flows are accessible.
- Baseline issues are recorded before feature work begins.

## Phase 1 — Security and Current-Code Remediation

### Goal

Close the existing authorization, file-access, and deployment-safety issues before adding new project workflow capabilities.

### Authorization fixes

- [x] Restrict consultation reads to the authenticated client or authorized internal user.
- [x] Scope document downloads by document ownership and client/project relationship.
- [x] Reject soft-deleted documents from download and preview endpoints.
- [x] Scope document metadata updates by document ID and authorized client/project.
- [x] Verify phase IDs belong to the requested project before phase updates.
- [x] Verify checklist item IDs belong to both the requested phase and project.
- [x] Verify consultation IDs, communication IDs, document IDs, and note IDs belong to the requested client/project where applicable.
- [x] Add role guards for internal and client frontend routes.

### API and file fixes

- [x] Standardize the backend error envelope with stable error codes.
- [x] Use `UPLOAD_DIR` consistently for upload, preview, download, and deletion paths.
- [x] Validate file extension, MIME type, magic bytes, size, and storage path.
- [x] Add rate limits for invitation, upload, approval, and other sensitive mutation endpoints.
- [x] Configure explicit production CORS origins.
- [x] Configure CSP `connect-src` for the deployed API origin.
- [x] Remove sensitive values from logs.

### Exit criteria

- Cross-client and cross-project authorization tests pass.
- Deleted files cannot be accessed.
- All API errors follow the documented contract.
- File storage uses the configured path.
- Security regression tests pass.

## Phase 2 — Workflow Foundation

### Goal

Add the shared project workflow infrastructure without disrupting the existing six pool phases.

### Data and migration

- [x] Add `Property` model.
- [x] Add `Inquiry` model.
- [x] Add `LifecycleStage` model.
- [x] Add `WorkItem` model.
- [x] Add `Decision` model.
- [x] Add `Approval` model.
- [x] Add `ProjectGate` model.
- [x] Add `ProjectAssignment` model.
- [x] Add required enums/status validation.
- [x] Add indexes and foreign-key behavior from `design.md`.
- [x] Add nullable organization boundary fields.
- [x] Add migration validation and rollback procedure.
- [x] Backfill properties from existing client addresses.
- [x] Backfill converted inquiries for existing projects.
- [x] Map existing six phases to the five lifecycle stages.
- [x] Create default lifecycle records for existing projects.

### Services and API

- [x] Implement project authorization service.
- [x] Implement assignment service.
- [x] Implement workflow state-transition service.
- [x] Implement gate evaluation service.
- [x] Implement audit event service with before/after state.
- [x] Implement command-center summary endpoint.
- [x] Implement work-item endpoints.
- [x] Implement decision and approval endpoints.
- [x] Implement stage advancement and override endpoints.
- [x] Add idempotency and conflict handling.
- [x] Add transactional gate advancement.

### UI

- [x] Add internal project command-center route.
- [x] Display lifecycle stage and legacy phase together.
- [x] Display open actions, blockers, decisions, approvals, and deadlines.
- [x] Add stage gate status and blocker details.
- [x] Add assignment controls.
- [x] Add activity/audit timeline.
- [x] Add loading, empty, error, blocked, and permission-denied states.

### Exit criteria

- Existing projects load with lifecycle mappings.
- Work items and decisions can be created, assigned, completed, and verified.
- Gates block incomplete transitions.
- Authorized overrides require reasons and audit records.
- Concurrent advancement cannot create duplicate transitions.
- Foundation API and permission tests pass.

## Phase 3 — Inquiry and Qualification

### Goal

Replace informal lead capture with a structured, assignable, qualification-ready inquiry workflow.

### Tasks

- [x] Add inquiry creation and editing UI.
- [x] Add client/property capture flow.
- [x] Add source/referral tracking.
- [x] Add project objectives, timing, budget expectation, and preliminary scope.
- [x] Add inquiry owner assignment.
- [x] Add next-action and due-date tracking.
- [x] Add client inquiry submission experience.
- [x] Add inquiry document/photo upload.
- [x] Add qualification statuses: `NEW`, `IN_REVIEW`, `QUALIFIED`, `DECLINED`, `NURTURED`, `CONVERTED`.
- [x] Add consultation outcome linkage.
- [x] Add inquiry-to-project conversion.
- [x] Add acknowledgment and assignment notifications.
- [x] Add missing-information work items.

### Tests

- [x] Inquiry validation tests.
- [x] Client ownership tests.
- [x] Qualification transition tests.
- [x] Conversion data-preservation tests.
- [x] Notification recipient tests.
- [x] Client submission end-to-end test.

### Exit criteria

- A new inquiry can be submitted, assigned, qualified, declined, nurtured, or converted.
- No inquiry history is lost during conversion.
- Required information and next action are visible to the owner.
- Inquiry gate to Design is enforced and audited.

## Phase 3A — Missing-Information Responses

Detailed design: `INQUIRY_MISSING_INFORMATION_DESIGN.md`

### Reception and Client Intake Redesign

Detailed design: `RECEPTION_CLIENT_INTAKE_DESIGN.md`

- [x] Reorganize the internal inquiry screen as a Reception Intake workspace.
- [x] Add task-oriented Needs Attention, In Progress, Ready for Design, and Closed/Nurtured queues.
- [x] Add core-intake completion feedback to each intake record.
- [x] Separate Intake, Open Questions, Files & Conversation, and Handoff into focused sections.
- [x] Show explicit current conversion blockers before the Design project action.
- [x] Move reports, nurture, and decline controls into secondary actions.
- [ ] Add schema-backed handoff state and review history.
- [ ] Add server-authoritative weighted completeness calculation.
- [ ] Add verified client contact identities and external-source routing.
- [ ] Connect universal inbound email and RingCentral SMS.
- [ ] Add manual phone-call source records and optional provider call metadata.

### Tasks

- [ ] Add inquiry information-request and versioned response records.
- [ ] Link each request to its existing workflow work item.
- [ ] Migrate existing missing-information work items without inventing responses.
- [ ] Add requested-field definitions, allowlisted field mapping, drafts, submissions, and attachments.
- [ ] Replace client “Mark provided” with an inline **Answer request** experience.
- [ ] Move new-inquiry creation behind an explicit separate-project action.
- [ ] Add staff response review, field comparison, accept/apply, clarification, cancellation, and reopening.
- [ ] Synchronize response and work-item status transactionally.
- [ ] Add request, response, review, field-application, and override audit events.
- [ ] Add in-app and external-delivery-compatible notification deep links.

### Tests

- [ ] Client ownership and cross-client isolation.
- [ ] Required-answer and attachment validation.
- [ ] Draft, submission, clarification, review, and cancellation transitions.
- [ ] Idempotent submission and stale-version conflict handling.
- [ ] Approved field application and audit history.
- [ ] Existing-work-item migration and rollback.
- [ ] Desktop, mobile, keyboard, and screen-reader client flows.

### Exit criteria

- Clients answer only requested questions on the original inquiry.
- Follow-up responses never create duplicate inquiry or property records.
- A request cannot be completed without a submitted response or audited administrative override.
- Inquiry → Design remains blocked until required responses are verified.

## Phase 4 — Design and Scope

### Goal

Create controlled design and scope development with decisions, revisions, evidence, and client approvals.

### Tasks

- [x] Add requirements and objectives workspace.
- [x] Add site information capture.
- [x] Add `DesignVersion` model and API.
- [x] Add `ScopeVersion` model and API.
- [x] Add relational `EvidenceLink` model.
- [x] Add design/scope document association.
- [x] Add version comparison view.
- [x] Add design revision history.
- [x] Add decision records with options and selected result.
- [x] Add client design-direction approval.
- [x] Add scope approval and authorization flow.
- [x] Add cost and schedule impact fields.
- [x] Add stale-approval behavior when material changes occur.
- [x] Add outstanding-question queue.

### Tests

- [x] Version uniqueness and ordering tests.
- [x] Version approval and supersession tests.
- [x] Evidence-link authorization tests.
- [x] Client approval tests.
- [x] Material-change invalidation tests.
- [x] Design-to-Compliance gate tests.

### Exit criteria

- Design and scope history is preserved.
- Client decisions are explicit and auditable.
- The active versions are unambiguous.
- Required design decisions are complete before Compliance advancement.

## Phase 5 — Compliance and Constructability

### Goal

Track permits, HOA requirements, engineering, utilities, site conditions, and constructability with evidence and ownership.

### Tasks

- [x] Add compliance register UI.
- [x] Add `ComplianceRequirement` model and API.
- [x] Add requirement categories and statuses.
- [x] Add owner and reviewer assignment.
- [x] Add due dates and external-response tracking.
- [x] Add evidence requirements and relational document links.
- [x] Add HOA tracking.
- [x] Add municipal/permit tracking.
- [x] Add engineering and architectural requirements.
- [x] Add drainage, grading, utilities, access, and constructability checks.
- [x] Add rejected-evidence correction/resubmission flow.
- [x] Add compliance exception records.
- [x] Add overdue notifications and escalation.
- [x] Add Compliance-to-Pre-Construction gate evaluation.

### Tests

- [x] Requirement status transition tests.
- [x] Evidence required/missing/rejected tests.
- [x] External-response delay tests.
- [x] Client-visible versus internal-only compliance tests.
- [x] Overdue escalation tests.
- [x] Compliance gate blocker tests.

### Exit criteria

- Every required compliance item has an owner and status.
- Required evidence is linked and reviewable.
- Rejected items can be corrected and resubmitted.
- The compliance gate blocks unresolved required conditions.

## Phase 6 — Pre-Construction Readiness

### Goal

Confirm that an approved project is controlled, executable, and ready for procurement/construction.

### Tasks

- [x] Add contract verification record.
- [x] Add scope reconciliation workflow.
- [x] Add plans/specifications reconciliation.
- [x] Add project budget and cost-code structure.
- [x] Add schedule and milestone records.
- [x] Add client responsibility list.
- [x] Add site logistics and access checklist.
- [x] Add safety planning requirements.
- [x] Add selections and allowance reconciliation.
- [x] Add procurement planning record.
- [x] Add communication protocol record.
- [x] Add project team assignment view.
- [x] Add `ReadinessReview` model and API.
- [x] Add readiness checklist snapshot.
- [x] Add readiness score and blocker count.
- [x] Add leadership approval for configured high-risk exceptions.
- [x] Add Pre-Construction-to-Procurement gate.

### Tests

- [x] Readiness checklist completeness tests.
- [x] Contract/scope mismatch tests.
- [x] Missing-selection tests.
- [x] Client-responsibility overdue tests.
- [x] Readiness override permission tests.
- [x] Readiness review audit tests.

### Exit criteria

- Construction readiness review evaluates all required conditions.
- Incomplete readiness blocks advancement.
- Overrides require reason, risk, mitigation, owner, and due date.
- Project team, budget, schedule, selections, and responsibilities are recorded.

## Phase 7 — Procurement

### Goal

Control purchasing and material/service readiness from request through invoice matching.

### Tasks

- [x] Add `Vendor` model and management UI.
- [x] Add `ProcurementRequest` model and workflow.
- [x] Add quote collection and comparison.
- [x] Add quote-selection approval.
- [x] Add purchase-order creation.
- [x] Add cost-code and currency handling.
- [x] Add lead-time and required-by tracking.
- [x] Add delivery records.
- [x] Add delivery inspection records.
- [x] Add backorder workflow.
- [x] Add substitution workflow.
- [x] Add client authorization for applicable substitutions.
- [x] Add `InvoiceMatch` model and ordered/delivered/invoiced comparison.
- [x] Add procurement exception notifications.
- [x] Add Procurement-to-Field-Execution gate.

### Tests

- [x] Vendor and quote permission tests.
- [x] Quote comparison tests.
- [x] Purchase authorization tests.
- [x] Duplicate purchase-order prevention tests.
- [x] Partial delivery tests.
- [x] Damaged/incomplete delivery tests.
- [x] Substitution approval tests.
- [x] Currency and amount-variance tests.
- [x] Three-way verification tests.

### Exit criteria

- Required procurement requests are traceable to project needs.
- Quotes and selected vendors are recorded.
- Purchase orders require authorization.
- Deliveries can be received and inspected.
- Substitutions preserve the original requirement and require approval when impactful.
- Ordered, delivered, and invoiced values can be compared.

## Phase 8 — Notifications, Automation, and Reporting

### Goal

Add safe automation and management visibility after the underlying records and transitions are reliable.

### Tasks

- [x] Implement notification trigger matrix.
- [x] Add retryable external notification delivery.
- [x] Add overdue reminders.
- [x] Add escalation rules.
- [x] Add missing-information detection.
- [x] Add document extraction suggestions.
- [x] Add meeting summaries.
- [x] Add readiness-gap suggestions.
- [x] Add quote-comparison assistance.
- [x] Add lead-time alerts.
- [x] Add project stage-aging dashboard.
- [x] Add blocker and exception dashboard.
- [x] Add compliance dashboard.
- [x] Add procurement dashboard.
- [x] Add client-experience metrics.
- [x] Add automation failure monitoring.
- [x] Require human review before AI output becomes authoritative.

### Exit criteria

- Automation failures do not change authoritative project state.
- AI suggestions are reviewable and attributable.
- Management metrics reconcile with source records.
- Notifications are deduplicated and auditable.

## Phase 8A — Universal Email and RingCentral SMS

Detailed design: `EMAIL_SMS_NOTIFICATION_DESIGN.md`

- [ ] Complete sender-domain, SMTP-provider, RingCentral, TCR, consent, and ownership decisions.
- [ ] Add channel-neutral outbound message, contact, preference, consent, and webhook-event records.
- [ ] Add idempotent worker leases, bounded retries, suppression, and dead-letter handling.
- [ ] Implement versioned email and SMS templates.
- [ ] Implement the provider-neutral SMTP email adapter and sender-domain controls.
- [ ] Activate invitation, recovery, workflow, deadline, and exception email templates.
- [ ] Implement RingCentral JWT authentication, sender verification, and SMS delivery.
- [ ] Implement RingCentral webhook validation, inbound SMS capture, delivery status, and STOP/START synchronization.
- [ ] Add recipient preferences, SMS consent, quiet hours, and unmatched-message review UI.
- [ ] Add provider health, delivery metrics, operator retry/cancel actions, and alerting.
- [ ] Pass fake-provider, SMTP, RingCentral sandbox, pilot, rollback, and recovery acceptance tests.

### Exit criteria

- Email reaches the approved cross-provider test matrix with verified sender authentication.
- SMS sends only to consented E.164 destinations through the approved RingCentral campaign.
- STOP prevents subsequent SMS and START creates an auditable opt-in transition.
- Provider acceptance is not mislabeled as confirmed delivery.
- Duplicate events, retries, crashes, webhooks, and rate limits do not create duplicate messages.
- In-app notifications remain available throughout provider failure or channel rollback.

## Phase 8B — Daily Client Status Reports

Detailed design: `AI_CLIENT_STATUS_REPORT_DESIGN.md`

### Facts-first report foundation

- [x] Add immutable report and source-snapshot records with an additive migration.
- [x] Build deterministic inquiry/project fact aggregation across lifecycle, work, decisions, compliance, readiness, procurement, communications, consultations, and documents.
- [x] Add organization-time-zone business-date handling and correct current-day overdue calculations.
- [x] Add source watermark, source fingerprint, duplicate-snapshot reuse, freshness checks, and audit events.
- [x] Restrict report generation, history, viewing, and exports to ADMIN and STAFF.
- [x] Add internal report UI with state, current stage, next actions, risks, completed activity, data-quality warnings, source links, and saved history.
- [x] Add entry points from client, inquiry, and project workspaces.
- [x] Add saved-snapshot PDF export with branded color, pagination, repeated report identity, and verification footer.
- [x] Add saved-snapshot Excel export with six formatted/filterable worksheets, typed dates/amounts, metadata, and formula-injection protection.
- [x] Add export verification utility and API/security regression coverage.

### Deferred enhancements

- [ ] Add schema-validated optional AI narrative after facts-only reports have production usage data.
- [ ] Add weekday change-only staff digest after on-demand reporting is stable.
- [ ] Add point-in-time event reconstruction before allowing retrospective report generation; historical reports currently come from immutable snapshots saved on their business date.
- [ ] Complete browser accessibility and responsive acceptance checks on the deployed build.

### Exit criteria

- Facts-only reports are generated from authorized source records and never mutate workflow state.
- Duplicate generation reuses an unchanged same-day snapshot unless refresh is requested.
- Historical snapshots are immutable and show when their current source fingerprint has changed.
- PDF and Excel exports use the same saved snapshot and match report identity and counts.
- Export files open successfully and pass automated and visual formatting checks.

## Phase 9 — Production Readiness and Rollout

### Security and privacy

- [x] Complete security review.
- [x] Complete file upload security review.
- [x] Complete client-boundary authorization review.
- [x] Document token/session strategy.
- [-] Configure secrets management and rotation. Validation, protected-file layout, and rotation procedure are implemented; live secret creation and escrow remain.
- [x] Configure retention and legal-hold behavior.
- [x] Verify no sensitive data appears in logs.

### Reliability and operations

- [-] Configure encrypted database backups. Local implementation and retention pass; live schedule/off-server copy pending.
- [-] Configure uploaded-file backups. Local implementation and checksum restore pass; live mirror pending.
- [x] Execute isolated application-level restore test.
- [ ] Verify RPO ≤ 24 hours.
- [ ] Verify RTO ≤ 4 hours.
- [x] Configure application health checks.
- [x] Configure correlation IDs and structured logs.
- [-] Configure alerts for 5xx errors, auth failures, gate conflicts, notification failures, upload failures, and backup failures. Application events and production monitor are implemented; live recipient tests remain.

### Quality verification

- [x] Run unit tests.
- [x] Run API integration tests.
- [x] Run migration tests on fresh database.
- [x] Run migration tests on seeded legacy database.
- [x] Run permission tests.
- [x] Run state-transition tests.
- [x] Run concurrency/idempotency tests.
- [x] Run end-to-end tests.
- [ ] Run accessibility checks targeting WCAG 2.2 AA behavior.
- [x] Run performance tests at documented project/work-item volume.

### Rollout

- [x] Enable read-only lifecycle mapping in local/release configuration.
- [x] Enable workflow foundation behind feature flag in local/release configuration.
- [x] Enable Inquiry workflow in local/release configuration.
- [x] Enable Design workflow in local/release configuration.
- [x] Enable Compliance workflow in local/release configuration.
- [x] Enable Pre-Construction workflow in local/release configuration.
- [x] Enable Procurement workflow in local/release configuration.
- [ ] Monitor errors, conflicts, blockers, notification failures, duplicates, and migration discrepancies.
- [x] Confirm active-project parity with legacy screens in the current data set.
- [ ] Remove legacy paths only after migration and parity approval.

### Final exit criteria

- All release acceptance criteria in `design.md` pass.
- No unresolved P0 security issues remain.
- Builds and migrations pass in CI.
- Backup restoration is verified.
- Product, engineering, and operations owners approve production release.

## Active Work Log

| Date | Phase | Item | Owner | Status | Notes |
|---|---|---|---|---|---|
| 2026-08-26 | Phase 0 | Tracker created | Codex | Complete | Ready for implementation kickoff |
| 2026-08-26 | Phase 0 | Baseline established | Codex | Complete | Dependencies installed; database migrated and seeded; backend/frontend builds and authenticated runtime smoke test passed |
| 2026-08-26 | Phase 1 | Security remediation | Codex | Complete | Authorization, uploads, errors, CORS/CSP, rate limits, and logging hardened; 9/9 security integration tests pass; npm audits report zero known vulnerabilities |
| 2026-08-26 | Phase 2 | Workflow data foundation | Codex | Complete | Additive migration applied; idempotent legacy backfill created 1 property, 1 converted inquiry, 5 lifecycle stages, and 4 gates for the seeded project |
| 2026-08-26 | Phase 2 | Workflow services and command center | Codex | Complete | Backend/frontend builds pass; 10/10 integration tests pass; desktop/mobile rendered checks and action/assignment control checks pass with no console errors |
| 2026-08-26 | Phase 3 | Inquiry and qualification | Codex | Complete | Client/internal UI, property capture, qualification, missing-information requests, consultation outcomes, documents, notifications, and audited conversion implemented; 11/11 integration tests pass |
| 2026-08-26 | Phase 4 | Design and scope | Codex | Complete | Versioned design/scope, client approvals, relational evidence, impacts, stale gates, comparison/history UI, and open questions implemented; 12/12 integration tests and rendered role checks pass |
| 2026-08-26 | Phase 5 | Compliance and constructability | Codex | Complete | Compliance register, categories, ownership, evidence, external responses, correction/resubmission, exceptions, overdue escalation, client visibility, and gate rules implemented; frontend build, 13/13 integration tests, and rendered responsive UI checks pass |
| 2026-08-26 | Phase 6 | Pre-Construction readiness | Codex | Complete | Typed readiness records, financial/schedule controls, responsibilities, logistics/safety, selections, planning, team view, immutable scored reviews, high-risk exceptions, overdue notices, and Procurement gate implemented; 14/14 integration tests and rendered internal/client role checks pass |
| 2026-08-26 | Phase 7 | Procurement | Codex | Complete | Vendor directory, requests, quote comparison/selection, authorization, purchase orders, lead times, delivery/inspection/backorders, client-authorized substitutions, three-way invoice verification, exception notices, and audited field handoff implemented; 15/15 integration tests and rendered role checks pass |
| 2026-08-26 | Phase 8 | Automation and reporting | Codex | Complete | Deduplicated notifications, retryable external delivery outbox, overdue/escalation scans, six reviewable suggestion classes, live management dashboards, delivery monitoring, and an explicit human-authority boundary implemented; 16/16 integration tests, frontend build, and rendered admin action checks pass |
| 2026-09-02 | Phase 9 | Hostinger application hardening | Codex | Complete | Secure cookies/CSRF, database-backed session revocation, account suspension/reactivation, archived-client restoration, deletion-triggered access revocation, archived-work exclusion from workflow routes/automation/management totals, inactive-recipient delivery cancellation, active-assignment and cross-client safeguards, synchronized session expiry, strict Bearer parsing, proxied health-detail protection, tested graceful shutdown, clean production migration/bootstrap, strong credentials, account recovery, persistent paths, Node 22, production preflight, SQLite controls, restricted complex uploads, manifests, local/remote backup retention, and sanitized logging implemented; 34/34 tests pass |
| 2026-09-02 | Phase 9 | Hostinger operations package | Codex | In progress | Isolated loopback-only staging/production services, SSH/fail2ban/service hardening, sanitized host inventory, Nginx/TLS and bounded safe logs, source/commit-bound release evidence, migration-aware locked deployment/self-restoring rollback, exact migration inventory comparison, write-consistent backups, host verification, authenticated record/upload smoke test, off-server mirror, protected deduplicated alert routing, recovery/access/pilot templates, and production monitoring artifacts implemented; live Hostinger execution and owner/provider evidence pending |
| 2026-09-11 | Phase 8B | Daily client status reporting foundation | Codex | Complete | Immutable facts-only snapshots, freshness and audit controls, internal report UI, branded PDF, six-sheet Excel export, formula-injection protection, additive migration, and export verification implemented; backend/frontend builds and 35/35 tests pass |
| 2026-09-02 | Phase 9 | Hostinger final scope review | Codex | Complete | Corrected the Phase 1 implementation-versus-owner-approval gate, and scoped provider account recovery/renewal, DNS cutover/reversal, supported browser/device baseline, operational evidence retention, and client-data request handling before hosted implementation |

## Decision Log

| Decision | Choice |
|---|---|
| Project model | Evolve current `PoolProject` model |
| Internal UX | Unified project command center |
| Procurement depth | Operational procurement |
| Gate behavior | Controlled gates with authorized override |
| Client experience | Action-centered collaboration |
| Automation | Human-controlled, automation-ready |
| Organization scope | Single organization with future organization boundary |
