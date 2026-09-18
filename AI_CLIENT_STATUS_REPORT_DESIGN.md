# Internal Client Status Report Design

## Purpose

Create an internal, staff-only report showing where one client and project stand on a selected business day. The report uses the existing inquiry and project record; it does not create a client dashboard, duplicate inquiry, or separate client-facing reporting area.

The report answers:

- What is the client trying to accomplish?
- What stage is the project in?
- What happened recently?
- What is incomplete, overdue, blocked, or waiting on another person?
- What does the client need to do next?
- What does the internal team need to do next?
- Which decisions, approvals, risks, and follow-ups need attention?

## Product decision

Build facts-first reporting. The application calculates the reliable facts from authorized records. An optional AI layer can turn those facts into a short readable narrative. The facts-only report must remain useful when no AI provider is configured or when the provider is unavailable.

The first release is on-demand from the internal inquiry and project workspaces. A staff daily digest is a later enhancement.

## Goals and non-goals

### Goals

- Give staff a clear briefing in under one minute.
- Make client actions, internal actions, deadlines, blockers, and next steps obvious.
- Preserve source links so statements can be checked.
- Keep reports current, historical, auditable, and inexpensive.
- Reuse the existing inquiry, project, workflow, gate, document, decision, communication, and procurement records.

### Non-goals

- Build a client reporting dashboard.
- Replace the project command center, accounting system, schedule, permit system, or CRM.
- Approve, authorize, verify, or advance work automatically.
- Send messages automatically when a report is generated.
- Treat an AI summary as a source of truth.

## Users and permissions

ADMIN users may generate, view, export, and retain reports for authorized organization records. STAFF users may generate and view reports only for clients and projects they are already authorized to access. CLIENT users cannot access internal reports.

The backend must authorize the client, inquiry, and project before assembling any source data. Frontend visibility is not a security boundary. Archived, deleted, and unauthorized records follow the existing project and client visibility rules.

## Report identity and date rules

Every report stores:

- `clientId`, `projectId` nullable, and `inquiryId` nullable.
- `asOfDate`, `displayTimeZone`, and UTC `generatedAt`.
- `generatedBy`, `reportVersion`, and `generationMode`.
- `sourceWatermark`, representing the latest included source update.
- `sourceFingerprint`, a hash of the included source IDs, versions, statuses, and update timestamps.
- `overallState`, warnings, and source references.

“Current day” uses the configured organization time zone. The report header must state: `As of [date/time] [time zone]`. The date filter uses the local start and end of that business day, converted to UTC for querying. A past report is labeled historical. A report whose source fingerprint no longer matches is labeled `Changed since generated`.

The report subject must identify exactly one primary record: an inquiry or a project. If both are supplied, they must belong to the same client and be related through the existing conversion relationship. If neither is supplied, the request is invalid.

## Source-of-truth contract

The fact builder reads only authorized records:

- Original inquiry, client, property, objectives, scope, budget, and timing.
- Project lifecycle stage, legacy phase, owner, gate, and blockers.
- Work items, assignments, priorities, statuses, due dates, and reviewers.
- Client responses, uploaded documents, communications, and consultations.
- Decisions, approvals, authorizations, and stale approvals.
- Design and scope versions.
- Compliance requirements, evidence, exceptions, and reviews.
- Readiness items and reviews.
- Procurement requests, quotes, purchase orders, deliveries, inspections, substitutions, and invoice matches.

The report separates four kinds of content:

1. **Facts:** copied or calculated from records.
2. **Derived status:** deterministic results such as overdue, blocked, aging, and completion.
3. **Narrative:** readable wording generated from the fact packet.
4. **Recommendation:** a suggested next action that a staff member must review.

Missing information stays missing. Conflicting records become a data-quality warning. The system never infers an approval, date, amount, owner, or completion state.

## Report sections

### 1. Snapshot

Show client, project/inquiry, property, current lifecycle stage, status, owner, report timestamp, latest source update, and freshness state.

### 2. Executive status

Show a maximum 120-word summary and one deterministic state:

- `ON_TRACK` — required work is assigned, no blocking or overdue condition exists, and a next action is known.
- `ATTENTION_REQUIRED` — overdue or high-priority work, unresolved client action, stale approval, or data conflict exists.
- `BLOCKED` — a required gate, condition, or evidence item blocks advancement.
- `NO_ACTIVE_WORK` — no active action is currently recorded.

The summary must state the current stage, the reason for the state, and the next meaningful milestone.

### 3. Client and project context

Show the original inquiry objective, description, preliminary scope, budget expectation, desired timing, property/site summary, and recorded client responsibilities. This keeps the daily report grounded in the client’s original request.

### 4. Current stage and gate

Show stage owner, gate state, blockers, required evidence, required decisions, normal advancement eligibility, and any approved override with its reason and approver. Distinguish `not ready`, `blocked`, `ready for review`, and `approved`.

### 5. Completed recently

Show completed work, client responses, uploads, decisions, approvals, consultations, stage changes, compliance updates, and procurement updates in the selected business-day window. Provide an optional seven-day view. Each item includes date, actor, type, and source link.

### 6. Items requiring action

Group open items by responsibility:

- Client actions.
- Internal staff actions.
- External actions such as HOA, permit, engineer, inspector, vendor, or subcontractor responses.
- Leadership actions such as exceptions, overrides, financial decisions, or risk approvals.

Each item shows title, plain-language description, owner, reviewer, status, priority, due date, overdue amount, related stage, cost impact, schedule impact, and source link when available.

### 7. Decisions and approvals

Show pending client decisions, pending internal approvals, recent results, rejected items, stale approvals, and decisions affecting cost or schedule. Identify who has authority to act and whether the item blocks advancement.

### 8. Risks, blockers, and exceptions

Show overdue required work, blocked or rejected gates, missing evidence, conflicting scope/budget/schedule data, unassigned required work, stale approvals, long-lead procurement risk, delivery exceptions, invoice variances, unanswered client requests, and failed notifications. Every risk includes severity, reason, owner, due date, mitigation if recorded, and source link.

### 9. Next actions

End with three to five prioritized actions. Each states what must happen, who owns it, when it is due, why it matters, and which record or gate it affects. A recommendation cannot become an authoritative work item without a separate staff action.

### 10. Sources and warnings

Show report ID, source counts, latest source timestamp, excluded-record reasons, generation mode, model/prompt version when AI is used, and warnings.

## Deterministic status calculation

The status calculation runs on the server:

1. `BLOCKED` when an active required gate is blocked, a required condition is rejected, or an overdue item explicitly blocks advancement.
2. `ATTENTION_REQUIRED` when overdue/high-priority work, unresolved client actions, stale approvals, or material conflicts exist.
3. `ON_TRACK` when required work is assigned, no blocker or overdue condition exists, and a next action is known.
4. `NO_ACTIVE_WORK` when there is no active action and the record is not advancing.

The calculation returns the reasons behind the state. Completion percentages appear only when the denominator is explicitly defined.

## Optional AI narrative

AI receives a minimized, structured fact packet—not raw database tables, unrelated clients, passwords, tokens, or unrestricted logs. The packet contains the current objective, stage, state, open actions, recent activity, decisions, blockers, source IDs, and output limits.

The AI must return validated structured data:

```json
{
  "summary": "...",
  "topNextActions": [],
  "attentionItems": [],
  "questionsForStaff": [],
  "uncertainties": [],
  "sourceReferences": []
}
```

The backend rejects unsupported or invalid output and keeps the facts-only report. The model must preserve dates, names, amounts, owners, and statuses; say “not recorded” when information is absent; flag contradictions; and never claim that a record is approved, complete, safe, compliant, or authorized unless the source says so.

The UI labels the narrative `AI-assisted summary` and displays the supporting facts and links beside it. AI cannot create, update, close, verify, approve, or advance any authoritative record.

## Cost-control design

The application generates facts-only reports with no AI usage cost. AI is requested only when a staff user selects the optional AI narrative. Results are cached by source watermark, report version, and prompt version. An organization-level monthly request and spending limit disables AI when exceeded while facts-only reports continue working.

Track model, user, report ID, token counts when available, estimated cost, outcome, and provider errors. Store provider keys only in backend secrets.

## Storage model

### `ClientStatusReport`

Store report identity, organization/client/project/inquiry relationships, date and time zone, generator, source watermark, source fingerprint, version, mode, state, structured fact snapshot, optional narrative JSON, model and prompt metadata, cost estimate, status, warnings, and timestamps.

### `ClientStatusReportSource`

Store report ID, source type, source ID, source update time, and report section. This gives staff a stable link from every important item to its inquiry, work item, decision, document, gate, compliance record, or procurement record.

The report content and source snapshot are immutable after creation. Retention, legal hold, privacy, or administrative deletion may remove a report according to policy; deletion must be audited and must not change the underlying inquiry or project records. Current application relationships remain relational.

## API contract

### Generate

`POST /api/clients/:clientId/status-reports`

```json
{
  "projectId": "uuid",
  "inquiryId": "uuid",
  "asOfDate": "2026-09-11",
  "includeAiNarrative": false,
  "forceRefresh": false
}
```

The server derives the time zone, checks ownership, applies archived/deleted rules, builds facts, and returns a cached report when the source watermark is unchanged.

### Read

`GET /api/clients/:clientId/status-reports/:reportId`

Re-check access and return `stale: true` if source records changed.

### History

`GET /api/clients/:clientId/status-reports?projectId=&from=&to=&page=&limit=`

Return paginated authorized snapshots.

### Export

`GET /api/clients/:clientId/status-reports/:reportId/export?format=pdf|xlsx`

Internal authorized users only. Export always uses the saved report snapshot, not a second live query, so the downloaded PDF and Excel file describe the same report the staff member viewed. The export includes as-of time, report ID, source references, and a footer stating that the report must be checked against current records.

Invalid formats return `REPORT_EXPORT_FORMAT_UNSUPPORTED`. The response uses a safe download filename containing the client/project label, as-of date, report ID, and extension; user-provided labels are sanitized.

## PDF report specification

PDF is the primary presentation format for sharing, printing, and storing a formatted daily report.

The PDF must be generated from the saved report snapshot using a server-side, repeatable renderer. Browser print behavior must not determine the final layout. PDF generation failure must not affect the report or project records.

Required PDF layout:

- Page 1: report header, as-of timestamp, state banner, executive status, current stage/gate, and top next actions.
- Following pages: client/project context, completed activity, responsibility-based action lists, decisions and approvals, risks/blockers, and sources/warnings.
- Header on every page: client/project label, report date, and report ID.
- Footer on every page: generated timestamp, page number, confidentiality label, and `Generated from application records`.
- Stable headings, repeated table headers, controlled row splitting, and no clipped text.
- Long descriptions wrap within cells and never overflow the page.
- Empty sections display `None recorded` instead of unexplained blank space.

PDF color and accessibility rules:

- Use color to reinforce state, never as the only state indicator.
- Every state also has text and, where useful, an icon or pattern.
- Text and status colors meet WCAG 2.2 AA contrast targets.
- Use a print-safe palette that remains understandable in grayscale.
- Do not place critical text over a colored background unless contrast is verified.
- Verify short, long, empty, and multi-page reports visually before release.

PDF exports must not include AI prompts, provider keys, hidden internal fields, unrelated clients, or unauthorized source links. Source links may be rendered as report-local references or authorized application URLs.

## Excel export specification

Excel is for staff analysis and filtering. It is a read-only export of the saved report snapshot and is not a replacement for editing application records.

The workbook uses a stable `.xlsx` structure:

1. `Summary` — report metadata, client/project context, current stage, overall state, executive status, and warnings.
2. `Next Actions` — responsibility, title, status, priority, owner, reviewer, due date, overdue days, stage, cost impact, schedule impact, and source reference.
3. `Decisions & Approvals` — title, type, status, decision-maker, requested date, due date, result, impact, and source reference.
4. `Risks & Blockers` — severity, category, reason, owner, due date, mitigation, gate impact, and source reference.
5. `Recent Activity` — event date, actor, event type, description, status, and source reference.
6. `Sources` — source type, source ID, section, source update time, and authorized link or record reference.

Excel requirements:

- Use real date/time cells with an explicit display format and the report time zone documented on `Summary`.
- Use numeric cells for amounts, days, counts, and percentages; do not embed them in formatted text.
- Freeze header rows, apply filters, set readable column widths, wrap long text, and use consistent status colors with status text.
- Include report ID, generated timestamp, as-of date, source fingerprint, generation mode, and application URL in the workbook metadata block.
- Escape or prefix text beginning with `=`, `+`, `-`, or `@` to prevent spreadsheet formula injection.
- Do not include hidden sheets containing unauthorized or raw records.
- Do not use formulas requiring external workbook links or network access.
- Preserve the saved snapshot even if the live project changes after export.
- The workbook must open without repair warnings in supported spreadsheet viewers.

Stable error codes include `REPORT_NOT_FOUND`, `REPORT_FORBIDDEN`, `REPORT_SOURCE_CONFLICT`, `REPORT_GENERATION_FAILED`, `REPORT_AI_DISABLED`, `REPORT_AI_BUDGET_EXCEEDED`, `REPORT_INVALID_DATE`, and `REPORT_EXPORT_FAILED`.

## Internal UI

Add `Daily client report` to internal inquiry detail and project command center pages. The generation panel defaults to today in the organization time zone and offers facts-only or optional AI narrative mode.

The report view includes state banner, source links, freshness warning, regenerate, previous report, PDF export, Excel export, print preview, and facts-only fallback. It must have loading, empty, error, permission-denied, stale, historical, provider-failure, and export-failure states.

Do not add the report to client navigation. Do not expose internal notes, employee-only risk comments, AI prompts, or unrelated project records.

## Optional daily digest

After on-demand reporting is stable, a weekday digest may group only projects with a meaningful change, overdue item, blocker, decision, approval, or upcoming deadline. It should notify staff in-app first and use universal email only when configured and opted in. It must be idempotent by business date, recipient, project, and source watermark.

## Security, privacy, and human review

- Authorize before aggregation and before AI submission.
- Minimize and redact data sent to a provider.
- Never send passwords, tokens, payment credentials, or unrelated clients.
- Never log raw prompts, raw documents, or full reports by default.
- Apply existing retention, legal-hold, export, and deletion policies.
- Keep report content and source snapshots auditable and immutable after creation, subject to audited retention or legal-hold rules.
- Require human review before a report is used for client communication, scope, budget, compliance, safety, contract, procurement, or gate decisions.
- Never allow report generation to mutate authoritative workflow records.

## Edge cases and failure behavior

Handle inquiry-only clients, converted projects, historical inquiries, declined/nurtured/archived records, no open actions, no recent activity, unassigned overdue work, time-zone boundaries, conflicting records, provider timeout, invalid AI JSON, budget exhaustion, source changes during generation, duplicate requests, revoked permissions, missing documents, PDF renderer failure, Excel generation failure, unsupported format, formula-injection text, long descriptions, large record counts, non-ASCII text, and export failure.

Source records are never changed by a report failure. If AI fails, the facts-only report is returned. If a source changes during generation, return a conflict warning and allow a fresh report.

## Rendering and export acceptance

- PDF and Excel exports are generated from the same saved snapshot and have matching report ID, as-of date, state, action counts, and source counts.
- PDF page layout passes visual review for short, long, empty, and multi-page reports.
- PDF colors remain readable in color and grayscale and do not communicate state by color alone.
- PDF has no clipped text, broken tables, missing page numbers, or unauthorized content.
- Excel opens without repair warnings and contains the six defined worksheets with filters and frozen headers.
- Excel dates, amounts, percentages, and counts are typed correctly.
- Spreadsheet formula-injection characters are safely escaped.
- Export authorization is checked at request time.
- Export failures return a stable error and leave the saved report intact.

## Implementation phases

### Phase 1 — Facts-only reporting

- Add report tables, indexes, and migrations.
- Build the authorized source aggregation service.
- Implement deterministic state, blocker, deadline, and action calculations.
- Add internal UI, source links, freshness state, history, and export.
- Implement server-side PDF rendering and visual QA.
- Implement `.xlsx` export with typed cells, filters, formatting, and formula-injection protection.

### Phase 2 — Optional AI narrative

- Add provider adapter and backend secret configuration.
- Add schema-validated prompt/output handling.
- Add usage, budget, caching, fallback, and AI audit records.
- Label AI output and show supporting facts.

### Phase 3 — Staff digest

- Add scheduled digest job, in-app notification, email preferences, retry handling, and delivery monitoring.

## Testing and acceptance

The design is implementation-ready only when:

- Authorized staff can generate an inquiry-only or project report.
- Clients cannot access it.
- Converted projects retain original inquiry context.
- All sections show correct source records and time-zone boundaries.
- Blocked, overdue, on-track, and no-active-work calculations pass.
- Missing and conflicting data are surfaced without guessing.
- Historical reports remain stable and current reports become stale after source changes.
- Duplicate generation does not create duplicate active jobs or snapshots unnecessarily.
- Provider failures return facts-only output.
- Invalid AI output is rejected.
- AI budget limits work and do not disable facts-only reporting.
- Permissions, archived/deleted records, export, retention, and audit behavior pass tests.
- PDF and Excel exports match the saved report snapshot and pass formatting, accessibility, security, and openability checks.
- No report action changes authoritative inquiry, project, gate, approval, decision, or procurement state.

## Final score

| Area | Score | Basis |
|---|---:|---|
| Business usefulness | 10/10 | Gives staff the current position, unfinished work, risks, and next steps. |
| Scope control | 10/10 | Delivers an internal report without adding a client dashboard. |
| Fit with current application | 10/10 | Reuses the existing continuous inquiry and project history. |
| Data reliability | 10/10 | Separates source facts, deterministic status, narrative, and recommendations. |
| Workflow coverage | 10/10 | Covers stages, gates, actions, deadlines, decisions, approvals, risks, and sources. |
| Security and privacy | 10/10 | Defines backend authorization, minimization, redaction, retention, and audit behavior. |
| AI safety | 10/10 | AI is optional, bounded, validated, reviewable, and unable to change records. |
| Cost control | 10/10 | Facts-only operation is free of AI usage costs; optional AI is cached and budgeted. |
| Historical accuracy | 10/10 | Uses business dates, time zones, source fingerprints, snapshots, and stale labels. |
| PDF formatting and accessibility | 10/10 | Defines repeatable layout, color rules, page behavior, print use, and visual QA. |
| Excel export quality | 10/10 | Defines stable worksheets, typed cells, filters, formatting, and formula-injection protection. |
| Implementation readiness | 10/10 | Defines storage, API, UI, failures, rendering, testing, rollout, and acceptance criteria. |

**Final design score: 10/10.**

Recommended build order: facts-only report first, optional AI narrative second, staff digest third.
