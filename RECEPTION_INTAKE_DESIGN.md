# Reception Intake — Implementation-Ready Product Design

## 1. Purpose and design principles

Reception Intake is the controlled path from a new lead to a Design-ready project. It should capture enough verified context for Design to begin work without exposing every internal Reception note.

The workflow follows these principles:

- A site meeting is evidence, not approval.
- Multiple meetings and communications are expected.
- ROM approval and Design Agreement acceptance are explicit decisions.
- Unknown information is visible and owned rather than silently omitted.
- Files remain available throughout intake.
- Compliance suggestions require representative review before becoming official.
- Frontend display and backend gates must use the same source of truth.

## 2. Organized requirements

### 2.1 Pre-design discovery

Capture the property and governing context before Design begins:

- Municipality / jurisdiction
- Development, community, and sub-community
- HOA or ARC ownership and contact path
- Compliance categories that may affect the project
- Links to applicable municipal, community, HOA, and ARC requirements
- Whether the address is ready for compliance verification
- Compliance follow-up state: not required, TBD, or verified
- If TBD: follow-up owner, due date, and next action
- Pre-design scheduling is for phone calls with the potential client only. It is not a site-meeting tracker.

Discovery values use one of these states:

| State | Meaning | Blocks handoff? |
|---|---|---:|
| Confirmed | Representative has verified the value | No |
| TBD — follow-up required | Unknown and assigned to an owner | Depends on the field |
| Not applicable | Representative confirmed it does not apply | No |
| Verified | Source or document has been reviewed | No |
| Blocked | Required information is missing or contradictory | Yes |

TBD values must display an amber/red alert marker, owner, due date, and follow-up action. A blank field without an explanation is not a valid workflow state.

### 2.2 Compliance verification

The **Verify compliance categories** action uses the project address as the lookup key. It must return or record:

- Verification status: Not started / In progress / Needs review / Verified / Failed
- Lookup timestamp
- Lookup source and source URL
- Categories returned
- Documents or links returned
- Representative reviewer
- Review date
- Review notes

The first automated version may use an internal lookup service. Automated scraping of public compliance links is an assisted capability only; AI suggestions must be reviewed and accepted by a representative before they become official project data.

### 2.3 Pre-design calls, site meetings, and communications

Pre-design discovery includes a dedicated **Phone call tracker** for scheduling and recording conversations with the potential client. These calls establish interest, goals, budget, timing, and decision-makers before any site visit is planned.

The later **Site Meetings** section is a separate chronological activity log for in-person site meetings only. It supports:

- Site meetings after pre-design discovery
- Scheduled, completed, and cancelled status
- Outcome and notes
- Next step
- Follow-up date/timeframe
- Activity owner
- External participants
- Internal notification recipients
- Related files and compliance links

Phone calls remain visible in the inquiry activity history, but they do not satisfy the completed-site-meeting requirement. Video calls, HOA / ARC communications, and municipal communications may still be recorded as supporting activities through the underlying activity model; they are not presented as site-meeting scheduling options.

The next-action list must include **Contact HOA/ARC regarding compliance details**.

#### Activity data model

Each activity should have structured fields rather than encoding type in the title:

```text
id
inquiryId
type: SITE_MEETING | PHONE_CALL | VIDEO_CALL | HOA_ARC | MUNICIPAL | OTHER
status: SCHEDULED | COMPLETED | CANCELLED
startAt
endAt
ownerId
externalParticipants[]
internalFollowers[]
subject
outcome
nextAction
nextActionDueAt
cancellationReason
relatedDocumentIds[]
createdBy
createdAt
updatedAt
```

Activity forms must change based on type. Site meetings may ask about site conditions and feasibility; HOA/ARC communications should ask about request, response, documents requested, and expected response date; phone calls should focus on subject, decision, and follow-up.

Cancelled activities require a reason. A cancelled activity is resolved for history purposes, but it does not satisfy the completed-site-meeting requirement unless a completed site meeting also exists.

### 2.4 ROM and Design handoff

Design handoff is gated by explicit ROM and agreement decisions, not by the existence of one site meeting.

Required handoff fields:

```text
romAmountOrRange
romStatus: DRAFT | PRESENTED | APPROVED | REJECTED | NEEDS_REVISION
romDecisionAt
romApprovedBy
designAgreementStatus: NOT_REQUIRED | PENDING | ACCEPTED | DECLINED
designAgreementAcceptedAt
designAgreementAcceptedBy
handoffApprovedAt
handoffApprovedBy
handoffSummary
optionalNarrative
optionalProposalContext
```

The current generic client-response field must not be used as a substitute for the ROM approval and Design Agreement records.

## 3. Information architecture

1. **Intake** — lead, ownership, property, source, and next action.
2. **Pre-design discovery** — project brief, property context, community/HOA/compliance context, and discovery answers.
3. **Site Meetings** — chronological activities, follow-ups, participants, and outcomes.
4. **Files** — surveys, rules, site photos, correspondence, and supporting evidence; always available.
5. **ROM & Design handoff** — ROM decision, agreement acceptance, scoped summary, and conversion approval.

## 4. Roles and information access

Design access must be scoped to the information needed to perform Design work. Reception-only notes must not automatically flow into the Design workspace.

| Information | Reception | Design | Management |
|---|---|---|---|
| Client contact information | Read/write | Read | Read |
| Property and jurisdiction | Read/write | Read | Read |
| Discovery summary | Read/write | Read | Read |
| Internal Reception notes | Read/write | No access by default | Read |
| Compliance records and approved links | Read/write | Read | Read |
| Unreviewed AI suggestions | Read/write | No access by default | Read |
| Site meeting outcomes | Read/write | Read | Read |
| ROM approval and agreement status | Read/write | Read | Read |
| Handoff summary | Read/write | Read/write after handoff | Read |

The access model should support project-level exceptions, but every exception must be auditable.

Current application mapping: `ADMIN` is the internal Reception/Design role and `CLIENT` is the external role. Internal users receive the full inquiry workflow, while client inquiry responses are projected to client-visible fields only. Separate Reception and Design internal roles, plus auditable project-level exceptions, remain a later authorization release.

## 5. Phase gates and state machine

### 5.1 Discovery gate

The record may move into qualification when the core discovery answers are complete. Compliance fields may remain TBD only when:

- The TBD state is explicit.
- A follow-up owner and due date exist.
- The field is not designated as a handoff blocker.

### 5.2 Site Meetings gate

The phase is complete when:

1. At least one completed site meeting has a meaningful outcome.
2. Every scheduled site meeting is either completed or cancelled with a reason.
3. Feasibility and site assessment notes are recorded.
4. All client information requests are resolved.
5. Any compliance item designated as handoff-blocking is verified or formally approved as an exception.

Phone calls, HOA/ARC communications, and municipal communications enrich the record but do not replace the completed site-meeting requirement.

### 5.3 ROM and Design handoff gate

The record is ready for Design only when:

1. ROM amount or range is recorded.
2. ROM status is **APPROVED**.
3. ROM approval date and approving party are recorded.
4. Design Agreement status is **ACCEPTED**, unless explicitly marked **NOT_REQUIRED**.
5. The handoff summary is complete.
6. The handoff is explicitly approved by an authorized internal user.

A completed site meeting, uploaded file, or written client response alone must never unlock Design.

### 5.4 State transitions

```text
NEW
  -> IN_REVIEW when the initial contact and ownership requirements are complete
IN_REVIEW
  -> QUALIFIED when pre-design discovery requirements are complete
QUALIFIED
  -> CONVERTED when the Site Meetings, feasibility, ROM, agreement, and Design handoff gates are complete
Any open phase
  -> NURTURED or DECLINED with a required reason
```

The backend must enforce these transitions. The frontend should display backend-provided blockers rather than independently duplicating gate logic.

## 6. Interaction design

- Use neutral empty states for information that is not yet due.
- Use amber for follow-up required and red for overdue or blocking items.
- Show the owner and due date beside every follow-up.
- Keep activity history chronological, with filters for type, status, owner, and overdue items.
- Display type, participants, date/time, status, outcome, next step, and follow-up date in each activity row.
- Use type-specific forms for site meetings, phone calls, and HOA/ARC communications.
- Use dropdowns for controlled values and a plus button for repeatable specifics such as compliance questions, missing documents, and follow-up actions.
- Keep Files outside phase locking so Reception can upload evidence at any time.
- Make the next action visible in both the intake list and the activity record.
- Provide keyboard access, visible focus states, labels for all controls, and non-color-only alert indicators.
- Mark essential controls with a visible Required label and non-color status indicators.

## 7. Acceptance criteria

### Discovery and compliance

- Pre-design discovery highlights the essential questions required for qualification and keeps its scheduler limited to phone calls with the potential client.
- A user can record municipality, development, sub-community, HOA/ARC contact, categories, and links.
- A missing compliance value can be marked TBD with an owner and due date.
- TBD compliance items remain explicit until the follow-up is completed or the context is marked not required.
- Verify compliance categories records status, timestamp, sources, returned categories, and reviewer.
- AI or scraped suggestions cannot become official without representative review.

### Activities

- A user can create multiple activities for one inquiry.
- Site meetings, phone calls, video calls, HOA/ARC, and municipal communications have distinct types.
- A user can complete or cancel an activity; cancellation requires a reason.
- Each activity records owner, participants, outcome, next step, and follow-up date.
- Activity-specific forms do not display irrelevant site-meeting fields.

### Gates and handoff

- One completed site meeting does not complete the phase if another scheduled meeting remains open.
- A cancelled site meeting does not satisfy the completed-site-meeting requirement.
- ROM approval requires an approved status, date, and approving party.
- Design Agreement acceptance is required unless marked not required.
- The backend rejects conversion when any handoff blocker remains.
- The Design user receives only the approved handoff scope.

### Security and audit

- Reception-only notes are not visible to Design by default.
- Access exceptions are logged.
- ROM approval, agreement acceptance, compliance review, and handoff approval are auditable.

## 8. Recommended rollout

### Release 1 — data and gate foundation

- Add dedicated ROM approval and Design Agreement fields.
- Add structured activity type, participant, follow-up, and cancellation fields.
- Define and enforce the phase gates in the backend.
- Add a pre-design phone-call tracker and keep Site Meetings as a later, site-meeting-only phase.
- Add jurisdiction/community/HOA/compliance fields.
- Add the HOA/ARC next-action option.

### Release 2 — verification and notifications

- Add address-based compliance lookup.
- Add compliance source links and verification history.
- Add participant subscriptions and email/text update preferences.
- Add filters and overdue views for Site Meetings.

### Release 3 — scoped access and AI assistance

- Add Design-specific field visibility.
- Add reviewed AI suggestions for public compliance links.
- Add audit history for access and AI-suggested compliance records.
- Add project-level access exceptions with management approval.

## 9. Audit status

This document is implementation-ready when the following are resolved:

- Dedicated ROM and Design Agreement data model
- Structured activity data model
- Compliance lookup result model
- TBD and follow-up model
- Role/access matrix enforcement
- Backend gate tests and end-to-end acceptance tests

## 10. Current implementation status

The local implementation now covers the Release 1 foundation and the core handoff behavior described above:

- Dedicated ROM, Design Agreement, handoff summary, and compliance verification fields are persisted and included in the Phase 4 conversion gate.
- Activities support site meetings, phone calls, video calls, HOA/ARC communication, municipal communication, and other follow-up activity types.
- Pre-design discovery provides a phone-call-only scheduler; site-meeting scheduling is kept in the later Site Meetings phase.
- Multiple site meetings are allowed; the Phase 3 gate requires every scheduled site meeting to be resolved and at least one completed site meeting outcome.
- Site-meeting outcomes use structured decision, readiness, condition, next-step, and repeatable-specific fields. Other activities use a focused generic outcome form.
- Files remain available independently of phase locking.
- Compliance verification is a representative-reviewed action and is required when the discovery record identifies applicable compliance context.
- Compliance context supports an explicit TBD state with follow-up owner, due date, and action; TBD remains a Phase 3 blocker.
- The approved handoff summary is carried into the created Design project record; internal Reception-only fields are not copied into that project summary.
- Client-facing inquiry responses hide internal owner, next-action, approval, reviewer, and non-client-visible work-item fields.
- Backend gate tests cover multiple meetings, cancellation, non-site activity separation, compliance verification, and ROM handoff requirements.
- API acceptance tests cover compliance validation, structured activity persistence, and client field projection.

Validation completed locally:

- Prisma migration deployment and workflow backfill succeeded.
- Frontend production build succeeded.
- Backend production build and TypeScript checks succeeded.
- The complete backend suite passes, including the repository-wide security/operations coverage and the new reception gate/API acceptance tests.
- API liveness/readiness, admin login, and authenticated inquiry retrieval smoke checks succeeded.

The remaining Release 2 and Release 3 items are intentionally deferred capabilities rather than blockers for the current local implementation: automated jurisdiction lookup, notification preferences, activity filtering, reviewed AI suggestions, and project-level access exceptions. Those should be completed before a production rollout that requires those capabilities.
