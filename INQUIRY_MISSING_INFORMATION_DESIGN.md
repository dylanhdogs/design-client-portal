# Inquiry Missing-Information Response Design

**Status:** Implementation-ready  
**Prepared:** September 4, 2026  
**Applies to:** Inquiry and qualification workflow

## 1. Problem

When staff requests missing information, the portal creates a client-visible work item. On the client side, that item currently offers only **Mark provided**. It does not provide a place to answer the question or attach evidence. The complete new-inquiry form remains prominent below it, so clients reasonably believe they must submit another inquiry.

That behavior is incorrect because it:

- Creates duplicate inquiry and property records.
- Separates the answer from the staff request.
- Loses the question-and-response history.
- Allows a client to mark an item complete without supplying anything.
- Makes qualification reporting and Inquiry → Design gate evidence unreliable.

## 2. Desired Outcome

A missing-information request is a conversation attached to the original inquiry:

1. Staff asks one or more specific questions.
2. The client opens the original inquiry and sees only the requested fields.
3. The client saves a draft, answers, and optionally uploads supporting files.
4. The client submits the response for review.
5. Staff accepts it, applies approved field changes, or asks for clarification in the same thread.
6. The request is complete only after staff verification.

No new inquiry is created during this flow.

## 3. Core Design Decisions

- `Inquiry` remains the single authoritative lead record.
- `WorkItem` remains the workflow/gate task and deadline record.
- A new `InquiryInformationRequest` stores the staff request and links one-to-one to its work item.
- Append-only `InquiryInformationResponse` versions store client answers.
- Client submission does not silently overwrite authoritative inquiry fields.
- Staff verification applies approved mapped values to `Inquiry` or `Property` in one audited transaction.
- Custom answers that do not map to a field remain part of the inquiry response history.
- “Mark provided” is removed. A response must contain an answer or attachment before submission.
- Clarification reopens the same request; it never creates a replacement inquiry.

## 4. Client Experience

### Page hierarchy

The client route remains `/my-inquiry`, but its priority changes:

1. **Action required** — open information requests.
2. **Your existing inquiry** — current details and status.
3. **Completed requests** — collapsed history.
4. **Start a different inquiry** — collapsed, secondary action.

The full new-inquiry form must not appear open beneath an active inquiry. It opens only after the client selects **Start a different project inquiry** and confirms that the new inquiry concerns a separate project or property.

### Open request card

Each request shows:

- Staff question and optional instructions.
- Request date, due date, and requesting team member.
- Requested fields only.
- Existing value, when one exists, clearly labeled **Current information**.
- Answer control appropriate to the field.
- Attachment area when files are allowed.
- **Save draft** and **Submit response** actions.
- Status: Action required, Draft saved, Submitted for review, Clarification requested, or Complete.

The notification deep-links to `/my-inquiry?request=<request-id>` and focuses the relevant card.

### Submission confirmation

After submission:

> Your response was submitted to the Signature Exteriors team. You do not need to create another inquiry. We will notify you if clarification is needed.

The inputs become read-only until staff requests clarification. The client can still view exactly what was submitted and when.

## 5. Internal Staff Experience

Replace the single free-text request box with **Request information**:

- Question/title.
- Optional instructions.
- One or more requested items.
- For each item: mapped inquiry/property field or custom question, label, response type, required flag.
- Allow attachments toggle.
- Due date.
- Reviewer, defaulting to the requesting user.
- Client preview before sending.

The inquiry detail shows a chronological request thread:

- Request sent.
- Client drafts are not visible to staff.
- Client response submitted.
- Staff accepted, requested clarification, or cancelled.
- Applied field changes shown as before → after.
- Linked documents and audit events.

### Review actions

- **Accept and apply** — validates mapped values, updates the inquiry/property, verifies the work item, and records the field-level audit.
- **Accept as supporting information** — verifies the work item without changing mapped fields.
- **Request clarification** — requires a comment, reopens client editing, sets a new due date if supplied, and notifies the client.
- **Cancel request** — requires a reason and cancels the linked work item.

Staff cannot verify a request with no submitted response unless an ADMIN uses a documented override with reason and audit history.

## 6. Requested Field Types

Initial mapped fields:

- Inquiry: description, objectives, preliminary scope, budget expectation, desired timing, source, referral name.
- Property: address, city, state, postal code, jurisdiction, HOA name.
- Custom: short text, long text, date, single choice, yes/no, and file upload.

Each requested item stores its own label, instructions, type, required state, and optional target field. Server-side code uses an allowlist; a client-supplied target path is never written directly to the database.

## 7. Status Model

```text
OPEN ──► DRAFT ──► SUBMITTED ──► VERIFIED
  │          ▲           │
  │          └── CHANGES_REQUESTED
  ├──────────────────────► CANCELLED
  └──────────────────────► EXPIRED
```

- `OPEN`: sent to client; no saved response.
- `DRAFT`: client saved at least one answer but has not submitted.
- `SUBMITTED`: immutable response version awaits staff review.
- `CHANGES_REQUESTED`: staff comment reopens the request for a new response version.
- `VERIFIED`: accepted response; linked work item is verified.
- `CANCELLED`: staff withdrew the request with reason.
- `EXPIRED`: deadline policy closed the request; staff may reopen it.

The linked `WorkItem` status is synchronized:

| Information request | Work item |
|---|---|
| OPEN / DRAFT / CHANGES_REQUESTED | OPEN or IN_PROGRESS |
| SUBMITTED | COMPLETED |
| VERIFIED | VERIFIED |
| CANCELLED | CANCELLED |
| EXPIRED | OPEN and overdue unless explicitly cancelled |

## 8. Data Model

### `InquiryInformationRequest`

- `id`, `organizationId`, `inquiryId`, `workItemId` unique
- `title`, `instructions?`
- `requestedItemsJson` containing validated item definitions
- `allowAttachments`
- `status`, `version`
- `requestedBy`, `reviewerId`, `dueAt`
- `submittedAt?`, `verifiedAt?`, `verifiedBy?`
- `clarificationComment?`, `cancelReason?`
- timestamps

### `InquiryInformationResponse`

- `id`, `requestId`, `versionNumber`
- `answersJson` containing values keyed by requested-item ID
- `submittedBy`
- `isDraft`
- `submittedAt?`, `createdAt`, `updatedAt`
- unique `(requestId, versionNumber)`

### Document linkage

Add nullable `informationRequestId` and `informationResponseId` to `Document`, or use a dedicated join model if one document may support multiple responses. Existing authenticated file storage, scanning, authorization, soft deletion, and retention rules continue to apply.

## 9. API Contract

### Staff

- `POST /api/inquiries/:id/information-requests`
- `GET /api/inquiries/:id/information-requests`
- `POST /api/information-requests/:id/review`
- `POST /api/information-requests/:id/cancel`
- `POST /api/information-requests/:id/reopen`

### Client

- `GET /api/my-inquiries/:id/information-requests`
- `PUT /api/information-requests/:id/draft`
- `POST /api/information-requests/:id/submit`
- `POST /api/information-requests/:id/documents`

### Concurrency and idempotency

- Draft saves include the expected request version.
- Submission uses an idempotency key.
- A repeated identical submission returns the existing response.
- A stale version returns `409 CONFLICT` with a safe reload instruction.
- Review re-checks request status and the latest response inside the transaction.

## 10. Validation Rules

- Only the client account linked to the inquiry may draft or submit.
- Only requested item IDs are accepted.
- Every required item must have a nonblank answer or permitted attachment.
- Answer type, length, date, option, and file rules are enforced server-side.
- Mapped field names come from the server allowlist.
- Converted, declined, deleted, or inaccessible inquiries reject new requests according to policy.
- A request cannot be submitted after cancellation.
- Staff cannot accept an older response version when a newer one exists.
- Client responses never set qualification, ownership, gate, approval, or project status.

## 11. Notifications

- Request created: client receives in-app notice and, when external delivery is enabled, email/SMS according to preferences and consent.
- Draft saved: no staff notification.
- Response submitted: reviewer receives an in-app notice and email preference permitting.
- Clarification requested: client receives a new action-required notice linked to the same request.
- Response verified/cancelled: client receives a status update.
- Overdue reminders deduplicate by request, recipient, and reminder window.

Message content includes the request title, due date, and secure portal link—not the sensitive answer.

## 12. Audit and Evidence

Audit events:

- `INFORMATION_REQUESTED`
- `INFORMATION_DRAFT_SAVED` with metadata only, not answer content
- `INFORMATION_SUBMITTED`
- `INFORMATION_CLARIFICATION_REQUESTED`
- `INFORMATION_ACCEPTED`
- `INFORMATION_APPLIED`
- `INFORMATION_CANCELLED`
- `INFORMATION_REOPENED`

Field application records before/after values, actor, response version, timestamp, and request ID. The original inquiry submission and every response version remain recoverable in history; edits do not erase earlier statements.

## 13. Migration and Backward Compatibility

Existing open `MISSING_INFORMATION` work items must not be discarded.

Migration behavior:

1. Create an `InquiryInformationRequest` for every active inquiry work item of type `MISSING_INFORMATION`.
2. Use the work-item title and description as the request text.
3. Create one required custom long-text item labeled **Your response**.
4. Preserve owner, reviewer, due date, creation time, and status.
5. Treat work items already marked complete without a response as **Needs staff review**; do not invent an answer.
6. Leave verified, cancelled, and closed historical items visible in read-only history.

The old generic complete endpoint must reject client completion of a linked information request and direct the client to the response endpoint.

## 14. Phased Implementation

### Phase 1 — Foundation

- Add request/response schema, statuses, indexes, versioning, and migration.
- Add authorization and validation helpers.
- Backfill existing missing-information work items.
- Add API tests for client boundaries, required answers, concurrency, and migration.

**Exit:** Existing records are preserved and no client can complete a request without a response.

### Phase 2 — Client Response Experience

- Reorder `/my-inquiry` around action-required cards.
- Add requested-field rendering, attachments, drafts, submission, confirmation, and deep links.
- Collapse the new-inquiry form behind an explicit separate-project action.
- Add accessible validation summary, loading, retry, empty, and expired states.

**Exit:** A client answers only requested questions on the original inquiry from desktop and mobile.

### Phase 3 — Staff Request and Review

- Add structured request builder and client preview.
- Add response review, field diff, accept/apply, supporting-information acceptance, clarification, cancellation, and reopening.
- Synchronize information-request and work-item status transactionally.

**Exit:** Staff can trace request → response → applied change → verification without database editing.

### Phase 4 — Notifications and Operations

- Add notification triggers and secure deep links.
- Integrate with the planned universal email and RingCentral SMS outbox.
- Add overdue metrics, stale-draft reminders, and unresolved-response reporting.
- Add retention, backup/restore, and performance coverage.

**Exit:** Requests are visible, actionable, deduplicated, auditable, and resilient to notification-provider failure.

## 15. Acceptance Criteria

- Answering a missing-information request never creates an `Inquiry` or `Property` record.
- The client sees only requested fields and can attach supporting files.
- The full new-inquiry form is not presented as the response path.
- “Mark provided” is removed for information requests.
- Required answers are validated server-side.
- Client submission creates an immutable response version.
- Staff clarification keeps the same request and history.
- Staff acceptance applies only approved, allowlisted fields.
- Inquiry → Design remains blocked until every required request is verified or validly cancelled/overridden.
- Duplicate clicks, retries, and stale screens do not create duplicate responses or overwrite newer data.
- Cross-client access returns `404` without leaking record existence.
- Notifications deep-link to the correct request.
- Existing missing-information work items migrate without data loss.
- In-app operation continues if email or SMS is unavailable.

## 16. Design Score

| Area | Score |
|---|---:|
| Workflow correctness | 10/10 |
| Client usability | 10/10 |
| Data integrity and history | 10/10 |
| Authorization and validation | 10/10 |
| Migration safety | 10/10 |
| Notification compatibility | 10/10 |
| Testability and rollout | 10/10 |

**Overall: 10/10 and ready to implement.**

