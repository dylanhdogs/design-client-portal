# User Management and Activity Tracking

**Status:** Implementation-ready design  
**Prepared:** October 6, 2026  
**Scope:** Dedicated user management, inquiry change history, and phase/checklist completion attribution  
**Design-completeness score:** **10/10**

## 1. Purpose

Give administrators one place to manage system accounts and give each inquiry a trustworthy, readable history of who changed it and when. Completion of a phase or checklist item must retain both its current completion attribution and its full history if later reopened.

This is a design document only. It does not implement the feature or change the current branch.

## 2. Current application baseline

The design builds on existing code rather than introducing a second user or activity system:

- The `User` model already stores name, email, role, client association, active status, session version, and account timestamps.
- The API already has administrator-only user listing, access suspension/reactivation, and password-reset actions under `/auth/users`. A client login can also be created from a client record. There is no dedicated Users screen in the admin navigation.
- Authentication currently accepts `ADMIN` and `CLIENT`. The repository guide says legacy `STAFF` accounts are retired, although the broader `design.md` contains a future ADMIN/STAFF/CLIENT permission model.
- `ActivityLog` already carries actor user ID, action, entity type and ID, details, request ID, before/after JSON, and a timestamp. The admin activity endpoint is paginated but currently filters only by entity type and entity ID.
- `InquiryActivity` is a separate domain record for calls, emails, appointments, outcomes, and corrections. It is not a field-change audit log and should remain distinct.
- Checklist items already have completion time and completer ID fields. Project phases have a completion date but no completer field.
- Some phase and checklist changes use the best-effort `logActivity` helper, which can swallow logging failures; phase completion is currently written separately from its activity log. These behaviors do not meet the integrity requirement for the new history.
- The activity-log user relation currently cascades on hard user deletion. The user-management API should never hard-delete users, and the database relation should be made safe for retained history.

## 3. V1 decisions and boundaries

1. **Roles:** V1 supports the roles currently accepted by the running app: `ADMIN` and `CLIENT`. Only ADMIN may access Users and the internal audit timeline. Do not reactivate the retired STAFF role in this feature. If employees need limited, non-admin access, define and implement a separate permission matrix before provisioning them; do not give them ADMIN by default.
2. **Client accounts:** Preserve the current product rule of at most one CLIENT login per client in V1. Enforce this as a database-backed invariant after a duplicate-account preflight. Supporting multiple client contacts per client is a separate authorization and data-model change.
3. **Account removal:** Suspend accounts; do not hard-delete them. Suspension invalidates sessions and preserves identity in historical records. The database must reject hard deletion while retained audit records reference an account.
4. **History source:** Reuse `ActivityLog` as the canonical technical audit record. Keep `InquiryActivity` for human contact events; link its create/correction audit records to the inquiry rather than duplicating its content.
5. **Audit visibility:** Inquiry audit history is internal-only in V1. The client portal must not expose internal notes, user administration events, or internal field diffs. If client-visible history is later needed, expose only explicitly approved event types through a separate filtered response.
6. **Time:** Store event and completion timestamps in UTC using server time; render them in the viewer's local timezone and show a timezone hint in detail views.
7. **Retention:** Follow the seven-year audit retention target documented in `design.md`, subject to the organization's approved retention/legal-hold policy.

## 4. User experience

### 4.1 Users tab

Add a **Users** item to the internal sidebar and an admin-only `/users` route.

The screen contains:

- A paginated list with name, email, role, linked client (for CLIENT), access state, and account creation date.
- Search by name/email and filters for role, access state, and linked client. Use the existing list-endpoint pagination envelope.
- Clear states for loading, no accounts, no search results, unavailable data, and permission denied.
- A primary **Invite user** action; pending invitations appear separately from active/suspended accounts.
- Row actions: view account history, edit name/email, change access profile, resend or revoke a pending invitation, suspend/reactivate access, and initiate password reset.
- A confirmation dialog for suspension that states the impact on active sessions and assignments. Show the count of assignments deactivated by suspension.

The list must never display password hashes, reset tokens, invitation tokens, or credentials. Do not add a hard-delete action. Do not reveal a reset password to an administrator.

### 4.2 Invite and account lifecycle

Use a single-use invitation flow that lets the recipient set their own password:

1. An administrator enters name (or lets the recipient provide it), email, role, and—when role is CLIENT—the linked client.
2. The API validates role/client consistency, duplicate email, active account, pending invitation, client deletion state, and the one-client-account rule.
3. The invitation is pending and does not authenticate the recipient. It expires, can be revoked/resend-issued by an administrator, and is accepted only once.
4. The recipient confirms the invitation and sets a password. Acceptance creates/activates the account and writes an audit event.
5. When email delivery is unavailable, show the invitation URL once for secure manual sharing, matching the existing client-invitation operating pattern. Store only a hash of the token; never write it to application logs.

Generalize the existing client-only invitation contract to support ADMIN invitations without a client association. For CLIENT invitations, `clientId` is required and must identify a non-deleted client. Role and client association are not editable in the ordinary profile form. A separate **Change access profile** action may change them only after an explicit confirmation that names the old and new access scope. The API validates the ADMIN/CLIENT rules and one-client-account limit, blocks demoting or suspending the last active administrator, increments `sessionVersion` to revoke old sessions, and audits the old/new role and client association. Removing a CLIENT link deactivates its assignments; a later reactivation does not restore them automatically.

### 4.3 Inquiry activity timeline

Add an **Activity** tab to the internal inquiry detail view. Keep it separate from the call/email tracker.

Each timeline entry shows:

- Actor's name captured at event time and their role at event time.
- A plain-language action, affected section/field, and event timestamp.
- For eligible field changes, a compact before-to-after diff; long text is collapsed by default.
- A link to the affected record when it is safe and useful.

Newest events appear first, with pagination and filters for date range, actor, and event type. An unchanged save creates no entry. One save that changes several fields creates one event containing one diff row per changed field; do not log every keystroke or autosave render.

### 4.4 Phase and checklist completion

Where the user sees a completed phase/checklist item, show **Completed by [name] - [date and time]**. Keep current completion attribution with the item. If it is reopened, clear the current completion fields but retain the completion and reopening events in the audit timeline.

For historical completed phases whose actor was never stored, display **Completed - actor not recorded**; do not infer an actor from the current user or fabricate a backfill event.

## 5. Audit event contract

### 5.1 Required event fields

Every new tracked event records:

- Actor user ID, actor name snapshot, and actor role snapshot.
- Action, entity type, entity ID, and UTC event timestamp.
- Inquiry ID and project ID when applicable, so history can be fetched efficiently even when the changed entity is a child record.
- Request/correlation ID where available.
- A safe field-level before/after diff or a concise event-specific detail object.

Use a stable action vocabulary, including:

- User: `USER_INVITED`, `USER_INVITATION_ACCEPTED`, `USER_INVITATION_REVOKED`, `USER_PROFILE_UPDATED`, `USER_ACCESS_SUSPENDED`, `USER_ACCESS_RESTORED`, `USER_PASSWORD_RESET_REQUESTED`.
- Inquiry: `INQUIRY_CREATED`, `INQUIRY_FIELD_UPDATED`, `INQUIRY_OWNER_CHANGED`, `INQUIRY_STATUS_CHANGED`, `INQUIRY_SOURCE_ADDED`, `INQUIRY_SOURCE_REMOVED`, and the relevant discovery/site/ROM section update actions.
- Phase/checklist: `PHASE_STARTED`, `PHASE_COMPLETED`, `PHASE_REOPENED`, `CHECKLIST_ITEM_SUBMITTED`, `CHECKLIST_ITEM_COMPLETED`, `CHECKLIST_ITEM_REJECTED`, and `CHECKLIST_ITEM_REOPENED`.

Keep existing action strings readable for old records. New action values must have a label mapping in the UI and tests.

### 5.2 Integrity and privacy

- Create the business mutation and its audit record in the same Prisma transaction. If required audit persistence fails, roll back the mutation; do not report success while losing the history.
- Derive actor identity only from the authenticated server request. Ignore any client-supplied actor ID, name, role, or completion timestamp.
- Record only actual changes. Use allowlisted changed fields and normalized values rather than blindly serializing a whole request or ORM object.
- Never store passwords, password hashes, reset/invitation tokens, authorization headers, secrets, uploaded-file bytes, or unrestricted request bodies in before/after data.
- Treat inquiry values (including contact/property, budget, and client narrative) as protected internal data. Restrict raw diffs to ADMIN and redact/collapse long values in the UI.
- Audit logs are append-only in application flows. Corrections create new events; there is no edit/delete endpoint for history.
- Change the ActivityLog-to-User delete behavior from cascade to restrict, and keep account removal as suspension. Capture actor name/role snapshots so later profile edits do not rewrite historical attribution.
- The existing `logActivity` helper is best-effort. New inquiry and completion mutations must use the transaction-aware `writeAuditEvent(tx, ...)` path. A later audit should migrate all consequential legacy mutations to that path.

Example field-change payload:

```json
{
  "action": "INQUIRY_FIELD_UPDATED",
  "entityType": "Inquiry",
  "entityId": "<inquiry-id>",
  "inquiryId": "<inquiry-id>",
  "details": {
    "changes": [
      { "field": "desiredTiming", "before": "Spring", "after": "Summer" }
    ]
  }
}
```

## 6. Data model and migration plan

Make additive changes where possible:

### User and invitations

- Keep the existing User identity and session fields; validate writes against `ADMIN` and `CLIENT` only.
- Extend the invitation record/flow with the invited role, inviter, and optional client association. Make client association nullable only for ADMIN invitations. Hash invitation tokens at rest and enforce expiry, one-time acceptance, and revocation.
- Add a unique constraint for non-null `User.clientId` only after the duplicate-client-account preflight passes. If duplicates exist, pause the migration and resolve them with the business owner; never merge accounts automatically.
- Keep `active=false` as the suspended state. Suspension increments `sessionVersion`, revokes pending access as appropriate, and deactivates current assignments. Reactivation does not silently restore old assignments; an administrator must reassign them.

### Activity log

- Extend `ActivityLog` with nullable indexed `inquiryId` and `projectId`, plus actor name/role snapshots. Preserve existing `entityType`, `entityId`, `details`, `beforeState`, `afterState`, `requestId`, and `createdAt`.
- Add indexes for `(inquiryId, createdAt)`, `(projectId, createdAt)`, and `(userId, createdAt)` as supported by the finalized schema.
- Keep legacy activity rows. Backfill actor snapshots from their current User relation where possible; mark any unmappable legacy attribution as unknown instead of inventing a person.
- Do not use `InquiryActivity` as the field audit store. Its call/contact semantics, correction chain, and attachments remain unchanged.

### Completion attribution

- Add nullable `ProjectPhase.completedById`; keep `completedDate` for backward-compatible timestamp storage.
- Retain the existing ChecklistItem `completedAt` and `completedBy` values, but add a safe User relation and ensure it resolves to a real user when present.
- Use nullable user references with `SetNull` only where deletion/privacy policy requires it; preserve actor snapshots in the audit event. Prefer suspended accounts over deletion.
- Backfill valid existing checklist completer IDs as-is. Existing phase completions retain their date but have unknown actor. Do not create fictitious historical audit rows.
- When completing a phase, set `status`, server `completedDate`, and `completedById` together with the audit event in one transaction. When reopening, clear only the current completion fields and append a reopening event with reason.
- Preserve the current rule that a phase cannot complete until its required checklist items are approved. Audit any resulting next-phase activation/project status change in the same transaction.

### Pre-migration checks

Before applying a migration:

1. Count user role values outside ADMIN/CLIENT.
2. Find duplicate non-null clientId values and pending invitations that conflict with accounts.
3. Validate ChecklistItem.completedBy values against User.id.
4. Count completed ProjectPhase rows missing completedDate and report them; do not invent timestamps.
5. Confirm activity log volume and snapshot backfill results; compare row counts before/after.
6. Take and verify a restorable database backup. Apply the migration first to a copy of production data.

## 7. API contract

Preserve existing routes and response compatibility; add or extend the following administrator-only endpoints:

| Method and path | Purpose |
|---|---|
| `GET /api/auth/users?page&limit&search&role&status&clientId` | Paginated Users list with linked client summary; retains current `{data, pagination}` envelope. |
| `POST /api/auth/users/invitations` | Invite ADMIN or CLIENT; CLIENT requires clientId. Returns pending invitation status and a one-time secure link when mail is not configured. |
| `PATCH /api/auth/users/:id` | Update allowed identity fields (name/email); writes field-level audit diff. |
| `PUT /api/auth/users/:id/access-profile` | Explicitly change role/client association with scope validation, session invalidation, safeguards, and an atomic audit event. |
| `PUT /api/auth/users/:id/access` | Preserve current suspend/reactivate behavior and response; make state change and audit atomic. |
| `POST /api/auth/users/:id/password-reset` | Initiate a secure reset flow; never accept or return a password in an admin UI/API response. |
| `GET /api/inquiries/:inquiryId/activity?page&limit&actorId&action&from&to` | Paginated internal inquiry timeline, scoped to the inquiry and accessible only to ADMIN. |

Existing phase/checklist mutation routes remain; their response includes the current completer ID/name and completion timestamp. Server time is authoritative. Validate all query/body fields. Keep stable errors for `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INVALID_TRANSITION`, and validation failures.

## 8. Authorization and edge cases

- Users page and all user-administration endpoints require authenticated ADMIN on the server; hiding the navigation item is not authorization.
- CLIENT accounts cannot list users, inspect global audit, or see another client's records. Existing client-owned project/inquiry authorization remains mandatory.
- Block suspending the current administrator and block suspending/demoting the last active administrator. Enforce the last-admin rule transactionally to prevent concurrent requests from disabling all administrators.
- A CLIENT account must be linked to one active, non-deleted Client. An ADMIN account must not carry a clientId.
- Suspending a user invalidates existing sessions immediately. Show the affected active assignments; reactivation requires explicit re-assignment.
- Reopening a completed phase/checklist item requires a reason; completion/reopen events remain in chronological history.
- Repeated identical saves are no-ops and do not add duplicate change rows. A retry with the same idempotency key must not double-apply a mutation or its audit entry.
- A failure to read audit history should show an error state, never silently appear as an empty history.

## 9. Acceptance criteria

### Users

- ADMIN sees Users navigation and can search, filter, paginate, invite, edit identity, suspend/reactivate, and initiate password reset.
- CLIENT cannot open the Users screen or call any user-administration endpoint, even by direct URL/API request.
- Invalid role/client combinations, duplicate email, duplicate pending invitation, duplicate client account, and inactive/deleted client links are rejected with understandable errors.
- Role/client association changes require explicit confirmation, enforce valid combinations and uniqueness, invalidate existing sessions, audit old/new scope, and protect the last active administrator.
- Invitation expiry, single-use acceptance, revocation, resend, and token-hash-at-rest behavior are verified.
- Suspension invalidates existing sessions, deactivates assignments, and is audited. Reactivation does not restore assignments without an explicit action.
- Self-suspension and last-active-administrator suspension/demotion are blocked, including under concurrent requests.
- No UI or API exposes a password, hash, invitation token after its one-time display, or reset token.

### Inquiry activity

- A persisted inquiry field change produces exactly one event with the authenticated actor, affected inquiry, UTC timestamp, request ID, and exact changed fields.
- A no-op save produces no event. Multiple field changes in one save are grouped into one event.
- Owner/status changes, discovery/site/ROM changes, and saved-source add/remove operations are represented.
- Audit failure rolls back the corresponding tracked mutation.
- Timeline pagination/filtering returns only the selected inquiry's events and is ADMIN-only.
- Long/private values are collapsed and sensitive values are excluded from audit JSON; client routes never receive internal diffs.
- Existing InquiryActivity calls, outcomes, corrections, and attachments remain functional and are not duplicated as field diffs.

### Phase/checklist completion

- Completing an eligible phase stores server timestamp and authenticated completer on the phase, and appends a matching audit event atomically.
- Completing or approving a checklist item stores completer/time and a matching event atomically.
- Client-supplied actor/time fields are ignored or rejected.
- A blocked phase cannot complete. Reopening clears current completion fields, requires a reason, and preserves the prior completion event.
- Existing completed records retain their dates; missing historical actors render as unknown.

### Quality and release

- Migration passes against an empty database and a production-data copy; preflight counts and backup/restore evidence are recorded.
- Backend type-check/build, frontend type-check/build, unit/integration tests, and role-boundary tests pass.
- Tests cover transaction rollback, concurrent last-admin changes, invitation replay, audit pagination, and historical backfill.
- Keyboard use, focus states, accessible names, responsive layout, loading/empty/error states, and timezone rendering are verified.
- Release can be disabled or rolled back without deleting audit rows or breaking existing login, client invitations, inquiry editing, or phase/checklist flows.

## 10. Delivery sequence

1. Run read-only preflight checks and record any role/client-account anomalies.
2. Add the backward-compatible schema migration and test it on empty and copied production data.
3. Implement the shared transaction-aware audit writer and instrument inquiry and phase/checklist mutations.
4. Generalize secure invitations and complete the administrator-only user API.
5. Add the Users page and inquiry Activity timeline behind authorization checks.
6. Run the acceptance suite, review the audit samples for secrets/over-collection, then deploy with a rollback path.

## 11. Readiness score

| Dimension | Score |
|---|---:|
| Scope and explicit V1 boundaries | 1/1 |
| User lifecycle and account UX | 1/1 |
| Role and ownership authorization | 1/1 |
| Inquiry audit semantics and presentation | 1/1 |
| Phase/checklist attribution | 1/1 |
| Data model and migration/backfill | 1/1 |
| API contracts and compatibility | 1/1 |
| Privacy, retention, and audit integrity | 1/1 |
| Failure, concurrency, and recovery behavior | 1/1 |
| Testable acceptance and rollout plan | 1/1 |
| **Total design-completeness score** | **10/10** |

This score applies to specification completeness. It is not an implementation or release-verification score. The documented role boundary is deliberately conservative: if limited-permission STAFF accounts are required, approve that separate access model before provisioning internal non-admin users.
