# End-to-End QA Report

**Application:** Construction Client Portal  
**Environment:** Hostinger production deployment  
**Test date:** September 4, 2026  
**Scope:** Initial lead/inquiry through Design, Compliance, Pre-Construction, Procurement, and Field Execution handoff.

## Executive summary

The application is functional enough for continued internal development, but it is not ready to treat a completed workflow as a trustworthy contracted-client handoff.

**Current functional readiness: 6/10**

The happy path can be completed. Inquiry qualification, design approvals, procurement controls, delivery inspection, invoice matching, audit events, notifications, and the final field-execution handoff all responded successfully. However, the test also found release-blocking workflow weaknesses:

- A user can mark every pre-construction condition ready with a click, including “Executed contract verified,” without uploading or linking a contract, recording evidence, or requiring a separate reviewer.
- The client remains labeled **LEAD** after the project reaches **FIELD EXECUTION**.
- The legacy project phases remain mostly **NOT STARTED**, even though the new lifecycle is complete.
- Compliance and procurement can appear ready when there are no required records to evaluate.
- The application reports zero team assignments while allowing readiness to pass.

These issues create a risk that the portal will show a project as ready for construction when the underlying business proof is incomplete.

## Test record

The test used clearly labeled records:

- Client: `QA E2E Lead 2026-09-03`
- Company: `Portal QA — TEST DATA`
- Email: `qa-e2e-20260903@example.invalid`
- Project: `9318249c-31f4-4145-a20a-344c501e14c3`
- Vendor: `QA Test Materials Vendor`
- Procurement request: test variable-speed pool pump
- Purchase order: `QA-PO-20260903-001`
- Invoice: `QA-INV-20260904-001`

The test records were left in place so the findings remain inspectable. They should be archived or removed only after approval, using the application's normal controls.

## Coverage and result

| Area | Result | Notes |
|---|---|---|
| Create lead/client | Pass with workflow friction | A client had to be created before the inquiry could be captured. |
| Create initial inquiry | Pass | Required property, objectives, scope, budget, timing, source, owner, and next action were captured. |
| Move inquiry through review | Pass | NEW → IN REVIEW → QUALIFIED worked. |
| Consultation outcome | Partial | An empty Record action produced no visible validation message; a valid outcome worked. |
| Convert inquiry to Design | Pass | Conversion correctly required qualification and a completed consultation outcome. |
| Design version approval | Pass | Draft → review → approval worked. |
| Scope approval | Pass | Draft → review → approval worked. |
| Design gate | Pass | The gate blocked until both design and scope were approved. |
| Compliance gate | Fail-open risk | A project with no requirements initially appeared ready. A created required permit was correctly enforced afterward. |
| Compliance evidence | Partial | Required evidence was enforced once a requirement existed; no-record projects were not blocked. |
| Pre-construction readiness | Fail | All 19 default items could be marked ready without evidence, artifacts, assignments, or independent verification. |
| Readiness review | Partial | Review, submission, approval, and audit worked, but the approval could be performed by the same admin who completed the work. |
| Procurement gate | Fail-open risk | A project with no requests initially appeared ready. A created required request was correctly enforced afterward. |
| Vendor and quote controls | Pass | Only an approved vendor could be used; quote selection and authorization worked. |
| Purchase order | Partial | Backend creation succeeded; the UI relies on `window.prompt`, which did not reliably open in the in-app browser and gave no useful feedback. |
| Delivery and inspection | Pass with status concern | Delivery recording and inspection passed; request status displayed an unexpected BACKORDERED state during the test and needs investigation. |
| Three-way invoice match | Pass | Matching completed with zero variance. |
| Procurement closure | Partial | Premature close was rejected safely, but the UI did not show a clear error. |
| Final handoff | Pass technically | Procurement was approved and the project became FIELD EXECUTION. |
| Client status | Fail | Client remained LEAD after field-execution handoff. |
| Legacy phase synchronization | Fail | Legacy phases remained NOT STARTED/IN PROGRESS despite the new lifecycle being complete. |
| Team ownership | Fail | Project showed zero team assignments after readiness approval. |
| Notifications | Partial | In-app notifications worked. External email delivery was not configured; management showed 35 failed deliveries. |
| Management reporting | Partial | Field Execution appeared in reporting, but client status, team count, legacy phases, and notification health were inconsistent. |
| Audit timeline | Pass | Stage advances and approvals were visible in the project timeline. |

## Critical findings

### P0 — Construction readiness can be certified without business proof

The pre-construction screen allowed all default items to move to READY by clicking completion actions. This included:

- Executed contract verified
- Approved scope reconciled to the contract
- Engineering, permits, and HOA conditions confirmed
- Project team and accountable roles assigned
- Project kickoff completed

No contract document, evidence link, reviewer confirmation, team assignment, or date-based proof was required for the items. The review could then be submitted and approved, allowing the project to advance to Procurement and Field Execution.

**Why it matters:** This is the highest business risk. A construction project can be represented as ready even when the signed agreement, team ownership, and supporting documentation are missing.

**Acceptance criteria:**

- Contract-related items cannot become READY without a linked current contract artifact or an explicitly approved exception.
- Evidence-required items cannot become READY without current evidence.
- Team-assignment items cannot become READY unless the required active roles exist.
- A completion action creates READY_FOR_REVIEW when review is required.
- The person completing an item cannot approve their own item unless an explicitly documented emergency override is used.
- The gate re-evaluates all invariants server-side at submission, approval, and stage advancement.

### P0 — Empty Compliance and Procurement registers pass by omission

The gate logic evaluates required records that exist, but does not require the required register to contain records. Therefore, an empty Compliance or Procurement collection can produce zero blockers and a ready gate.

**Why it matters:** Missing work is indistinguishable from completed work.

**Acceptance criteria:**

- Each stage has a minimum required record policy, or a deliberate NOT_APPLICABLE decision with reason and approval.
- Empty required registers are BLOCKED, not READY.
- The UI explains exactly which minimum records are missing.
- Tests cover empty, incomplete, exception-approved, and complete states.

### P0 — Client and project status do not agree

After the tested project reached Field Execution:

- Management showed the project as FIELD EXECUTION.
- The client detail page still showed the client as LEAD.
- The new lifecycle stages were approved.
- The legacy phases remained mostly untouched.

**Why it matters:** Staff cannot reliably answer whether the customer is a lead, active customer, contracted client, or active construction project.

**Acceptance criteria:**

- Define the authoritative status model for client, project, lifecycle stage, and legacy phase.
- Advancing to the contracted milestone updates the client status or explicitly records the client as contracted/active.
- Legacy phases are either synchronized, retired from the active view, or clearly labeled as historical.
- Dashboard, client detail, command center, and reports use the same status source.

## High-priority findings

### P1 — No separate contracted-client milestone is enforced

The legacy checklist contains contract-related items, but the tested new lifecycle reached Field Execution without a signed contract record. The application currently treats readiness item status as sufficient proof.

Add a first-class contract record or a mandatory contract evidence link, including signed date, parties, amount, deposit/payment terms, current version, and approving reviewer.

### P1 — Team assignment is displayed as zero after approval

The command center showed **Team assignments: 0** and “No accountable team assignments have been made,” while the readiness item “Project team and accountable roles assigned” had been marked ready.

Make assignments a real gate condition. At minimum, require an active project owner and the roles that the business identifies as mandatory before readiness can pass.

### P1 — Purchase order entry depends on browser prompt

The Issue PO action calls `window.prompt`. In the in-app browser, the prompt did not reliably appear, so the action could not be completed through the visible interface even though the backend endpoint worked.

Replace the prompt with an inline or modal form with validation, a visible success state, and a visible error state.

### P1 — Date/time values are ambiguous and shifted

The procurement required-by value entered in the browser as December 15, 2026 at 12:10 PM displayed as December 15, 2026 at 7:10 AM after saving. The application sends `datetime-local` values as timezone-less strings and parses them on the server.

Choose one policy and apply it consistently: store UTC with explicit client timezone conversion, or store a local business date/time with an explicit timezone. Add round-trip tests around daylight-saving changes.

### P1 — External email delivery is not configured

Management reported 35 failed external deliveries and explicitly stated that the external notification provider is not configured. In-app notifications remained available.

Before client rollout, configure and test the intended email provider, or change the product contract to clearly state that in-app notifications are authoritative and add an operational process for monitoring them.

### P1 — Failed actions are not consistently visible to the user

The following failures did not provide a clear visible explanation during testing:

- Recording a blank consultation outcome.
- Closing procurement before invoice verification.
- Issuing a PO when the browser prompt did not open.

Every failed mutation should show a persistent, human-readable message near the action and retain the server's useful reason.

## Medium-priority findings

### P2 — Initial lead capture is split into two records

The inquiry form requires selecting an existing client. A new prospect cannot be captured in one step. Staff must create the client first, then create the inquiry.

Consider a “New lead” flow that creates the client and inquiry together while preventing duplicate contacts.

### P2 — Separation of duties is optional for administrators

The same admin account was able to complete, submit, and approve readiness work. Similar self-approval behavior is possible for design and scope decisions.

Require a different reviewer for normal approval, with a clearly audited override for exceptional cases.

### P2 — Dashboard metric definitions need alignment

The management screen showed “Automation failures 1,” while the detailed automation health section showed “Failed / partial 0 / 1.” The meaning of these values is not immediately clear.

Define each metric, use consistent labels, and link each alert to the records behind the count.

### P2 — Status display is inconsistent within Compliance

The requirement card displayed APPROVED while the expandable details status select still displayed NOT STARTED during the test. Confirm whether this is stale local state or a persisted data mismatch.

## What worked well

- Authentication and role boundaries behaved correctly in the existing automated suite.
- Inquiry conversion enforced important prerequisites.
- Design advancement correctly required both an approved design and an approved scope.
- Procurement controls worked once a required request existed: vendor approval, quote selection, PO creation, delivery inspection, invoice matching, and closure were all supported.
- Premature procurement closure was rejected by the backend.
- Audit events were recorded for stage movement and approvals.
- In-app notifications were generated and visible.
- The production deployment remained available throughout the test.

## Automated verification

The local project verification completed successfully:

- Backend automated tests: **34 passed, 0 failed**
- Backend production build: **passed**
- Frontend production build: **passed**

The existing suite is valuable for security and normal operations, but it does not cover the live failures above. Add regression tests for empty registers, evidence-less readiness, missing team assignments, self-approval, client status synchronization, legacy phase synchronization, and timezone round trips.

## Recommended implementation order

### Phase 0 — Protect the business handoff

1. Make Compliance and Procurement gates fail closed when required records are absent.
2. Add server-side readiness invariants for evidence, contract proof, assignments, and required roles.
3. Enforce separate submitter/reviewer identities for normal approvals.
4. Add regression tests for every P0 finding.

### Phase 1 — Make the workflow dependable for staff

1. Replace browser prompts with forms or modals.
2. Add visible, consistent mutation errors and success confirmations.
3. Resolve date/time storage and display policy.
4. Investigate the BACKORDERED status observed during delivery testing and define the status transition rules.
5. Configure or formally disable external email delivery with a documented operating procedure.

### Phase 2 — Make the record understandable to the business

1. Define and implement the authoritative client/project status model.
2. Synchronize or retire the legacy phase view.
3. Add the first-class contracted milestone and contract artifact requirement.
4. Add one-step new-lead intake.
5. Align management metrics and expose drill-down links.

## Release recommendation

**Do not use the current Field Execution approval as proof that a customer is contracted and construction-ready.** Continue development locally or in a controlled staging workflow until all P0 items pass regression testing. The application is suitable for internal demonstrations and controlled QA, but the current production workflow is not yet reliable enough for unsupervised real-client handoffs.
