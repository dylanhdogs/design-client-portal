# Signature Exteriors Design Portal — User Guide

This guide explains how to use the application from initial client contact through design, compliance, pre-construction, and procurement.

## Contents

1. [Quick start](#quick-start)
2. [Roles and navigation](#roles-and-navigation)
3. [Recommended workflow](#recommended-workflow)
4. [Clients and client access](#clients-and-client-access)
5. [Inquiry and qualification](#inquiry-and-qualification)
6. [Project command center](#project-command-center)
7. [Design and scope](#design-and-scope)
8. [Compliance](#compliance)
9. [Pre-Construction readiness](#pre-construction-readiness)
10. [Procurement](#procurement)
11. [Management and automation](#management-and-automation)
12. [Client portal](#client-portal)
13. [Documents, notifications, and communications](#documents-notifications-and-communications)
14. [Testing checklist](#testing-checklist)
15. [Troubleshooting](#troubleshooting)

---

## Quick start

With the application running, visit <http://localhost:3000>.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@example.com` | `admin123` |
| Client | `client@example.com` | `client123` |

> These demo credentials are only for a local or fictional test database. Never use them on the live portal; production administrator accounts must be created through the one-time administrator bootstrap.

Use Administrator when testing every internal control. Sign in as Client afterward to confirm the customer experience and privacy boundaries.

> Test activity is saved in the local database. Approvals, stage advancement, purchase orders, and other actions affect the project's displayed state.

If the application is not running, open a terminal in the project folder and run:

```bash
npm run dev
```

The frontend uses port `3000`; the backend uses port `4000`.

---

## Roles and navigation

### Administrator

Administrators can manage all clients and workflow workspaces, authorize controlled overrides and high-risk exceptions, perform procurement authorization, and use management automation tools.

### Client

Clients see only records associated with their own client account and explicitly client-visible workflow data. They can submit inquiries, respond to information requests, review their project, approve submitted design/scope versions, authorize applicable substitutions, and view their documents and communications.

Internal notes, hidden requirements, vendor quotes, management reports, and automation controls are not exposed to clients.

### Internal navigation

- **Dashboard** — summary totals and recent clients.
- **Clients** — client profiles, consultations, files, communications, and projects.
- **Inquiries** — inquiry capture, qualification, follow-up, and conversion.
- **Management** — management metrics, automation review, and notification delivery.
- **Notifications bell** — unread notices, reminders, approvals, and exceptions.
- **Logout** — ends the current session.

### Client navigation

- **My Project** — project status and client-visible workflow information.
- **My Documents** — files associated with the client.
- **My Inquiry** — inquiry submission and requested-information actions.
- **My Communications** — communication history available to the client.

---

## Recommended workflow

The intended project sequence is:

```text
Client → Inquiry → Design → Compliance → Pre-Construction → Procurement → Field Execution
```

For each stage:

1. Capture the required records.
2. Assign an owner and reviewer.
3. Add due dates and supporting evidence.
4. Complete outstanding actions.
5. Verify completed actions.
6. Resolve decisions, exceptions, and blockers.
7. Review the current gate in the Project command center.
8. Select **Advance stage** when the gate is ready.

The application intentionally blocks advancement while required conditions remain unresolved.

---

## Clients and client access

### Add a client

1. Sign in as Administrator.
2. Open **Clients**.
3. Select **Add Client**.
4. Enter the name and available company/contact information.
5. Save the record.

### Work in a client record

Open a client to access:

- **Consultations** — meetings, dates, notes, statuses, and outcomes.
- **Documents** — uploads, previews, downloads, descriptions, and soft deletion.
- **Communications** — inbound/outbound contact history.
- **Pool Project** — project details, legacy phases, checklists, and the command-center entry point.

### Give the client access

From the client record, select **Create Login** to create credentials directly or **Invite Client** to use the invitation flow. The user must remain linked to the correct client record; this relationship enforces the client's data boundary.

### Archive or restore a client

Only an Administrator can archive a client. Archiving immediately suspends every linked client login, invalidates existing sessions, and deactivates the client's project assignments. Use **Show archived clients** on the Clients page to review archived records and restore one. Restoring the client record does not reactivate its login automatically; review the account and deliberately reactivate it from the administrator access controls when access should resume.

### Create or open a project

For a new lead, use the inquiry conversion process so the complete inquiry history is preserved. If a client requires a directly created legacy project, select **Create Pool Project**, open the **Pool Project** tab, then select **Open Command Center**.

---

## Inquiry and qualification

### Create an inquiry internally

1. Open **Inquiries**.
2. Select **New inquiry**.
3. Choose the client and owner.
4. Enter the property address.
5. Capture the referral source, budget, timing, objectives, preliminary scope, and description.
6. Record a clear next action.
7. Select **Save inquiry**.

### Qualify the inquiry

Move the record through the appropriate status sequence:

1. `NEW`
2. `IN_REVIEW`
3. `QUALIFIED`, `NURTURED`, or `DECLINED`
4. `CONVERTED` after project creation

Do not qualify an inquiry until required information and follow-up activities are complete.

### Request missing information

1. Open the inquiry.
2. Create a missing-information request with a specific title and due date.
3. Make it client-visible when the customer must respond.
4. The client opens **My Inquiry** and selects **Mark provided** after supplying the information.
5. An internal reviewer verifies the completed action.

### Add consultation evidence

Use the client's **Consultations** tab to record meetings and outcomes. Use **Documents** to upload relevant site photos, drawings, or supporting material.

### Convert to a project

After qualification and verification, use the conversion action. Conversion preserves the inquiry, client, property, documents, and consultation relationships and opens the Design stage.

---

## Project command center

The Project command center is the main internal operating screen.

### Lifecycle cards

The top cards show Inquiry, Design, Compliance, Pre-Construction, and Procurement. Each card also displays its related legacy project phase during migration.

### Create and process an action

1. Select **New action**.
2. Choose the stage and action type.
3. Enter a specific title and description.
4. Set priority, owner, reviewer, and due date.
5. Enable **Client visible** only when the client should see it.
6. Save.
7. The owner selects **Complete** when finished.
8. The reviewer selects **Verify** after confirming the result.

Completion alone does not satisfy a verification-controlled gate.

### Assign the team

Select **Assign team**, choose an internal user and assignment scope, then save. Assignments establish accountable ownership and may grant workflow-specific authority.

### Resolve decisions

The **Pending decisions** panel lists decisions awaiting action. Review the options, impact, and supporting records before selecting **Approve** or **Reject**.

### Advance a gate

The **Current gate** panel is either:

- **READY** — required conditions are satisfied; or
- **BLOCKED** — actionable blockers are listed.

Resolve all listed blockers, reload if needed, then select **Advance stage**.

Administrators may see **Controlled override**. An override requires a business reason, accepted risk, mitigation, risk owner, and due date. It is audited and should be used only for an approved business exception.

### Audit timeline

Use the timeline to see who performed important workflow actions and when.

---

## Design and scope

Open the Design workspace from the Project command center.

### Create a design version

1. Select **Design version**.
2. Enter the design summary, requirements, and site information.
3. Describe the change from the prior version.
4. Record cost and schedule impact.
5. Enable **Material change that invalidates prior approval** when appropriate.
6. Select **Create draft**.

### Create a scope version

1. Select **Scope version**.
2. Record inclusions, exclusions, allowances, estimate, and schedule impact.
3. Describe the revision and identify material changes.
4. Select **Create draft**.

### Add questions and evidence

- Use **Outstanding questions** for unresolved choices or assumptions.
- In **Relational evidence**, choose an uploaded document, choose its design/scope version, explain the purpose, and select **Link evidence**.

Upload the file through the client's Documents tab before linking it.

### Submit and approve

1. Review the draft.
2. Select **Submit for approval**.
3. The designated approver or client reviews **Approval required**.
4. Select **Approve** or **Request changes**.
5. Create a new revision for corrections; do not replace historical versions.

The Design-to-Compliance gate requires the configured design and scope approvals and no unresolved blockers.

---

## Compliance

Open the Compliance workspace from the Project command center.

### Add a requirement

1. Select **New requirement**.
2. Choose the category, such as HOA, permit, engineering, drainage, utilities, access, or constructability.
3. Enter the description, jurisdiction, and external agency.
4. Assign the owner and reviewer.
5. Add a due date.
6. Mark whether the requirement and evidence are required.
7. Enable **Client visible** only when appropriate.
8. Select **Create requirement**.

### Process the requirement

Use the requirement card to update status and ownership, attach evidence, submit for review, approve or reject evidence, record an external response, and correct/resubmit a rejected item.

### Record an exception

An exception must explain the reason, risk, mitigation, owner, and due date. High-risk exceptions require leadership approval. The original requirement remains in the history.

The Compliance-to-Pre-Construction gate remains blocked until required conditions, evidence, and exceptions are acceptable.

---

## Pre-Construction readiness

This workspace turns the approved project into an executable plan. It covers contract and scope reconciliation, plans, permits, insurance, budget/cost codes, schedule, client responsibilities, logistics, safety, existing conditions, utilities, selections, procurement planning, vendors, communications, team roles, billing, and kickoff.

### Add a readiness item

1. Select **Add readiness item**.
2. Choose the category and enter a specific title.
3. Assign the owner and reviewer.
4. Add the due date and responsibility party.
5. Add cost, allowance, schedule, long-lead, or reference information when relevant.
6. Mark required and client-visible settings accurately.
7. Select **Create item**.

The owner completes an item and the reviewer verifies it. Use a controlled exception only when its documented risk and mitigation are acceptable.

### Run the Construction Readiness Review

1. Resolve the listed blockers.
2. Choose the reviewer when needed.
3. Select **Create snapshot**.
4. Review the calculated score and blocker count.
5. Select **Submit review**.
6. An authorized reviewer selects **Approve readiness**.

Snapshots are immutable. Create another review if conditions change. The Pre-Construction-to-Procurement gate requires an approved review and acceptable exceptions.

---

## Procurement

Open Procurement from the Project command center.

### Add an approved vendor

1. Select **Vendor**.
2. Enter vendor/contact information and category.
3. Set the compliance status.
4. Select **Save vendor**.

Only active, approved vendors can be used for quote selection.

### Create a request

1. Select **Request**.
2. Enter description, specification, quantity, and unit.
3. Add required-by date, estimated cost, and cost code.
4. Mark whether it is required.
5. Enable **Client visible** only when appropriate.
6. Select **Create request**.

### Collect quotes and issue a PO

1. Select **Add quote** on the request.
2. Choose an approved vendor.
3. Enter subtotal, tax, scope, validity date, and lead time.
4. Compare vendor, scope, lead time, and total.
5. An authorized internal user selects the chosen quote.
6. Select **Issue PO** and enter the purchase-order number.

Confirm scope and quality as well as price; automated comparisons are advisory. The application prevents duplicate purchase orders for one request.

### Receive and inspect

1. Select **Receive**.
2. Enter quantity, condition, and received date.
3. Save the delivery.
4. Select **Pass** after successful inspection or **Fail** and enter meaningful notes.

Damaged, incomplete, rejected, and backordered deliveries remain visible as exceptions.

### Handle substitutions

1. Select **Substitution**.
2. Record the proposed specification, reason, cost impact, and schedule impact.
3. Enable client authorization for client-impacting changes.
4. Submit for internal approval.
5. When required, the client selects **Authorize substitution**.

The original specification remains in history.

### Match invoices and close

1. Select **Invoice match**.
2. Enter invoice reference, delivered value, and invoiced value.
3. Review ordered, delivered, and invoiced amounts and variances.
4. Resolve quantity, inspection, substitution, and value exceptions.
5. Select **Close** only after verification.
6. When all required requests are verified and closed, select **Approve handoff** to move to Field Execution.

---

## Management and automation

Open **Management** from the internal sidebar.

Administrators also see **Account administration**. Verify the user's identity before setting a temporary password, share it through an approved private channel, and ask the user to change it after login. Suspend access promptly when a person no longer needs the portal; suspension immediately invalidates that account's existing sessions. The current administrator cannot suspend their own account, and the last active administrator is protected.

### Dashboards

Review active projects, open work, decisions, gate blockers, stage aging, compliance, readiness, procurement, client experience, automation failures, and operational alerts. Metrics come from authoritative source records; correct the underlying workspace record when a metric is wrong.

### Run a safe automation scan

Select **Run safe automation scan** to detect overdue actions, escalation conditions, missing inquiry information, document classifications, meeting summaries, readiness gaps, quote comparisons, and lead-time risks.

The scan cannot approve a project, clear a gate, select a vendor, or rewrite an authoritative source record.

### Review suggestions

In **Human review queue**:

1. Read the source, rationale, and suggested values.
2. Add a review note when useful.
3. Select:
   - **Accept** to record acceptance without changing the source;
   - **Accept & create task** to create an internal follow-up; or
   - **Reject** to retain a rejected decision in the audit history.

Never treat a pending suggestion as a confirmed project fact.

### Delivery outbox and trigger matrix

Use **Retry** on failed external delivery after the provider is available. The in-app notice remains authoritative. The notification trigger matrix explains which events create notices and who receives them.

---

## Client portal

### Submit an inquiry

1. Sign in as Client and open **My Inquiry**.
2. Enter project goals, preliminary scope, budget, timing, and referral information.
3. Enter property, jurisdiction, and HOA information.
4. Attach a photo or document if useful.
5. Select **Submit inquiry**.

### Respond to requested information

Review the yellow information-request card, supply the requested information or file, then select **Mark provided**. Internal verification is still required.

### Review and approve

- Use **My Project** for progress and client-visible records.
- In Design, review submitted versions and select **Approve** or **Request changes**.
- In Procurement, review an applicable substitution and select **Authorize substitution**.
- Use **My Documents** and **My Communications** for associated files and contact history.

---

## Documents, notifications, and communications

### Documents

Upload files from a client's **Documents** tab or the inquiry attachment control. Add a meaningful description. Supported formats include common images, PDF, Word, Excel, plain text, and ZIP; maximum size is 10 MB. Files are rejected when extension, declared type, and actual content do not match.

Use **View** for supported inline content or **Download** for the original file. All file access is authenticated and client-scoped. Soft-deleted files are hidden; active legal holds prevent deletion.

### Notifications

Select the bell, review unread items, and follow the linked record when available. Mark individual notices or all notices read after review. In-app notices remain available even when external email delivery fails.

### Communications

1. Open the client's **Communications** tab.
2. Select **Log Communication**.
3. Choose type and direction.
4. Enter a useful subject and body.
5. Save.

Record approvals in the appropriate decision or approval record too; a communication note alone is not an approval.

---

## Testing checklist

### Administrator test

- [ ] Sign in as Administrator.
- [ ] Open Dashboard, Clients, Inquiries, and Management.
- [ ] Add or inspect a client.
- [ ] Add a consultation, document, and communication.
- [ ] Create, qualify, and convert an inquiry.
- [ ] Add, complete, and verify a project action.
- [ ] Assign a team member.
- [ ] Create and approve design and scope versions.
- [ ] Add compliance requirements and evidence.
- [ ] Complete a Construction Readiness Review.
- [ ] Add a vendor, request, quotes, PO, delivery, inspection, and invoice match.
- [ ] Run the safe automation scan and review a suggestion.

### Client test

- [ ] Sign out and sign in as Client.
- [ ] Confirm internal navigation is hidden.
- [ ] Submit or review an inquiry.
- [ ] Mark a client-visible information request provided.
- [ ] Review My Project, My Documents, and My Communications.
- [ ] Review client-visible workflow records.
- [ ] Approve a submitted design or authorize an applicable substitution.
- [ ] Confirm `/management` redirects back to the client portal.

---

## Troubleshooting

### The application does not open

Confirm `npm run dev` is still running and use `http://localhost:3000`, not the backend port.

### Login fails

Check the credentials exactly. Repeated failures may trigger a temporary rate limit. Select **Forgot Password?** for the current recovery instructions. In production's in-app-only mode, the page directs the user to the approved support address; an administrator must verify identity and use **Management → Account administration** to set a temporary password.

### A button is missing

The action may be restricted by role, assignment, current stage, record status, or client visibility. Test with Administrator to distinguish a permission rule from a display issue.

### Advance stage is disabled

Read every item in **Current gate**. Complete and verify the linked work, evidence, approvals, readiness, or procurement records, then reload the command center.

### A client cannot see a record

Confirm the login is linked to the correct client, the record belongs to that client/project, **Client visible** is enabled where applicable, and the record is not deleted.

### An upload is rejected

Confirm the file is no larger than 10 MB and its extension matches its real content. Renaming an extension does not convert a file.

### Email delivery shows Failed

External email delivery is not enabled in the validated production package. In-app notices remain authoritative. Do not tell a user that an email was sent; use the approved support and administrator-recovery process unless a future email integration is implemented and separately verified.

### Test data changed

Local actions persist. Use a new fixture or restore the test database when you need a clean scenario.

---

## Operating principle

Preserve the history. Create a revision, correction, exception, or follow-up action instead of deleting or rewriting an approved record. The portal is designed to make ownership, evidence, decisions, and readiness traceable.
