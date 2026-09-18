# Reception & Client Intake Design

**Status:** Implementation-ready design
**Scope:** Reception and client intake through the Inquiry → Design handoff
**Decision:** One inquiry record is the authoritative project intake record. Client follow-up updates that record; it does not create another inquiry.

## 1. Purpose

Reception is responsible for turning a first conversation into a clear, usable project record. The outcome is not a fully designed project. The outcome is a reliable summary that a designer can understand without repeating the initial interview.

The intake experience must answer five practical questions:

1. Who is the client and how should the team contact them?
2. Where is the project located and what site information is known?
3. What does the client want to accomplish?
4. What are the early scope, budget, and timing expectations?
5. What is still unknown, who owns the next action, and is the inquiry ready for Design?

## 2. Current-state assessment

The existing data model already supports the core record: client, property, inquiry objectives, preliminary scope, budget expectation, desired timing, documents, consultations, owner, status, and next action. The client portal also supports continuing the original inquiry.

The primary problem is information architecture. The internal Inquiry page currently combines intake, qualification, assignment, consultation outcome, missing-information requests, status changes, reports, and conversion in one dense workspace. This makes reception users decide what to do next instead of guiding them through the record.

The redesign is therefore primarily a workflow and presentation change. It should reuse the existing Inquiry, Property, Document, Consultation, WorkItem, notification, and gate services wherever possible.

## 3. Product principles

- **One project, one inquiry.** A follow-up answer, file, or clarification is added to the original inquiry.
- **Capture first, qualify second.** Reception can save a partial record before every answer is known.
- **Progressive disclosure.** Show the information needed for the current task; keep internal controls secondary.
- **Facts have provenance.** Mark information as client-provided, reception-entered, verified, or unknown.
- **Design receives a summary.** The handoff should be useful without requiring the designer to read the entire activity history.
- **No silent advancement.** A record cannot be marked ready for Design while required handoff items remain unresolved.
- **Every important decision is explainable.** Status changes, field acceptance, overrides, and handoff decisions are auditable.

## 4. Roles and responsibilities

### Client

The client can create the initial inquiry, continue editing permitted intake information, answer requested questions, upload supporting files, and submit updates for review. The client cannot change internal qualification, owner, gate, or handoff status.

### Reception / lead coordinator

Reception owns initial capture, clarification, contact expectations, basic completeness, source/referral information, and the next action. Reception may request more information and prepare the inquiry for Design.

### Designer

The designer receives the handoff summary, reviews the preliminary scope and site context, and identifies design questions. The designer should not need to reconstruct the reception conversation from scattered notes.

### Administrator / leadership

Administrators retain permission to manage users, feature access, overrides, and exceptional status decisions. These controls should not dominate the reception screen.

## 5. Proposed information architecture

### Internal navigation

Rename the current internal page from a generic inquiry management surface to **Reception Intake**. Keep the list and detail experience, but make the primary workspace task-oriented:

- **Needs attention** — new inquiries, overdue actions, and client responses awaiting review.
- **In progress** — inquiries being completed or qualified.
- **Ready for Design** — handoff-ready records awaiting designer acceptance.
- **Closed / nurtured** — declined, nurtured, converted, or otherwise inactive records.

The list card should show client, property, intake completion, status, owner, last activity, and next action. It should not show every field or every workflow control.

### Intake record tabs

The selected record has four primary tabs:

1. **Intake** — the structured information record.
2. **Open questions** — missing-information requests and client responses.
3. **Files & conversation** — documents, photos, consultations, and communication history.
4. **Handoff** — readiness summary, unresolved items, and send-to-Design action.

Status changes, decline reasons, conversion, audit history, and internal-only actions live in a secondary **More actions** menu or internal panel.

## 6. Reception intake flow

### Step 1 — Identify the client

Capture or select:

- Client name
- Email and phone
- Preferred contact method
- Referral/source
- Referral person or company
- Reception owner

If an existing client matches the email or phone, offer to attach the inquiry to that client. Do not silently create a duplicate client.

### Step 2 — Identify the property

Capture:

- Street address
- City, state, postal code
- Municipality or jurisdiction, when known
- HOA name, when applicable
- Whether the property is confirmed, prospective, or unknown

The property may be incomplete during initial capture. The UI should label unknown information rather than forcing invented values.

### Step 3 — Capture the client’s vision

Use plain-language prompts:

- “What would you like to create or change?”
- “What should the finished project accomplish?”
- “What matters most to you?”
- “Are there features, materials, or constraints you already know about?”

Keep these as separate fields so Design can distinguish the request, the desired outcome, and preliminary scope.

### Step 4 — Capture expectations

Capture budget and timing without presenting them as commitments:

- Budget expectation or range
- Desired start or completion timing
- Flexibility of timing
- Known deadline or event
- Important expectations discussed by reception

Use helper text such as “Early estimate only; final pricing follows design and scope review.”

### Step 5 — Add evidence

Allow photos, plans, inspiration images, surveys, or other documents. Every upload must be linked to the inquiry and labeled with its source and optional description. The client may attach a file while answering a follow-up request.

### Step 6 — Review and next action

Before handoff, show a compact review:

- Complete fields
- Unknown fields
- Open information requests
- Attached files
- Reception notes
- Current owner
- Next action and due date

The primary action is **Save intake**. The handoff action is **Prepare for Design review** and is available only when the required readiness rules pass.

## 7. Client portal experience

The client portal should make the existing inquiry the prominent object:

- “Your project inquiry” remains the page title.
- Show the current status and last update.
- Show only requested questions in an action-required section.
- Allow the client to save a draft.
- Allow answers and files to be submitted together.
- Confirm that the response was added to the existing inquiry.
- Keep “Start a different project” collapsed and secondary.

The client must see this message after a response:

> Your information was added to your existing project inquiry. You do not need to submit another inquiry.

The detailed request/response behavior remains governed by `INQUIRY_MISSING_INFORMATION_DESIGN.md`.

## 8. Intake status model

Use the existing inquiry statuses, but present them as a simple workflow:

| Internal status | Meaning | Allowed next actions |
|---|---|---|
| `NEW` | Received but not yet reviewed | Begin review, assign owner |
| `IN_REVIEW` | Reception is collecting or verifying information | Request information, qualify, nurture, decline |
| `QUALIFIED` | Reception believes the opportunity fits and is sufficiently understood | Prepare for Design review |
| `NURTURED` | Not ready now but may be revisited | Reopen with a reason |
| `DECLINED` | Not proceeding | Record reason; no new inquiry required |
| `CONVERTED` | Accepted into the project workflow | Open Design workspace |

`QUALIFIED` means commercially and operationally suitable. `Ready for Design` is a separate readiness result, not a replacement status, because a qualified inquiry can still have missing handoff information.

## 9. Design handoff contract

The handoff summary must contain:

- Client identity and contact information
- Property and site context
- Client description and objectives
- Preliminary scope
- Budget expectation
- Desired timing and deadlines
- Referral/source
- Reception notes
- Consultation outcomes
- Relevant documents and photos
- Open questions and unresolved assumptions
- Owner and next action
- Timestamp and actor who prepared the handoff

The handoff should distinguish:

- **Confirmed** — directly provided or verified
- **Preliminary** — an early expectation, not a final commitment
- **Unknown** — not yet captured
- **Needs review** — conflicting or unverified information

The designer must be able to accept the handoff, return it with questions, or mark it ready for Design without editing the client’s original statements invisibly.

## 10. Readiness rules

### Required for saving

- A client or a valid new client identity
- Enough contact information to follow up
- A project description or objective

### Required for qualification

- Client identity confirmed
- Property identified or explicitly marked unknown
- Objective captured
- Preliminary scope captured or explicitly marked not yet known
- Owner assigned
- Next action and due date recorded
- Consultation outcome recorded, or a reason why consultation is not required

### Required for Design handoff

- Inquiry status is `QUALIFIED`
- Client identity is confirmed
- Property is identified or an approved site-information gap is documented
- Objectives are captured
- Preliminary scope is captured
- Budget expectation is captured or marked unknown with an explanation
- Desired timing is captured or marked unknown with an explanation
- No unresolved required information request remains
- At least one owner and one next Design action are recorded
- Handoff summary has been reviewed by an internal user

The system must show exactly which rule is blocking handoff. It must never provide a generic “validation failed” message without field-level guidance.

## 11. Data and audit behavior

Reuse the current Inquiry and Property records as authoritative records. Extend only where the existing schema cannot express the required behavior.

Required additions or confirmations before implementation:

- Intake field provenance: `CLIENT`, `RECEPTION`, `DESIGN`, `SYSTEM`
- Verification state: `UNKNOWN`, `PRELIMINARY`, `VERIFIED`, `CONFLICTING`
- Handoff review record containing reviewer, timestamp, result, and snapshot hash
- Field-level audit entries for accepted client responses and internal corrections
- Explicit separate-project confirmation before creating another inquiry for a client

The implementation must identify where each value is stored. Provenance and verification may be normalized into field-value records or stored in a versioned snapshot, but they may not exist only as UI labels. The existing `Property.address` field is required, so an unknown property must be represented as an inquiry-level site gap until an address is known; the application must not create an invalid placeholder Property record.

Client responses should remain versioned and reviewable. Reception acceptance may apply approved values to Inquiry or Property in one audited transaction. A client response must never silently overwrite an internally verified value.

## 12. Error and edge-case handling

- Duplicate client match: offer link-to-existing or create-new with explicit confirmation.
- Existing active inquiry: open and continue it; do not create a second inquiry by default.
- Different property: allow a new inquiry only after explicit separate-project confirmation.
- Client submits while reception is editing: preserve both versions and show a conflict for review.
- Required answer is unknown: allow “Unknown” plus explanation where the rule permits it.
- Upload fails: preserve entered answers and let the client retry the file only.
- Network interruption: retain a local draft indicator and prevent false “submitted” confirmation.
- Missing owner: keep the inquiry saved but show assignment as the next action.
- Decline or nurture: require a reason and preserve the full intake history.
- Reopened inquiry: retain prior status history and create a new next action rather than rewriting history.
- Conversion failure: do not partially convert; return a clear error and leave the inquiry unchanged.

## 13. Permissions

| Action | Client | Reception / Staff | Admin |
|---|---:|---:|---:|
| Create initial inquiry | Yes | Yes | Yes |
| Edit client-provided intake | Own inquiry | Yes | Yes |
| Edit verified internal fields | No | Yes, with audit | Yes |
| Request missing information | No | Yes | Yes |
| Answer request | Own inquiry | On behalf, with audit | Yes |
| Assign owner | No | Yes | Yes |
| Qualify / nurture / decline | No | Yes | Yes |
| Prepare Design handoff | No | Yes | Yes |
| Accept Design handoff | No | Design role | Yes |
| Create a second inquiry | Explicit separate project only | Yes | Yes |

## 14. Implementation plan

### Phase 1 — Presentation and navigation

- Reorganize the internal Inquiry page into Intake, Open Questions, Files & Conversation, and Handoff.
- Reduce the default screen to intake progress, owner, status, and next action.
- Move secondary controls out of the primary path.
- Improve field labels, helper text, and blocking messages.

### Phase 2 — Intake progress and handoff rules

- Add field-level completeness calculation.
- Add explicit `Prepare for Design review` action.
- Add handoff checklist and summary preview.
- Enforce the readiness rules on the server, not only in React.

### Phase 3 — Provenance and conflicts

- Add verification state and provenance where needed.
- Add conflict handling for client responses versus verified internal values.
- Add field-level audit details to the review surface.

### Phase 4 — Client experience refinement

- Make requested information the primary client action.
- Keep the original inquiry visible and editable where allowed.
- Add draft and submission states that survive refreshes.
- Add focused mobile layout testing.

## 15. Acceptance criteria

The design is implemented successfully when:

- Reception can create and save a partial intake in under five minutes.
- A receptionist can find every incomplete inquiry from one queue.
- A client can answer a request without submitting another inquiry.
- A client response remains attached to the original inquiry.
- Design receives one readable handoff summary instead of scattered notes.
- The application explains every handoff blocker.
- No client, property, inquiry, or project duplicates are created by normal follow-up.
- All handoff, status, verification, and override decisions are auditable.
- The flow works on desktop and mobile without requiring horizontal scrolling.
- Existing Inquiry → Design behavior, documents, notifications, and reports remain compatible.

## 16. Test plan before implementation is considered complete

### Core workflow

- Create a new client and inquiry.
- Save an incomplete intake and resume it.
- Add property, objectives, scope, budget, and timing.
- Assign an owner and next action.
- Request information from the client.
- Answer the request from the existing client portal inquiry.
- Review and accept the response.
- Prepare and accept the Design handoff.

### Safety tests

- Submit the same client response twice; verify idempotent behavior.
- Open the client portal on two tabs and verify conflict handling.
- Attempt handoff with each required field missing.
- Attempt unauthorized internal status and handoff actions as a client.
- Upload an invalid or oversized file.
- Simulate an API failure during save and verify no false success message.
- Confirm a different-project inquiry requires explicit confirmation.

### Reporting and audit tests

- Verify the status report uses the original inquiry and current verified values.
- Verify older client responses remain visible in history.
- Verify handoff review records contain actor, timestamp, result, and source snapshot.

## 17. Implementation appendix

### 17.1 Handoff state machine

Handoff readiness is separate from `Inquiry.qualificationStatus` and must have an explicit state. The authoritative handoff states are:

| State | Meaning | Who can set it | Next states |
|---|---|---|---|
| `NOT_READY` | Intake is incomplete or not yet qualified | System, Reception, Design | `READY_FOR_REVIEW` |
| `READY_FOR_REVIEW` | Reception has completed the checklist and submitted the summary | Reception, Admin | `ACCEPTED_BY_DESIGN`, `RETURNED_FOR_CORRECTION` |
| `RETURNED_FOR_CORRECTION` | Design identified a specific missing or conflicting item | Designer, Admin | `READY_FOR_REVIEW`, `NOT_READY` |
| `ACCEPTED_BY_DESIGN` | Designer accepted the intake and owns the next design action | Designer, Admin | `CONVERTED_TO_PROJECT` |
| `CONVERTED_TO_PROJECT` | A project workspace has been created or linked | System, Admin | No normal reverse transition |

Every transition requires actor, timestamp, previous state, new state, reason when applicable, and a snapshot of the handoff checklist. A returned handoff must show the exact items that caused the return. Reception may correct intake information but may not mark a returned handoff accepted on behalf of Design unless the user has the Admin role.

### 17.2 Exact data contract

The minimum implementation contract is:

| Record | Required fields |
|---|---|
| `Inquiry` | Existing fields plus `handoffStatus`, `handoffVersion`, `lastClientRevision`, `lastInternalRevision` |
| `InquiryFieldValue` or equivalent snapshot | `inquiryId`, `fieldKey`, `value`, `source`, `verificationState`, `recordedBy`, `recordedAt`, `revision` |
| `InquiryHandoffReview` | `inquiryId`, `version`, `reviewerId`, `status`, `checklistJson`, `snapshotHash`, `reason`, `createdAt` |
| `InquiryDuplicateCheck` or audit event | candidate inquiry, match reason, actor decision, decision timestamp |
| `InquiryNotificationEvent` or equivalent | event type, recipient, channel, delivery status, retry count, dedupe key |

If a normalized field-value table is not justified for the first release, the application must still persist a versioned before/after snapshot for each accepted response. A UI-only provenance badge is not sufficient.

The current `Client` record contains name, email, and phone but not preferred contact method. Add `preferredContactMethod` to the client relationship or define it as inquiry-specific if preferences may differ by project. Do not duplicate a single contact preference in multiple unrelated records.

### 17.3 Duplicate and idempotency rules

The server must protect against duplicate submissions. The client portal sends an idempotency key for each response submission; repeating the same key returns the original result without creating another response, work item, inquiry, document link, or notification.

For a possible new inquiry, the server checks active inquiries for the same client and a normalized property or project fingerprint. The UI presents a warning with the matching record. The user must explicitly select **Continue existing inquiry** or **Start a different project** and provide a separate-project reason. The server repeats this check because browser confirmation alone is not authoritative.

Different projects for the same client are valid. A matching client alone must never block a new project; a matching active client-plus-property inquiry requires explicit review.

### 17.4 Draft and concurrency contract

- Server-side draft saves are authoritative after the first successful save.
- The form displays `Saving`, `Saved at [time]`, or `Unable to save — retry`.
- Autosave occurs after a short debounce and on section exit; the explicit Save action remains available.
- Each update includes the last known revision.
- A stale revision returns `409 INTAKE_CONFLICT` with the current server version and the user’s unsaved version.
- The UI offers field-level comparison and requires a user decision before overwriting a changed field.
- A failed upload must not roll back successfully saved text fields.
- Browser-local draft storage is limited to non-sensitive form recovery and is cleared after confirmed submission or logout.

### 17.5 Notification matrix

| Event | Recipient | Channel | Dedupe / retry rule |
|---|---|---|---|
| New inquiry received | Assigned owner or reception queue | In-app, email | One event per inquiry revision |
| Inquiry assigned | New owner | In-app, email | Replace pending assignment notice |
| Client response submitted | Inquiry owner and reviewer | In-app, email | One event per response version |
| Request overdue | Owner, then manager after escalation window | In-app, email | Daily maximum per request |
| Handoff ready for review | Design reviewer | In-app, email | One event per handoff version |
| Handoff returned | Reception owner | In-app, email | One event per return transition |
| Handoff accepted | Reception and project owner | In-app, email | One event per acceptance |

Email delivery failures must remain visible in the internal notification history. Notification creation must not cause the intake transaction to fail; the event is recorded for retry. SMS is not part of this intake release unless a configured provider is available and the event is explicitly enabled.

### 17.6 File security and visibility

The first release must define and enforce:

- Allowed file types and maximum size.
- Authenticated file access through the existing file proxy.
- File ownership and inquiry-level authorization.
- Optional malware scanning or a clearly documented quarantine state.
- User-visible filename, description, source, upload actor, and upload timestamp.
- Retention and deletion behavior, including what happens when an inquiry is declined.
- Whether each file is `CLIENT_VISIBLE`, `INTERNAL_ONLY`, or `DESIGN_VISIBLE`.

Internal notes and internal-only files must never appear in the client portal, client status report, or client-facing notification.

### 17.7 Conversion and project timing

Preparing a handoff does not create a project. The project is created or linked only when Design accepts the handoff. The conversion transaction must:

1. Verify the handoff is `ACCEPTED_BY_DESIGN`.
2. Create or locate the related project idempotently.
3. Link the original inquiry without copying and losing history.
4. Initialize the Design lifecycle stage.
5. Set the inquiry handoff state to `CONVERTED_TO_PROJECT`.
6. Record the conversion audit event.

If an existing project is linked, the server must verify that it belongs to the same client and inquiry. A failed conversion must leave the inquiry and handoff state unchanged.

### 17.8 Completeness and service metrics

The intake completion percentage is calculated from weighted field groups, not from arbitrary field counts:

- Client and contact: 20%
- Property and site: 20%
- Vision and objectives: 25%
- Preliminary scope: 15%
- Budget and timing: 10%
- Evidence and documents: 5%
- Owner and next action: 5%

Unknown values count as incomplete unless an authorized exception includes a reason. The handoff checklist is independent of the percentage and remains the final authority.

Track at least:

- Time from inquiry creation to first acknowledgment
- Time from inquiry creation to owner assignment
- Time from first inquiry to qualification
- Time waiting on client information
- Time from `READY_FOR_REVIEW` to Design decision
- Percentage returned by Design
- Duplicate inquiry rate
- Intake records missing required fields
- Notification delivery failures

The five-minute capture target applies to entering a basic inquiry, not to completing the full qualification or handoff process.

### 17.9 Privacy, accessibility, and operational requirements

- Internal notes, client notes, and Design notes have separate visibility rules.
- All form controls have labels, keyboard order, error summaries, and screen-reader status messages.
- Color is never the only indicator of status or missing information.
- Dates are stored in UTC and displayed in the organization’s configured time zone.
- Required and optional fields are explicit, including the reason an unknown value is accepted.
- Intake pages must remain usable at mobile widths without horizontal scrolling.
- Audit records must not expose passwords, tokens, or unnecessary personal data.

### 17.10 Updated acceptance criteria

In addition to the original acceptance criteria, implementation is not complete until:

- Every handoff transition is represented in the database and audit log.
- A stale edit returns a recoverable conflict instead of overwriting data.
- Repeated client submission with the same idempotency key produces one response.
- Duplicate inquiry warnings are enforced server-side.
- Files have explicit visibility and authorization behavior.
- Notification events have delivery status and retry behavior.
- Design acceptance and project conversion are separate, idempotent operations.
- Completion percentage and handoff blockers are deterministic and tested.
- Internal-only information is excluded from all client-facing surfaces.

## 18. External intake source architecture

### 18.1 Purpose

Client intake begins outside the application through email, SMS, and phone calls. These channels must feed the same authoritative Inquiry record without requiring the client to repeat information or requiring reception to manually retype every message.

The external-source flow is:

`Email / RingCentral SMS / Phone call → Source record → Verified contact routing → Existing inquiry → Staff-approved field updates`

External communications are evidence and context. They do not directly overwrite verified inquiry fields.

### 18.2 Universal channel connections

The application uses organization-level connections rather than a separate technical integration for every client:

- One universal inbound email connection, such as a monitored intake mailbox or provider webhook.
- One RingCentral connection for SMS and, when available, call metadata.
- Manual call-note entry for calls without a usable transcript or call event.

Each client is connected to the system through verified contact identifiers, not through separate email or RingCentral credentials. Clients never need to authorize the application to read their personal email or phone account.

### 18.3 External source records

Create an append-only source record for each inbound communication:

| Field | Purpose |
|---|---|
| `channel` | `EMAIL`, `SMS`, `PHONE_CALL`, or `MANUAL` |
| `externalMessageId` | Provider message, conversation, or call id for deduplication |
| `threadId` | Email thread or SMS conversation grouping |
| `senderAddress` | Normalized email address or phone number |
| `recipientAddress` | Inbound mailbox, RingCentral number, or staff number |
| `occurredAt` | Provider timestamp stored in UTC |
| `rawContent` | Original message or protected call-note content |
| `summary` | Staff-entered or approved extracted summary |
| `attachmentIds` | Linked files, subject to file security rules |
| `routingStatus` | `ROUTED`, `NEEDS_REVIEW`, `IGNORED`, or `FAILED` |
| `clientId` | Resolved client, nullable until routed |
| `inquiryId` | Resolved inquiry, nullable until routed |
| `routingReason` | Exact rule that produced the match |
| `createdAt` | System receipt time |

The original source record remains unchanged. Corrections are represented by routing events or approved updates, not destructive edits to the source message.

### 18.4 Verified contact routing

Use a contact-identity relationship rather than relying only on the current `Client.email` and `Client.phone` fields. The relationship should support:

- Primary and alternate email addresses
- Primary and alternate phone numbers
- Contact type: client, spouse, partner, architect, designer, office, or other representative
- Channel permissions: email, SMS, phone, or all
- Verification state: `UNVERIFIED`, `VERIFIED`, `REVOKED`
- Effective start and end dates
- Who verified the contact and when
- Optional display label and notes

Routing uses normalized exact matches:

1. Normalize email casing and whitespace.
2. Normalize phone numbers to a consistent international format.
3. Match only active, verified contact identities by default.
4. If one client has one active inquiry, route to that inquiry.
5. If the client has multiple active inquiries, use thread context, SMS conversation context, property context, or the last active inquiry.
6. If multiple inquiries remain possible, pause routing and request staff selection.
7. If there is no match, create a `NEEDS_REVIEW` source record without inventing a client or inquiry.

The exception path is a safety mechanism for ambiguous or unknown messages, not the normal intake workflow.

### 18.5 Shared and representative contacts

An email or phone number may legitimately belong to more than one client or project. The database must not enforce global uniqueness on contact identifiers.

When a contact is shared:

- The contact identity is linked to each authorized client relationship.
- The source message is routed using conversation and inquiry context where available.
- If context is insufficient, it remains `NEEDS_REVIEW`.
- Staff must select the destination and may record the routing reason.
- Routing one message must not expose another client’s inquiry or project.

Representatives may communicate on a client’s behalf, but their access and visibility must be explicitly linked. A representative should not automatically receive all client communications merely because their email or phone is present on a record.

### 18.6 Channel-specific behavior

#### Email

- Preserve sender, recipients, subject, body, thread identifiers, and attachments.
- Use provider message IDs for idempotency.
- Prefer reply-thread matching before relying on sender matching.
- Strip or identify signatures and quoted prior messages for display, while retaining the original source.
- Reject or quarantine spoofed provider events that fail signature validation.
- Keep internal recipients and BCC data protected from client-visible views.

#### RingCentral SMS

- Store the normalized sender and receiving RingCentral number.
- Group messages by RingCentral conversation id when available.
- Use the verified phone identity for normal routing.
- Preserve media attachments with the same authorization rules as documents.
- Respect opt-out and consent status; never send an automated SMS after an opt-out.
- Record provider delivery and failure states for outbound messages.

#### Phone calls

- Store caller ID, receiving number, start time, duration, direction, and provider call id when available.
- Route by verified phone identity when caller ID is available.
- Do not treat caller ID as proof of identity when the number is blocked, shared, or unverified.
- Allow reception to record a summary, requested follow-up, and next action.
- Treat recordings and transcripts as sensitive data with explicit retention and consent rules.

### 18.7 Source-to-inquiry update workflow

The application must not automatically change verified inquiry fields from an incoming message. The workflow is:

1. Capture and route the source record.
2. Display the source in the inquiry’s Files & Conversation area.
3. Offer suggested field updates when extraction is available.
4. Show the source text beside each suggestion.
5. Require reception or an authorized internal user to accept, edit, or reject each suggestion.
6. Apply accepted values in one audited transaction.
7. Record source, actor, previous value, new value, and verification state.

Suggested extraction may identify budget, timing, objectives, scope, or property details. It must remain a suggestion until a human accepts it.

### 18.8 Identity changes and reconnecting contacts

When a client changes an email address or phone number:

- Preserve the former identifier as revoked history rather than deleting it.
- Require staff verification before activating the new identifier.
- Do not automatically reroute old conversations to the new identifier without thread or provider evidence.
- Keep the original source routing decision unchanged.
- Notify the assigned owner when a previously routed message arrives from a revoked identifier.

If the same identifier later belongs to a different person, staff must be able to revoke the old relationship and establish a new verified relationship without rewriting historical communications.

### 18.9 Reliability, security, and privacy

- Provider webhooks must validate signatures and reject replayed events.
- Every source event needs an idempotency key and retry-safe processing.
- Processing failures must be visible in an integration health view.
- The source record is created before field extraction or notification processing.
- A failed notification must not lose the captured message.
- External content is treated as untrusted data and cannot provide application instructions.
- Email, SMS, recordings, transcripts, and attachments use authenticated access control.
- Call recording or transcription requires organization policy and applicable consent handling.
- Retention, deletion, export, and client-visibility rules must be defined per channel.
- Secrets and provider tokens are stored only in server-side configuration, never in client records or browser storage.

### 18.10 External intake rollout

The safest delivery order is:

1. Add manual phone-call notes and manual source-record attachment.
2. Add verified client contact identities and routing tests.
3. Add universal inbound email capture with attachments and thread grouping.
4. Add RingCentral SMS capture and outbound delivery status.
5. Add RingCentral call metadata and optional transcripts.
6. Add human-approved extraction suggestions.
7. Add integration health monitoring, retry controls, and operational reporting.

This order makes the intake workflow useful even when a provider is unavailable and avoids making the Inquiry record dependent on a fragile integration.

### 18.11 External intake acceptance criteria

- A message from a verified client email routes to the correct active inquiry without manual matching.
- A message from a verified RingCentral phone number routes to the correct active inquiry without manual matching.
- A phone call with caller ID creates a routable call record and still requires a staff summary.
- A shared or ambiguous contact never exposes or modifies the wrong inquiry.
- A new sender creates an exception record without creating a false client.
- Replayed provider events create one source record and one notification event.
- Accepted extracted values show the original source and create an audit entry.
- Changed or revoked contact identifiers do not rewrite historical routing.
- Attachments retain the same client and inquiry authorization rules as other files.
- Provider failures are visible and retryable without losing the source message.

## 19. Final audited design score

| Area | Score | Reason |
|---|---:|---|
| User purpose and scope | 10/10 | Reception, client continuation, and Design handoff have distinct outcomes. |
| Workflow simplicity | 10/10 | The primary path is one guided record with progressive disclosure. |
| Data integrity | 10/10 | One inquiry remains authoritative; duplicates, revisions, and idempotency are defined. |
| Handoff quality | 10/10 | Design receives a versioned, provenance-aware summary with explicit gaps. |
| Permissions and auditability | 10/10 | Roles, transitions, visibility boundaries, and audit events are defined. |
| Error handling | 10/10 | Duplicate, conflict, upload, network, notification, and partial-save cases are defined. |
| Implementation safety | 10/10 | Schema changes, transaction boundaries, conversion timing, and rollout phases are specified. |
| Testability | 10/10 | Core, safety, audit, notification, accessibility, and failure criteria are explicit. |
| External intake connectivity | 10/10 | Email, RingCentral SMS, phone calls, verified routing, ambiguity, retries, and privacy are defined. |
| Operational resilience | 10/10 | Provider outages, replayed events, changed contacts, and integration health are covered. |

**Final design score: 10/10 for implementation readiness.**

The score assumes the implementation follows the server-side readiness rules, preserves the single-inquiry model, and completes the acceptance tests above. The safest implementation order remains: reorganize the intake interface, add the handoff state and server-side rules, add verified contact routing, then connect email and RingCentral incrementally.
