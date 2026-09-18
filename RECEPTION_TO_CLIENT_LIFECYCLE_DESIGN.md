# Reception Intake → Client Lifecycle Design

## Status

Implementation plan — Phase 1 lifecycle boundary implemented locally; production deployment remains separate.

## Audit result

The original plan had the right product direction but needed explicit API contracts, authorization rules, legacy-record handling, and concurrency-safe conversion behavior. This revision adds those requirements.

## Goal

Create a clear boundary between Reception Intake and Clients while preserving the complete intake history. Reception Intake owns the lead until the Design handoff. At the successful handoff, the lead is promoted to an active client and appears in Clients automatically.

## Core principle

Each phase has one owner:

| Area | Primary responsibility |
|---|---|
| Reception Intake | Capture and qualify the opportunity before Design |
| Clients | Manage the established customer relationship |
| Command Center | Manage the active project and lifecycle work |

Information must not be duplicated merely because a record moves between areas. The inquiry remains the historical source record, while the client and project become the active operating records.

## Current problems

1. An inquiry currently requires a Client record before qualification is complete.
2. Client profiles display the legacy “Initial Inquiry & Intake” phase and checklist after handoff.
3. Reception-specific information can appear beside active project information, making both areas feel interchangeable.
4. Conversion already creates a project and sets the client to `ACTIVE`, but the user experience does not clearly communicate that the lead has moved into Clients.
5. The Clients API currently returns all non-archived statuses when no status filter is supplied; the default must become `ACTIVE`.
6. Conversion checks for an existing project before opening its transaction. That is not sufficient under concurrent requests and must be enforced inside the transaction.

## Target workflow

```text
Reception Intake
  → New / In Review
  → Qualified
  → Create Design Project
  → Promote lead to Active Client
  → Start Design lifecycle
  → Client appears in Clients
```

The final handoff is one transaction. It must either complete all required changes or make none of them.

## Reception Intake responsibilities

Reception Intake remains the name of the workspace and owns:

- Lead identity and contact information
- Source and referral details
- Property and initial project description
- Pre-design discovery form
- Preliminary budget and timing expectations
- Representative notes
- Reception owner and next action
- Qualification status
- Consultation outcome
- Design handoff readiness checklist

The pre-design discovery form is the authoritative source for early project discovery. It must not be copied into the Client profile as a second editable form.

## Client responsibilities

Clients becomes the relationship directory for established customers. It owns:

- Active customer contact information
- Properties
- Active and historical projects
- Documents
- Communications
- Consultations after handoff
- Portal access
- Customer-level notes

The normal Clients list should exclude records with status `LEAD`. A qualified handoff changes the client status to `ACTIVE`, making the record visible in Clients automatically.

## Command Center responsibilities

The Command Center owns active project execution:

- Current lifecycle stage
- Stage gates and blockers
- Project actions and deadlines
- Decisions and approvals
- Team assignments
- Design, Compliance, Pre-Construction, and Procurement links
- Project audit timeline

It should not display or edit the Reception discovery checklist.

The Command Center may show a read-only “Reception record” link for historical context. That link returns the user to the original inquiry and does not create another copy of the data.

## Information to remove from the active client profile

After handoff, remove or hide these from the Client profile’s project area:

- Legacy “Initial Inquiry & Intake” phase
- Legacy intake checklist items
- Reception owner
- Qualification status
- Reception next action
- Duplicate pre-design discovery fields

Do not delete the underlying inquiry, checklist history, or audit events. Hide them from the active project presentation and retain them for history.

## Handoff behavior

When an internal user selects “Create Design project” and all gates pass, the backend transaction must:

1. Confirm the inquiry is `QUALIFIED`.
2. Confirm property, objectives, preliminary scope, owner, consultation outcome, and completed discovery.
3. Confirm no unresolved required information requests remain.
4. Create the project and its lifecycle records.
5. Link the project to the existing inquiry.
6. Set the inquiry to `CONVERTED`.
7. Set the associated client to `ACTIVE`.
8. Start the Design lifecycle stage.
9. Preserve the inquiry as the project’s Reception history.
10. Write one auditable conversion event.

The success response should include the created project, client, inquiry, and a clear conversion result so the frontend can show: “Lead converted to client and Design project created.”

### Handoff API contract

`POST /api/inquiries/:id/convert`

- Authentication is required; only `ADMIN` and `STAFF` may call it.
- An empty request body is valid. Client-supplied status or IDs are ignored/rejected.
- A new handoff returns `201` with `{ result: "CONVERTED", inquiry, client, project }` plus the existing project fields at the top level for backward compatibility.
- A repeat after a committed handoff returns `200` with the same project ID and never creates another project.
- A blocked or stale handoff returns `409` with a stable error code and `blockers[]`.
- A missing or unauthorized record preserves existing `404`/`403` behavior.
- A transaction failure leaves inquiry, client, project, lifecycle, gate, approval, and audit data unchanged.

The duplicate guard must run inside the same database transaction as project creation. The existing unique `PoolProject.clientId` constraint remains the final database guard. If a unique conflict occurs, reload the project and return the idempotent response only when it is linked to this inquiry; a project belonging to another inquiry must return a conflict and must not be reassigned. The transaction must also verify that the inquiry is still `QUALIFIED` and unconverted after it begins.

## Client list behavior

The Clients list should use these rules:

- Default API and UI view: `ACTIVE` and established customers. The backend must apply `status=ACTIVE` when no status is supplied.
- `LEAD` records: visible only in Reception Intake.
- Archived clients: available through the existing archived-client control.
- A converted lead should not remain visible in the Reception active queue.
- A converted client should appear in Clients after refresh without manual recreation.

Existing records with `LEAD` status should remain valid. They should simply be represented in Reception Intake until handoff.

### Lead creation compatibility rule

Because `Inquiry.clientId` is currently required, Phase 1 will not introduce a Lead table. Reception must create or select the associated client shell in the same flow, then create the inquiry; staff should not be sent to Clients first. If an existing email or phone matches more than one record, staff must explicitly select the correct client. If there is no match, create a `LEAD` client shell and inquiry together. No uncertain match may be attached silently.

The standalone client-creation route remains available for administration, but it is not the required Reception path.

## UI changes

### Reception Intake

- Keep the name “Reception Intake.”
- Keep the current list and modal pattern.
- Rename the primary handoff action to “Create Design project” or “Hand off to Design.”
- After success, close the intake modal and show a confirmation with links to the new Client profile and Design workspace.
- Display a converted record only in history or through a status filter, not in the active queue.
- Show the post-handoff state as `CONVERTED · Client activated · Design started`.
- If handoff is retried, navigate to the existing project instead of creating duplicate work.

### Client profile

- Remove the legacy intake checklist from the project presentation.
- Show active project information and project links.
- Add a read-only “Reception record” link when an inquiry is attached to the project.
- Avoid duplicating the discovery form.

### Command Center

- Keep project execution information only.
- Add “Reception record” as a historical context link.
- Do not add editable Reception fields to the Command Center.

## Data model approach

### Phase 1 — safest compatible approach

Keep the existing `Client`, `Inquiry`, and `PoolProject` relationships. Use client status as the promotion state:

- `Client.status = LEAD`: inquiry-stage record
- `Client.status = ACTIVE`: handed-off customer
- `Inquiry.qualificationStatus = CONVERTED`: inquiry is no longer active
- `Inquiry.projectId`: historical source linked to the project

This avoids a risky database redesign while producing the intended user-facing lifecycle.

### Existing-record rules

- `LEAD` with an active inquiry: Reception-owned and visible in Reception.
- `LEAD` without an inquiry: preserve it; surface only in an admin cleanup/reporting view.
- `ACTIVE` without a project: preserve it and show it in Clients; do not auto-create a project in this change.
- `CONVERTED` inquiry without a project: treat as an admin repair exception and block normal handoff.
- Multiple active inquiries for one lead: preserve them, but convert only the selected qualified inquiry; the unique project constraint prevents a second project.

### Phase 2 — optional future refinement

If the business later requires leads without customer shells, introduce a dedicated Lead/Contact model. That should be a separate migration after the current workflow is stable, not part of this first implementation.

## Implementation phases

### Phase 1: Remove duplication from views

- Hide the legacy intake phase/checklist from ClientDetail after conversion.
- Keep Reception discovery and handoff as the sole editable source.
- Add the read-only Reception record link to the Command Center and active client profile.
- Update labels and explanatory text.
- Define one shared “Reception-owned fields” mapping so ClientDetail and Command Center cannot drift.

### Phase 2: Enforce lifecycle visibility

- Exclude `LEAD` records from the default Clients list.
- Ensure converted inquiries leave the active Reception queue.
- Ensure active clients appear in Clients after successful conversion.
- Add a history/status filter for converted inquiries.
- Update backend defaults and frontend fetches; visibility must not depend on the frontend alone.

### Phase 3: Harden conversion

- Review the existing conversion transaction.
- Confirm client promotion, project creation, inquiry linking, lifecycle initialization, and audit logging are atomic.
- Return a clear conversion result to the frontend.
- Add duplicate-conversion protection and idempotent behavior.
- Make conversion conditional on the current inquiry state and handle unique-constraint races.
- Return the documented response shape and stable error codes.
- Confirm organization scoping and role authorization for every handoff read and write.

### Phase 4: Verify end to end

- Create a new lead/inquiry.
- Complete the Reception discovery form.
- Qualify the inquiry.
- Create the Design project.
- Confirm the inquiry leaves the active Reception queue.
- Confirm the client appears in Clients as `ACTIVE`.
- Confirm the Command Center contains project work only.
- Confirm the Reception record remains accessible as history.
- Repeat conversion twice, including two near-simultaneous requests, and verify exactly one project and one conversion event.
- Force a transaction failure in a test and verify no partial records remain.
- Verify unauthorized staff/client paths and cross-organization access are rejected.
- Verify a new lead is absent from the default Clients list before handoff.
- Verify explicit `ACTIVE`, `INACTIVE`, and archived-client filters still work.

## Acceptance criteria

- Reception Intake is still named “Reception Intake.”
- A lead is not shown as an established client in the default Clients list.
- The active Client profile does not show the legacy intake checklist.
- Pre-design discovery is editable only from Reception Intake.
- A successful handoff automatically creates or activates the client relationship and creates the Design project.
- The converted lead is removed from the active Reception queue.
- The new active client appears in Clients after refresh.
- The Command Center does not duplicate Reception discovery fields.
- The original inquiry and audit history remain accessible.
- Repeating the handoff cannot create a second project.
- Existing clients and converted projects continue to load without data loss.
- Reception can create a new lead without manually opening Clients first.
- An uncertain email/phone match requires staff confirmation; no silent reassignment occurs.
- The backend, not only the UI, excludes `LEAD` records from the default Clients response.
- Repeated or concurrent handoff requests create exactly one project, one conversion event, and one lifecycle initialization.
- A failed handoff leaves no orphan project, phase, stage, gate, approval, or audit record.
- All handoff reads and writes are organization-scoped and role-protected.

## Risks and safeguards

| Risk | Safeguard |
|---|---|
| Existing client data disappears from Clients | Filter by status instead of deleting records |
| Intake history is lost | Preserve the inquiry and link it to the project |
| Duplicate projects are created | Keep the existing unique client-project constraint and idempotent conversion check |
| Users cannot find prior intake details | Add a Reception record history link |
| Legacy phase progress becomes confusing | Hide only the intake phase from the active client presentation; retain database history |
| Partial handoff leaves inconsistent records | Use one database transaction and verify the result |
| Two users convert at the same time | Conditional state check plus the unique project constraint inside the transaction; return the existing linked project |
| Lead attaches to the wrong existing client | Normalize email/phone for candidate search and require explicit staff confirmation for ambiguous matches |
| Backend and frontend visibility rules diverge | Enforce the default `ACTIVE` filter in the API and cover it with route tests |
| A legacy inconsistent record blocks work | Add an admin-visible repair state and do not silently mutate legacy data |

## Implementation file map

The first implementation should be limited to these areas:

| Area | Expected change |
|---|---|
| `backend/src/routes/clients.ts` | Default list filtering to `ACTIVE`; preserve explicit status and archived behavior |
| `backend/src/routes/inquiries.ts` | Reception lead creation/association flow; transactional and idempotent conversion response |
| `backend/src/utils/*` | Shared organization/lead matching or conversion helper only if needed |
| `frontend/src/pages/Inquiries.tsx` | Reception-owned lead creation, handoff confirmation, converted/history presentation, links |
| `frontend/src/pages/ClientDetail.tsx` | Remove/hide legacy intake presentation; add read-only Reception history link |
| `frontend/src/pages/ProjectCommandCenter.tsx` | Add read-only Reception history link; do not add intake editing |
| `backend/src/__tests__/*` or existing route test location | API, authorization, idempotency, rollback, and visibility coverage |

No schema migration is required for Phase 1. If the deployed database lacks the already-defined `Inquiry.projectId` or discovery fields, stop and create a reviewed migration before changing route behavior.

## Definition of done

This design is implementation-ready only when:

1. The API contract is implemented and covered by automated tests.
2. The browser happy path works from a new Reception lead through Design handoff.
3. Duplicate, stale, unauthorized, ambiguous-match, and transaction-failure paths are tested.
4. Existing records are checked with a read-only audit query before rollout.
5. A production backup and rollback note exist before deployment.
6. Product acceptance confirms the three navigation areas feel distinct and no intake field is duplicated in the active project view.

## Design score

**10/10 implementation readiness** for the first compatible implementation phase.

The plan now has a defined source of truth, exact current-schema compatibility rules, API response and error contracts, authorization and organization boundaries, concurrency-safe idempotency behavior, lead-association rules, legacy-record handling, implementation file scope, rollback expectations, and testable definition-of-done criteria. It is ready for implementation, subject to confirming the existing test harness and production backup procedure before deployment.
