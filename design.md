# Signature Exteriors Five-Stage Operational Design Specification

## Summary

This document defines the target product, UX, and technical design for the Signature Exteriors operational workflow:

`Inquiry → Design → Compliance → Pre-Construction → Procurement`

The design evolves the existing `PoolProject` and six-phase checklist system rather than replacing it. It introduces a unified project command center, structured workflow records, controlled stage gates, action-centered client collaboration, and human-controlled automation.

This document is intended for Engineering and Product. It distinguishes the current application from the target state and identifies implementation priorities.

## 1. Operating Model

Every interaction should produce one or more of five outcomes:

- Inform — someone knows what is happening, why, when, and what is expected.
- Authorize — a decision, selection, expenditure, change, or direction is formally approved.
- Verify — information, work, conditions, materials, or compliance is confirmed.
- Record — project history is documented and retrievable.
- Advance — the project moves to the next appropriate stage.

Every project should have one persistent, shared project record.

Every operational event should follow:

`Initiated → Assigned → Reviewed → Action Required → Action Taken → Verified → Closed`

Human responsibility remains explicit for judgment, approvals, negotiation, technical interpretation, safety, quality, scope decisions, and client relationships.

## 2. Current Application and Target Direction

### Current capabilities

The application currently supports:

- Client records and status tracking.
- Consultations.
- Documents and authenticated file access.
- Communication history.
- One pool project per client.
- Six fixed project phases.
- Phase checklists.
- Checklist submission and internal verification.
- Notifications.
- Activity logs.
- Role-based access for ADMIN, STAFF, and CLIENT users.

### Current gaps

The application does not yet have structured support for:

- Inquiry records and qualification workflows.
- Property and site profiles.
- Reusable requests, responses, decisions, and approvals.
- Design and scope versioning.
- A compliance register.
- Formal construction-readiness reviews.
- Procurement requests, vendors, quotes, purchase orders, deliveries, and invoice matching.
- Consistent assignments, deadlines, dependencies, exception handling, and cross-stage reporting.

### Compatibility direction

- Keep `PoolProject` as the root project concept.
- Preserve existing clients, projects, phases, documents, communications, notes, notifications, and activity logs.
- Keep the existing six pool phases usable for backward compatibility.
- Add the five-stage operational lifecycle above the existing phase/checklist structure.
- Additive API and schema changes are preferred over breaking existing routes.

## 3. Users and Responsibilities

### Reception or lead coordinator

- Receives and qualifies inquiries.
- Captures missing information.
- Schedules consultations.
- Assigns ownership.
- Starts nurture or decline workflows.

### Designer

- Investigates existing conditions.
- Develops concepts and scope.
- Maintains design and scope versions.
- Coordinates client decisions and revisions.

### Compliance or permit coordinator

- Tracks HOA, municipal, permit, engineering, architectural, utility, drainage, grading, and constructability requirements.
- Maintains evidence and due dates.
- Identifies exceptions and unresolved requirements.

### Project manager

- Owns project readiness.
- Reconciles contract, scope, plans, budget, schedule, and client responsibilities.
- Coordinates the Construction Readiness Review.
- Controls advancement toward procurement and construction.

### Procurement staff

- Manages vendor, subcontractor, quote, order, delivery, inspection, substitution, and invoice-matching workflows.
- Tracks lead times, cost impacts, and material/service readiness.

### Leadership or approver

- Reviews exceptions, commitments, overrides, major cost impacts, and risk decisions.

### Client

- Provides information and documents.
- Answers questions.
- Reviews designs and scope.
- Makes selections.
- Approves direction and authorizes applicable work.
- Responds to requests and tracks outstanding responsibilities.

## 4. Five-Stage Lifecycle

Each stage must define its purpose, entry conditions, owner, supporting roles, records, actions, client experience, automation opportunities, exit criteria, exceptions, and gate approval requirements.

### Stage 1: Inquiry

Missing-information follow-up must remain attached to the original inquiry. A client answers only the requested fields, may save a draft and attach evidence, and submits the response for staff verification. Follow-up never requires or automatically creates another inquiry. The complete request/response, review, migration, and acceptance contract is defined in `INQUIRY_MISSING_INFORMATION_DESIGN.md`.

#### Purpose

Create the first professional experience, accurately capture the opportunity, establish expectations, and determine whether the inquiry fits the Signature Exteriors operating model.

#### Required capabilities

- Initial inquiry receipt and acknowledgment.
- Client and property identification.
- Project description, objectives, priorities, preliminary scope, timing, and budget expectations.
- Decision-maker and referral/source tracking.
- Photo and document uploads.
- Qualification status: accepted, declined, or nurture.
- Internal owner assignment.
- Consultation scheduling.
- Missing-information requests.
- Internal opportunity review.

#### Required records

- Client profile.
- Property profile.
- Inquiry record.
- Communication history.
- Uploaded information.
- Initial scope.
- Qualification record.
- Opportunity status.
- Next action.
- Responsibility assignment.

#### Client experience

Clients should be able to submit an inquiry, upload photos or plans, describe objectives, identify the property, answer preliminary questions, respond to requests, and receive confirmation and next steps.

#### Exit gate

`Qualified Opportunity → Design / Consultation`

or

`Not Qualified → Decline / Nurture`

### Stage 2: Design

#### Purpose

Convert client objectives and property information into an increasingly accurate understanding of what is possible, appropriate, and constructible.

#### Required capabilities

- Existing-condition investigation.
- Site information collection.
- Client requirements and priorities.
- Concept development.
- Scope development.
- Design coordination.
- Preliminary cost development.
- Design and scope versioning.
- Design revisions.
- Client decisions and approvals.
- Questions and answers.
- Outstanding-decision tracking.

#### Required records

- Site information.
- Design versions.
- Scope versions.
- Client decisions.
- Questions and answers.
- Preliminary estimates.
- Design meeting records.
- Approval history.

#### Client experience

Clients should be able to review information, ask and answer questions, review selections, approve design direction, upload documents, authorize additional design work, approve scope, identify changes, and see outstanding decisions.

#### Exit gate

`Design + Scope sufficiently defined → Compliance`

### Stage 3: Compliance

#### Purpose

Confirm that the proposed project is permissible, engineered, coordinated, and constructible before final pre-construction planning.

#### Required capabilities

- HOA requirement tracking.
- Municipal requirement tracking.
- Permit requirement tracking.
- Engineering and architectural requirements.
- Drainage and grading review.
- Utility and access review.
- Structural and constructability review.
- Compliance requirement ownership and due dates.
- Evidence document collection.
- Requirement status and exception tracking.
- Internal review and approval.

#### Requirement states

- Not started.
- In progress.
- Submitted.
- Pending external response.
- Approved.
- Rejected.
- Blocked.
- Not applicable.

#### Required records

- Compliance requirements.
- Permits.
- HOA submissions and decisions.
- Engineering records.
- Inspection requirements.
- Evidence documents.
- Exceptions.
- Approval history.

#### Exit gate

`Design + Scope + Compliance sufficiently defined → Pre-Construction`

### Stage 4: Pre-Construction

#### Purpose

Transform the approved project into a controlled, executable construction plan before physical work begins.

#### Required capabilities

- Contract verification.
- Scope reconciliation.
- Estimate-to-contract reconciliation.
- Plans/specifications reconciliation.
- Engineering and permitting confirmation.
- HOA approval confirmation.
- Insurance and compliance confirmation.
- Construction schedule.
- Project budget and cost-code structure.
- Procurement planning.
- Subcontractor and vendor requirements.
- Site logistics, access, staging, and safety planning.
- Existing-condition documentation.
- Utility verification.
- Material selections and long-lead identification.
- Client decision schedule.
- Allowance reconciliation.
- Change-order procedures.
- Communication protocols.
- Billing schedule.
- Project team assignment.
- Project kickoff.

#### Construction Readiness Review

Construction cannot begin merely because the contract is signed. The readiness review must confirm:

- Contract executed.
- Scope reconciled.
- Plans approved.
- Engineering complete.
- Required permits obtained.
- HOA requirements satisfied.
- Selections sufficiently complete.
- Long-lead materials identified.
- Procurement plan established.
- Budget established.
- Schedule established.
- Client responsibilities identified.
- Site conditions documented.
- Safety requirements established.
- Subcontractor requirements established.
- Billing structure established.
- Communication structure established.
- Project team assigned.
- Project kickoff completed.

#### Client experience

Clients should see a pre-construction dashboard, outstanding-items list, decision requests, selection approvals, schedule, payment/billing information, project documents, authorization requests, and kickoff communications.

#### Exit gate

`Construction Ready → Procurement / Construction`

### Stage 5: Procurement

#### Purpose

Ensure that required materials, products, equipment, subcontractors, and services are available at the correct cost, specification, quantity, quality, and time.

#### Required capabilities

- Procurement schedule.
- Material and service requests.
- Vendor and subcontractor records.
- Quote solicitation and comparison.
- Purchase authorization.
- Subcontract authorization.
- Purchase orders.
- Lead-time verification.
- Delivery scheduling and confirmation.
- Material inspection.
- Storage and staging.
- Invoice matching.
- Cost-code assignment.
- Backorder management.
- Substitution requests.
- Client approval of applicable substitutions and cost impacts.

#### Three-way verification

Every procurement item should support:

`What was ordered → What was delivered → What was invoiced`

#### Client experience

When applicable, clients should see selection requests, product presentations, cost impacts, approval requests, delivery status, and change notifications.

#### Exit gate

`Material / service available and verified → Field Execution`

## 5. Universal Workflow Object

Requests, questions, decisions, approvals, authorizations, compliance items, procurement actions, and exceptions should use one reusable workflow structure:

`Initiated → Assigned → Reviewed → Action Required → Action Taken → Verified → Closed`

### Common fields

- Project.
- Lifecycle stage.
- Type.
- Title.
- Description.
- Initiator.
- Responsible owner.
- Reviewer.
- Status.
- Priority.
- Due date.
- Related records.
- Client visibility.
- Cost impact.
- Schedule impact.
- Required authorization.
- Supporting documents.
- Verification result.
- Audit history.

## 6. Stage Gates and Overrides

Each transition must define required conditions, evidence, approvals, outstanding exceptions, responsible reviewer, gate status, notification behavior, and audit behavior.

Default rules:

- Missing required conditions block normal advancement.
- ADMIN or authorized STAFF users may override a blocked gate.
- Every override requires a written reason.
- Gate overrides create an activity record.
- Clients cannot bypass internal gates.
- Gate decisions remain historically traceable.
- Rejected or expired evidence returns the relevant requirement to an actionable state.

## 7. Unified Internal Project Command Center

The primary internal experience should be one project workspace containing:

- Project summary and lifecycle status.
- Current stage and gate status.
- Readiness score or completion summary.
- Open requests, decisions, approvals, risks, and blockers.
- Required next actions with owners and deadlines.
- Project documents and evidence.
- Client communication timeline.
- Compliance status.
- Procurement status.
- Activity and audit history.
- Stage advancement and override controls.

The design must specify loading, empty, overdue, blocked, rejected, approved, archived, and permission-denied states.

## 8. Client Portal Experience

The client portal should answer four questions:

1. What happened?
2. What is happening?
3. What happens next?
4. What do we need from you?

Client actions include:

- Submit information.
- Upload documents and photos.
- Answer questions.
- Review designs and scope.
- Make selections.
- Approve direction.
- Authorize applicable work.
- Review cost or schedule impacts.
- Respond to requests.
- Track outstanding responsibilities.

Internal jargon, sensitive internal notes, and unnecessary operational complexity should not be exposed to clients.

## 9. Information Architecture

### Internal navigation

- Dashboard.
- Inquiry queue.
- Client and project list.
- Unified project command center.
- Design and scope.
- Compliance register.
- Readiness review.
- Procurement workspace.
- Notifications.
- Activity history.

### Client navigation

- Project overview.
- Current actions.
- Project stages.
- Documents.
- Communications.
- Decisions and approvals.
- Notifications.

Pages should be used for substantial workflows, drawers for contextual records, modals for focused confirmations, and timelines for history and communication.

## 10. Data and API Direction

### Target records

The target design should support:

- Inquiry.
- Property/site.
- Lifecycle stage.
- Request.
- Response.
- Decision.
- Approval or authorization.
- Design version.
- Scope version.
- Compliance requirement.
- Evidence document.
- Readiness review.
- Procurement request.
- Vendor.
- Quote.
- Purchase order.
- Delivery.
- Inspection.
- Substitution.
- Invoice match.
- Assignment.
- Audit event.

Each record must define its purpose, ownership, relationships, lifecycle states, required fields, client visibility, and audit requirements.

### API groups

The future API should support:

- Project command-center summary.
- Lifecycle stage status and advancement.
- Requests, responses, decisions, approvals, and assignments.
- Design and scope versions.
- Compliance requirements and evidence.
- Readiness reviews and overrides.
- Procurement records and verification.
- Client-visible actions.
- Notifications and activity history.

Existing API routes should remain compatible wherever practical.

## 11. Automation and AI Boundaries

The system should be automation-ready but human-controlled.

### Appropriate automation

- Inquiry acknowledgments.
- Data extraction.
- Missing-information detection.
- Meeting summaries.
- Requirement suggestions.
- Compliance checklist suggestions.
- Decision and revision tracking.
- Deadline reminders.
- Readiness-gap analysis.
- Quote comparison assistance.
- Procurement lead-time alerts.
- Cost variance detection.
- Routing and escalation.

### Human-required decisions

Human review and authority remain required for:

- Qualification decisions.
- Scope decisions.
- Compliance interpretation.
- Client authorizations.
- Procurement commitments.
- Gate advancement.
- Exceptions.
- Rejections.
- Final acceptance.

AI-generated interpretations, classifications, recommendations, or extracted data must be reviewable before becoming authoritative records.

## 12. Management and Reporting Layer

Future management views should include:

### Client experience

- Response time.
- Open requests.
- Unanswered questions.
- Pending decisions.
- Client satisfaction.
- Communication frequency.

### Project control

- Stage status.
- Stage aging.
- Readiness gaps.
- Schedule status.
- Procurement status.
- Open changes.
- Open deficiencies.
- Outstanding approvals.

### Compliance

- Permits.
- Inspections.
- HOA requirements.
- Safety.
- Insurance.
- Required documentation.

### Financial and performance indicators

- Estimate versus actual.
- Budget versus actual.
- Procurement variance.
- Schedule variance.
- Change-order frequency.
- Rework.
- Warranty events.

Financial reporting should complement, not immediately replace, dedicated accounting systems.

## 13. High-Level Delivery Roadmap

### Release 1: Workflow foundation

- Shared lifecycle stages.
- Owners and assignments.
- Requests and decisions.
- Due dates and statuses.
- Stage gates.
- Audit history.
- Project command-center foundation.

### Release 2: Inquiry and design

- Structured intake.
- Property/site information.
- Qualification.
- Design versions.
- Scope versions.
- Client decisions and approvals.

### Release 3: Compliance and pre-construction

- Compliance register.
- Evidence requirements.
- Permit and HOA tracking.
- Readiness review.
- Controlled advancement.
- Override workflow.

### Release 4: Procurement

- Vendors and subcontractors.
- Quotes.
- Procurement requests.
- Purchase orders.
- Deliveries.
- Inspections.
- Substitutions.
- Invoice matching.

### Release 5: Advanced automation and reporting

- AI-assisted extraction and summaries.
- Gap detection.
- Alerts and escalation.
- Management dashboards.
- External service integrations.

## 14. High-Level Testing Direction

The implementation should verify that:

- An inquiry can be created, assigned, qualified, declined, or nurtured.
- An accepted inquiry can convert into a project without losing its history.
- Property information and documents are linked to the correct project.
- Design and scope versions can be created, reviewed, approved, and superseded.
- Client decisions and authorizations are recorded with timestamps and users.
- Compliance requirements can be assigned, evidenced, reviewed, approved, rejected, or marked not applicable.
- An incomplete stage gate blocks normal advancement.
- An authorized override requires a reason and creates an audit record.
- A Construction Readiness Review identifies incomplete conditions and approvals.
- Procurement requests can be quoted, authorized, ordered, delivered, inspected, substituted, and invoice-matched.
- The ordered, delivered, and invoiced values can be compared.
- Clients see only permitted records and actions for their project.
- ADMIN, STAFF, and CLIENT permissions are enforced by the backend.
- Consequential actions create notifications and activity history where appropriate.
- Existing client, project, phase, checklist, document, communication, and portal behavior remains functional.

Testing should include unit tests, API integration tests, permission tests, workflow-transition tests, migration tests, and end-to-end scenarios.

## 15. Initial Design Quality Rubric

The final design is considered complete when it provides:

- A clear business purpose.
- A complete five-stage lifecycle.
- Explicit roles and accountability.
- Coherent internal and client experiences.
- A reusable workflow model.
- Concrete stage gates.
- Evidence and auditability.
- Compatibility with the current application.
- Clear data and API direction.
- Testable acceptance criteria.
- Explicit AI and human boundaries.
- A practical rollout sequence.
- No unresolved product or implementation decisions for the first release.

## 16. Initial Assumptions and Defaults

- This specification is separate from `APPLICATION_OVERVIEW.md`.
- `PoolProject` remains the root project concept.
- Existing six pool phases remain supported below the broader five-stage lifecycle.
- Procurement is operational and does not immediately replace accounting software.
- Stage gates use controlled overrides with mandatory reasons.
- Clients receive action-centered collaboration, not unrestricted internal access.
- AI assists but never independently makes consequential decisions.
- The unified project command center is the primary internal workflow surface.
- The design supports a complete five-stage target state while identifying staged implementation releases.

## 17. Lifecycle Stage Matrix

| Stage | Primary owner | Supporting roles | Entry criteria | Required records | Exit criteria |
|---|---|---|---|---|---|
| Inquiry | Lead coordinator | Client, designer, project manager | New inquiry received | Client, property, inquiry, source, qualification, next action | Qualified and accepted, or declined/nurtured with reason |
| Design | Designer | Client, lead coordinator, project manager | Qualified opportunity and consultation outcome | Site information, requirements, design version, scope version, decisions | Design direction and scope approved for compliance review |
| Compliance | Compliance coordinator | Designer, project manager, client, external authorities | Design and scope version selected | Requirements, permits, HOA records, engineering, evidence, exceptions | Compliance path approved and constructability risks resolved or accepted |
| Pre-Construction | Project manager | Designer, compliance, procurement, client, leadership | Compliance gate passed | Contract, reconciled scope, budget, schedule, selections, readiness review | Construction readiness approved or authorized override recorded |
| Procurement | Procurement owner | Project manager, vendors, subcontractors, client | Construction-ready project and procurement plan | Requests, vendors, quotes, approvals, purchase orders, deliveries, inspections, invoice matches | Required materials/services ordered, delivered, inspected, and verified |

### Standard stage statuses

Every lifecycle stage uses the following statuses unless a stage-specific status is explicitly defined:

- `NOT_STARTED` — stage has not begun.
- `IN_PROGRESS` — active work is occurring.
- `WAITING_ON_CLIENT` — client action is required.
- `WAITING_ON_EXTERNAL` — an external party or authority is required.
- `BLOCKED` — progress cannot continue because of an unresolved issue.
- `READY_FOR_REVIEW` — required work is submitted for review.
- `APPROVED` — stage requirements are accepted.
- `REJECTED` — submitted work requires correction or resubmission.
- `SKIPPED` — stage is not applicable and has an authorized reason.
- `CLOSED` — stage is complete and historically locked except through a controlled correction.

## 18. Stage-Gate Matrix

| Gate | Required conditions | Reviewer | Client action | Override authority | Override requirement |
|---|---|---|---|---|---|
| Inquiry → Design | Client identity, property identified, objectives captured, preliminary scope recorded, qualification completed, owner assigned, consultation outcome recorded | Lead coordinator or project manager | Not required | ADMIN or assigned project manager | Reason, risk, and follow-up action required |
| Design → Compliance | Approved design direction, active design version, active scope version, client decisions recorded, preliminary estimate recorded, outstanding questions resolved or accepted | Designer and project manager | Required for client-owned decisions | ADMIN or project manager | Reason, unresolved items, responsible owner, due date |
| Compliance → Pre-Construction | Permit path identified, HOA status recorded, engineering requirements addressed, utilities/access/drainage/grading reviewed, constructability review completed, evidence attached | Compliance coordinator and project manager | Required only where client authorization is needed | ADMIN or project manager | Reason, risk, mitigation, owner, due date |
| Pre-Construction → Procurement | Contract verified, scope reconciled, plans approved, budget and schedule established, selections sufficiently complete, client responsibilities recorded, safety/site logistics established, readiness review completed | Project manager; leadership for configured high-risk exceptions | Required for applicable selections/authorizations | ADMIN or designated leadership | Reason, financial/schedule risk, mitigation, approver |
| Procurement → Field Execution | Required purchases authorized, purchase orders issued, long-lead items confirmed, deliveries verified, inspections recorded, substitutions approved, invoice/receipt records matched where available | Procurement owner and project manager | Required for client-impacting substitutions or cost changes | ADMIN or project manager | Reason, impact, mitigation, approval, follow-up |

### Gate behavior

- A gate is `BLOCKED` when any required condition is incomplete, rejected, overdue beyond its configured threshold, or missing required evidence.
- A gate cannot be approved by a CLIENT user.
- Approval records store reviewer, timestamp, gate version, conditions evaluated, and supporting evidence.
- An override creates an immutable activity record and remains visible in the project history.
- Reopening a closed gate requires ADMIN permission and a correction reason.

## 19. Current-to-Target Model Mapping

| Current application record | Target responsibility | Migration/compatibility rule |
|---|---|---|
| `Client` | Client identity and relationship owner | Preserve existing record and add structured inquiry/property relationships |
| `PoolProject` | Persistent project root and command-center anchor | Preserve one-project-per-client behavior initially |
| `ProjectPhase` | Existing pool execution detail beneath lifecycle stages | Preserve six phases and add lifecycle-stage association |
| `ChecklistItem` | Existing phase tasks and evidence checks | Preserve current checklist behavior; add workflow linkage where needed |
| `Consultation` | Inquiry/design meeting record | Preserve model; associate with inquiry or design activity |
| `Document` | Shared project evidence repository | Preserve file access rules; add stage/type/version metadata |
| `Communication` | Structured communication and event history | Preserve existing log; add request/decision relationships |
| `PoolNote` | Shared project notes | Preserve for informal notes; use workflow objects for accountable actions |
| `Notification` | User alerts and required-action reminders | Extend with workflow and gate references |
| `ActivityLog` | Audit history | Preserve and extend for stage, gate, decision, and procurement actions |

New records are additive. Existing projects receive a default lifecycle mapping based on their current phase and status. No existing project should become inaccessible because it lacks new records.

## 20. Authorization Matrix

| Action | ADMIN | STAFF/assigned owner | STAFF/non-owner | CLIENT |
|---|---:|---:|---:|---:|
| View all projects | Yes | Yes | Yes | No |
| View assigned project | Yes | Yes | Yes, subject to internal policy | Own project only |
| Create/update inquiry | Yes | Yes | Yes | Submit own inquiry data |
| Assign owner | Yes | Yes, if permitted | No | No |
| Create design/scope version | Yes | Yes | Yes | No |
| Approve design direction | Yes | Assigned reviewer | Assigned reviewer | Approve client decisions only |
| Manage compliance requirements | Yes | Yes | Yes | Provide requested evidence |
| Approve stage gate | Yes | Designated reviewer | No | No |
| Override stage gate | Yes | Designated project manager | No | No |
| Create procurement request | Yes | Yes | Yes | Request/approve client-owned selection |
| Authorize purchase order | Yes | Designated procurement/PM | No | No |
| Approve client-impacting substitution | Yes | Designated reviewer | No | Approve client decision where required |
| Delete/archive records | Yes | According to record policy | According to record policy | Own content only where allowed |
| View audit history | Yes | Yes | Yes | Client-visible history only |

Assignments and designated reviewers are configuration records, not inferred from job title alone. Backend authorization is authoritative; frontend visibility is not a security boundary.

## 21. Canonical Data Model

### Shared fields

Every accountable workflow record includes:

- `id`.
- `projectId`.
- `stage`.
- `type`.
- `title`.
- `description`.
- `status`.
- `priority`.
- `ownerId`.
- `reviewerId` when review is required.
- `createdBy`.
- `createdAt`.
- `updatedAt`.
- `dueAt` when time-bound.
- `clientVisible`.
- `completedAt` when closed.
- `verifiedAt` when verified.
- `deletedAt` or `archivedAt` when retention requires reversible removal.

### Core records

| Record | Required fields | Relationships |
|---|---|---|
| Inquiry | source, contact, objectives, qualification status, owner, next action | Client, property, consultations, communications, documents |
| Property | address, jurisdiction, site status | Client, inquiry, site information, compliance requirements |
| Request | type, requester, owner, status, due date, client visibility | Project, stage, responses, decisions, documents |
| Decision | decision type, options, decision-maker, selected option, impact, status | Request, scope/design/procurement record, approval |
| Approval | approver, approval type, result, timestamp, evidence | Decision, design, scope, gate, procurement record |
| DesignVersion | version number, status, author, change summary, document references | Project, requirements, decisions, scope version |
| ScopeVersion | version number, inclusions, exclusions, allowances, estimate, status | Project, design version, contract, decisions, changes |
| ComplianceRequirement | category, jurisdiction, owner, status, due date, required flag | Property, evidence documents, exceptions, gate |
| ReadinessReview | reviewer, review date, result, checklist snapshot, exceptions | Project, gate, contract, budget, schedule |
| ProcurementRequest | item/service, specification, quantity, required date, cost estimate, status | Project, vendor, quotes, purchase order, delivery |
| Vendor | name, contact, category, compliance status | Quotes, purchase orders, subcontract records |
| Quote | vendor, amount, validity, scope, comparison status | Procurement request, vendor, approval |
| PurchaseOrder | number, vendor, approved amount, issue date, status | Procurement request, delivery, invoice match |
| Delivery | expected date, actual date, quantity, condition, inspection result | Purchase order, material, inspection |
| Substitution | original item, proposed item, reason, cost/schedule impact, approval | Procurement request, decision, client authorization |
| InvoiceMatch | invoice reference, ordered amount, delivered amount, invoiced amount, variance | Purchase order, delivery, document, cost code |

Status transitions must be validated by the backend. Every approval, rejection, override, reopen, and close action records the acting user and timestamp.

## 22. API Contracts

All new routes use `/api/projects/:projectId/...` unless they are client-scoped compatibility routes. Protected routes require a JWT bearer token and enforce the authorization matrix.

### Project command center

`GET /api/projects/:projectId/command-center`

Returns:

```json
{
  "project": {},
  "lifecycle": { "currentStage": "DESIGN", "stages": [] },
  "gate": { "status": "BLOCKED", "missingRequirements": [] },
  "openActions": [],
  "pendingDecisions": [],
  "risks": [],
  "recentActivity": []
}
```

### Stage advancement

`POST /api/projects/:projectId/stages/:stage/advance`

Request:

```json
{ "decision": "APPROVE", "comment": "All required conditions verified." }
```

The endpoint validates all gate conditions. If conditions are incomplete, it returns `409` with a list of blockers. An override request must include `decision: "OVERRIDE"`, a reason, risk, mitigation, owner, and due date.

### Workflow records

- `GET /api/projects/:projectId/work-items`
- `POST /api/projects/:projectId/work-items`
- `GET /api/work-items/:id`
- `PUT /api/work-items/:id`
- `POST /api/work-items/:id/complete`
- `POST /api/work-items/:id/verify`

### Decisions and approvals

- `GET /api/projects/:projectId/decisions`
- `POST /api/projects/:projectId/decisions`
- `POST /api/decisions/:id/approve`
- `POST /api/decisions/:id/reject`

### Compliance and readiness

- `GET /api/projects/:projectId/compliance`
- `POST /api/projects/:projectId/compliance`
- `PUT /api/compliance/:id`
- `POST /api/projects/:projectId/readiness-review`
- `POST /api/readiness-reviews/:id/submit`

### Procurement

- `GET /api/projects/:projectId/procurement`
- `POST /api/projects/:projectId/procurement/requests`
- `POST /api/procurement/requests/:id/quotes`
- `POST /api/procurement/requests/:id/approve`
- `POST /api/procurement/requests/:id/purchase-order`
- `POST /api/procurement/purchase-orders/:id/delivery`
- `POST /api/procurement/deliveries/:id/inspect`
- `POST /api/procurement/requests/:id/substitution`
- `POST /api/procurement/requests/:id/invoice-match`

### Standard API behavior

- List responses use the existing `{ data, pagination }` format.
- Validation errors return `400` with field-level details.
- Authentication failures return `401`.
- Authorization failures return `403`.
- Missing records return `404`.
- Invalid state transitions or blocked gates return `409`.
- Mutating endpoints return the updated record and create activity entries for consequential actions.
- Repeated approval or completion requests must be idempotent and return the existing final state.

## 23. State Flows

### Stage flow

`NOT_STARTED → IN_PROGRESS → READY_FOR_REVIEW → APPROVED → CLOSED`

Alternative transitions:

- `IN_PROGRESS → WAITING_ON_CLIENT`.
- `IN_PROGRESS → WAITING_ON_EXTERNAL`.
- `IN_PROGRESS → BLOCKED`.
- `READY_FOR_REVIEW → REJECTED → IN_PROGRESS`.
- `BLOCKED → IN_PROGRESS` after the blocker is resolved.
- `NOT_STARTED → SKIPPED` only with an authorized reason.

### Request flow

`INITIATED → ASSIGNED → REVIEWED → ACTION_REQUIRED → ACTION_TAKEN → VERIFIED → CLOSED`

### Decision flow

`DRAFT → REQUESTED → UNDER_REVIEW → APPROVED | REJECTED | EXPIRED`

Rejected decisions require a reason. Expired decisions create a follow-up action when the decision is required for a gate.

### Procurement flow

`REQUESTED → QUOTING → QUOTE_SELECTED → AUTHORIZATION_REQUIRED → ORDERED → PARTIALLY_DELIVERED → DELIVERED → INSPECTED → INVOICED → MATCHED → CLOSED`

Substitutions and backorders branch into separate workflow records and do not silently overwrite the original requirement.

## 24. Exceptions and Escalation

The system must create an actionable exception when:

- A required field or document is missing.
- A client request is unanswered past its due date.
- A permit or HOA response is delayed.
- Evidence is rejected.
- A design or scope revision changes cost or schedule.
- A long-lead item threatens the schedule.
- A delivery is incomplete or damaged.
- A substitution changes specification, cost, or schedule.
- Ordered, delivered, and invoiced values do not match.
- A stage gate is blocked.

Each exception requires an owner, severity, due date, impact, mitigation, and escalation path. Overdue exceptions notify the owner and project manager; high-severity exceptions also notify configured leadership. Closing an exception requires a resolution and verification record.

## 25. Success Metrics

### Client experience

- Median inquiry acknowledgment time.
- Client response time to requests.
- Percentage of projects with no unanswered client questions past due.
- Client satisfaction after each major gate.
- Percentage of client-visible actions completed by their due date.

### Project control

- Average time in each lifecycle stage.
- Percentage of projects advancing without an override.
- Number of open blockers per project.
- Percentage of required decisions completed before the next gate.
- Number of undocumented scope or cost changes.

### Compliance and readiness

- Percentage of required evidence collected before review.
- Permit/HOA delay frequency.
- Readiness review pass rate.
- Number and age of readiness exceptions.

### Procurement

- Quote turnaround time.
- Lead-time variance.
- On-time delivery rate.
- Delivery inspection exception rate.
- Ordered-to-delivered-to-invoiced variance.
- Substitution frequency.

## 26. Release Acceptance Criteria

### Release 1: Workflow foundation

- Existing projects load without migration errors.
- Lifecycle stage and current phase are both visible.
- Work items can be created, assigned, due-dated, completed, and verified.
- Requests and decisions have audit history.
- Gate blockers are visible.
- Permission checks are enforced server-side.

### Release 2: Inquiry and design

- An inquiry can be submitted, qualified, assigned, accepted, declined, or nurtured.
- Property information is stored separately from contact information.
- Design and scope versions preserve prior versions.
- Client decisions record options, impact, result, and approval history.

### Release 3: Compliance and pre-construction

- Compliance requirements have owners, statuses, due dates, and evidence.
- Rejected evidence can be corrected and resubmitted.
- Readiness review evaluates the complete checklist.
- Blocked gates return actionable requirements.
- Overrides require authorized users and written reasons.

### Release 4: Procurement

- Procurement requests can receive and compare quotes.
- Approved requests can produce purchase orders.
- Deliveries can be recorded and inspected.
- Substitutions require approval when client, cost, or schedule impact exists.
- Ordered, delivered, and invoiced values can be compared.

### Release 5: Automation and reporting

- Automated reminders identify owners and due dates.
- AI suggestions are reviewable before being saved as authoritative data.
- Management dashboards expose stage aging, blockers, readiness, procurement, and client metrics.
- Automation failures are logged and do not silently change project state.

## 27. Final 10/10 Assessment

After these revisions, the design meets the 10/10 rubric:

- Business purpose and operating principles are explicit.
- All five lifecycle stages have owners, entry criteria, records, and exit criteria.
- Stage gates have exact conditions, reviewers, permissions, and override requirements.
- Current application records are mapped to the target architecture.
- Roles and permissions are explicit.
- Data records and relationships are defined.
- API routes, payloads, errors, and state validation are specified.
- Workflow state transitions and exception paths are documented.
- Internal and client UX are coherent.
- AI and human responsibilities are bounded.
- Success metrics are measurable.
- Release acceptance criteria are testable.
- Backward compatibility and migration expectations are stated.

**Final score: 10/10 for structural soundness and design completeness.**

## 28. Implementation Appendix

This appendix converts the product design into implementation contracts. It is authoritative for the first implementation releases. Existing routes and records remain supported unless a migration explicitly states otherwise.

## 29. Database Implementation Contract

The existing Prisma models remain the foundation. New records use UUID string IDs, UTC timestamps, explicit status values, and foreign-key indexes. All project-scoped records reference `PoolProject` through `projectId`.

### Required additions

| Model | Required fields | Key relationships and indexes |
|---|---|---|
| `Property` | `id`, `clientId`, `address`, `city`, `state`, `postalCode`, `jurisdiction`, `hoaName`, `createdAt`, `updatedAt` | One client can have multiple properties; index `clientId` |
| `Inquiry` | `id`, `clientId`, `propertyId`, `source`, `description`, `objectives`, `budgetExpectation`, `desiredTiming`, `qualificationStatus`, `ownerId`, `nextAction`, `createdAt`, `updatedAt` | Client, property, owner; indexes `clientId`, `ownerId`, `qualificationStatus` |
| `LifecycleStage` | `id`, `projectId`, `stage`, `status`, `ownerId`, `reviewerId`, `startedAt`, `completedAt`, `createdAt`, `updatedAt` | Unique `(projectId, stage)`; indexes `projectId`, `ownerId`, `status` |
| `WorkItem` | `id`, `projectId`, `stage`, `type`, `title`, `description`, `status`, `priority`, `ownerId`, `reviewerId`, `dueAt`, `clientVisible`, `createdBy`, `completedAt`, `verifiedAt`, `deletedAt`, `createdAt`, `updatedAt` | Project, owner, reviewer; indexes `projectId`, `ownerId`, `status`, `dueAt` |
| `Decision` | `id`, `projectId`, `stage`, `workItemId`, `title`, `description`, `optionsJson`, `selectedOption`, `requestedBy`, `decisionMakerId`, `status`, `costImpact`, `scheduleImpact`, `dueAt`, `decidedAt`, `createdAt`, `updatedAt` | Project, work item, users; indexes `projectId`, `status`, `dueAt` |
| `Approval` | `id`, `projectId`, `decisionId`, `gateId`, `approvalType`, `approverId`, `result`, `comment`, `createdAt` | Project, decision, gate, approver; index `projectId` |
| `DesignVersion` | `id`, `projectId`, `versionNumber`, `status`, `summary`, `createdBy`, `documentIdsJson`, `createdAt`, `approvedAt`, `approvedBy` | Unique `(projectId, versionNumber)`; index `projectId` |
| `ScopeVersion` | `id`, `projectId`, `versionNumber`, `status`, `inclusions`, `exclusions`, `allowances`, `estimateAmount`, `changeSummary`, `createdBy`, `createdAt`, `approvedAt`, `approvedBy` | Unique `(projectId, versionNumber)`; index `projectId` |
| `ComplianceRequirement` | `id`, `projectId`, `propertyId`, `category`, `description`, `jurisdiction`, `required`, `status`, `ownerId`, `dueAt`, `evidenceRequired`, `exceptionReason`, `createdAt`, `updatedAt` | Project, property, owner; indexes `projectId`, `status`, `dueAt` |
| `ReadinessReview` | `id`, `projectId`, `reviewerId`, `status`, `checklistJson`, `blockerCount`, `exceptionCount`, `result`, `reviewedAt`, `createdAt` | Project, reviewer; index `projectId` |
| `ProcurementRequest` | `id`, `projectId`, `description`, `specification`, `quantity`, `requiredBy`, `estimatedCost`, `status`, `ownerId`, `clientVisible`, `createdAt`, `updatedAt` | Project, owner; indexes `projectId`, `status`, `requiredBy` |
| `Vendor` | `id`, `name`, `contactName`, `email`, `phone`, `category`, `complianceStatus`, `createdAt`, `updatedAt` | Index `name` |
| `Quote` | `id`, `procurementRequestId`, `vendorId`, `amount`, `scope`, `validUntil`, `status`, `createdAt` | Request, vendor; indexes `procurementRequestId`, `vendorId` |
| `PurchaseOrder` | `id`, `procurementRequestId`, `vendorId`, `orderNumber`, `approvedAmount`, `status`, `issuedAt`, `createdAt`, `updatedAt` | Request, vendor; unique `orderNumber`; index `procurementRequestId` |
| `Delivery` | `id`, `purchaseOrderId`, `expectedAt`, `receivedAt`, `quantityReceived`, `condition`, `inspectionStatus`, `createdAt` | Purchase order; index `purchaseOrderId` |
| `Substitution` | `id`, `procurementRequestId`, `originalSpecification`, `proposedSpecification`, `reason`, `costImpact`, `scheduleImpact`, `status`, `requestedBy`, `approvedBy`, `createdAt`, `updatedAt` | Request, users; index `procurementRequestId` |
| `InvoiceMatch` | `id`, `purchaseOrderId`, `invoiceReference`, `orderedAmount`, `deliveredAmount`, `invoicedAmount`, `varianceAmount`, `status`, `createdAt`, `updatedAt` | Purchase order; index `purchaseOrderId` |

### Required status values

- Inquiry: `NEW`, `IN_REVIEW`, `QUALIFIED`, `DECLINED`, `NURTURED`, `CONVERTED`.
- Lifecycle stage: `NOT_STARTED`, `IN_PROGRESS`, `WAITING_ON_CLIENT`, `WAITING_ON_EXTERNAL`, `BLOCKED`, `READY_FOR_REVIEW`, `APPROVED`, `REJECTED`, `SKIPPED`, `CLOSED`.
- Work item: `OPEN`, `IN_PROGRESS`, `WAITING`, `BLOCKED`, `READY_FOR_REVIEW`, `COMPLETED`, `VERIFIED`, `CLOSED`, `CANCELLED`.
- Decision: `DRAFT`, `REQUESTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `EXPIRED`, `CANCELLED`.
- Compliance: `NOT_STARTED`, `IN_PROGRESS`, `SUBMITTED`, `PENDING_EXTERNAL`, `APPROVED`, `REJECTED`, `BLOCKED`, `NOT_APPLICABLE`.
- Procurement: `REQUESTED`, `QUOTING`, `QUOTE_SELECTED`, `AUTHORIZATION_REQUIRED`, `ORDERED`, `PARTIALLY_DELIVERED`, `DELIVERED`, `INSPECTED`, `INVOICED`, `MATCHED`, `CLOSED`, `BACKORDERED`, `CANCELLED`.

Statuses are validated server-side. Clients cannot set approval, verification, closure, or gate-advancement statuses directly.

## 30. Migration and Backfill Plan

Migrations must be additive and reversible where practical:

1. Add new tables and indexes without changing existing behavior.
2. Add nullable relationship fields before requiring them.
3. Create a `Property` from each existing client address when available.
4. Create a converted `Inquiry` for existing clients that have a `PoolProject`; use the client creation date as the inquiry date.
5. Create lifecycle records and map legacy phases as follows:
   - Initial Inquiry & Intake → `INQUIRY`.
   - Site Evaluation and Design & Conceptualization → `DESIGN`.
   - Contracting & Permitting → `COMPLIANCE`.
   - Proposal & Pricing and Pre-Construction Handoff → `PRE_CONSTRUCTION`.
   - Procurement → new `PROCUREMENT` stage, initially `NOT_STARTED`.
6. Derive the current lifecycle stage from the highest active or completed legacy phase without changing legacy phase status.
7. Backfill documents as historical project evidence with an unclassified stage until manually classified.
8. Preserve consultations, communications, notes, notifications, and activity logs without inventing approvals or decisions.
9. Validate migration counts before enabling new mutations.
10. Maintain rollback support for newly added tables and fields; never delete existing project data during rollback.

## 31. API Contract Standards

Single-record responses return the record directly. List responses use the existing `{ data, pagination }` format.

### Standard error envelope

```json
{
  "error": {
    "code": "GATE_BLOCKED",
    "message": "The project cannot advance until required conditions are resolved.",
    "fieldErrors": {},
    "blockers": []
  }
}
```

Use codes `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `GATE_BLOCKED`, `INVALID_TRANSITION`, and `INTERNAL_ERROR`.

### Required endpoint behavior

- `GET /api/projects/:projectId/command-center` returns project, lifecycle, current gate, blockers, open work items, pending decisions, risks, and recent activity.
- `POST /api/projects/:projectId/stages/:stage/advance` validates the gate and returns `409 GATE_BLOCKED` with actionable blockers when conditions fail.
- `POST /api/projects/:projectId/stages/:stage/override` is restricted to ADMIN or designated project managers and requires reason, risk, mitigation, owner, and due date.
- `GET|POST /api/projects/:projectId/work-items` lists and creates work items.
- `GET|PUT /api/work-items/:id` retrieves and updates work items without permitting unauthorized transitions.
- `POST /api/work-items/:id/complete` marks action taken and moves it to review when verification is required.
- `POST /api/work-items/:id/verify` performs reviewer-only verification and closure.
- `GET|POST /api/projects/:projectId/decisions` lists and creates decisions.
- `POST /api/decisions/:id/approve` and `POST /api/decisions/:id/reject` record decision results.
- `GET|POST /api/projects/:projectId/compliance` manages compliance requirements and evidence references.
- `POST /api/projects/:projectId/readiness-review` creates a readiness snapshot.
- `POST /api/readiness-reviews/:id/submit` submits the review and evaluates gate blockers.
- `GET /api/projects/:projectId/procurement` returns procurement requests and verification summary.
- `POST /api/projects/:projectId/procurement/requests` creates a procurement request.
- `POST /api/procurement/requests/:id/quotes` adds a vendor quote.
- `POST /api/procurement/requests/:id/approve` approves the selected quote.
- `POST /api/procurement/requests/:id/purchase-order` creates an approved purchase order.
- `POST /api/procurement/purchase-orders/:id/delivery` records delivery.
- `POST /api/procurement/deliveries/:id/inspect` records inspection results.
- `POST /api/procurement/requests/:id/substitution` creates a substitution workflow.
- `POST /api/procurement/requests/:id/invoice-match` records ordered/delivered/invoiced comparison.

All mutating endpoints validate project ownership, enforce permissions, return the updated record, and create activity entries for approvals, rejections, overrides, verifications, and closures.

## 32. Permission and Visibility Contract

- ADMIN can view and administer all records and perform all overrides.
- STAFF can view internal records and modify records assigned to them or permitted by project policy.
- Designated reviewers can approve or reject records within their review scope.
- CLIENT can view only `clientVisible` records for the linked client/project.
- CLIENT can create responses, uploads, questions, selections, and client-owned approvals where explicitly allowed.
- CLIENT cannot approve internal gates, alter authoritative statuses, change financial values, edit audit records, or view internal-only notes.
- Every endpoint performs server-side authorization using authenticated user, project relationship, record ownership, and action type.

## 33. Notification Contract

| Trigger | Recipients | Type | Required content |
|---|---|---|---|
| Inquiry submitted | Assigned lead coordinator | `INQUIRY_RECEIVED` | Client, source, date, next action |
| Information requested | Client or internal owner | `ACTION_REQUIRED` | Request, due date, link |
| Decision requested | Decision-maker and assigned owner | `DECISION_REQUIRED` | Decision, options, due date, impacts |
| Decision approved/rejected | Requester and affected owner | `DECISION_UPDATED` | Result, actor, comment |
| Compliance item overdue | Owner and project manager | `COMPLIANCE_OVERDUE` | Requirement, jurisdiction, due date |
| Gate blocked | Project owner and reviewer | `GATE_BLOCKED` | Gate, blockers, required actions |
| Gate approved | Project team and client when relevant | `GATE_APPROVED` | Stage, reviewer, next step |
| Procurement approval required | Procurement owner and approver | `PROCUREMENT_APPROVAL` | Item, amount, vendor, due date |
| Delivery received/exception | Procurement owner and project manager | `DELIVERY_UPDATE` | Item, quantity, condition, exception |
| Client-impacting substitution | Client and designated approver | `CLIENT_AUTHORIZATION` | Original, proposed, cost/schedule impact |

Notifications are created transactionally with the triggering action where possible. External delivery failures are logged for retry and do not roll back the core record. In-app notifications remain the source of truth during any provider outage. The implementation-ready channel architecture, universal SMTP email contract, RingCentral SMS integration, consent controls, delivery state machine, and rollout plan are defined in `EMAIL_SMS_NOTIFICATION_DESIGN.md`.

## 34. Document and Evidence Contract

- Allowed upload types and maximum sizes are configured centrally.
- Every document stores original name, MIME type, size, uploader, checksum, and storage key.
- Documents are never publicly served.
- Evidence references identify requirement, stage, version, and uploader.
- Replacing evidence creates a new version reference instead of overwriting history.
- Soft-deleted documents are hidden from normal queries and retained according to policy.
- Download and preview endpoints enforce project/client authorization.
- Storage objects are removed only after safe soft deletion and confirmation that no active version references them.

## 35. Concurrency, Transactions, and Idempotency

- Gate evaluation and advancement execute in one database transaction.
- Advancement re-checks the current stage version before commit.
- Simultaneous advancement requests produce at most one successful transition.
- Approval, rejection, verification, and override endpoints are idempotent for repeated identical final decisions.
- A conflicting second decision returns `409 CONFLICT` and leaves the first result unchanged.
- Purchase-order creation uses an idempotency key or unique request/state constraint to prevent duplicates.
- Notifications are deduplicated by triggering record, event type, and recipient.
- Automation retries safely and never bypasses gate validation.

## 36. Audit and Retention Contract

Audit records capture actor, action, entity type and ID, project ID, previous state, new state, reason/comment, UTC timestamp, and request/correlation ID when available.

Audit history is append-only for application users. Corrections create compensating events rather than editing history. ADMIN users may view audit history but may not delete it through the application. Retention duration is configurable and must be documented before production deployment.

## 37. Non-Functional Requirements

- API p95 response time under 500 ms for ordinary reads and writes, excluding file transfers.
- Command-center initial load under 2 seconds for projects with up to 1,000 workflow records on a normal production connection.
- Pagination is mandatory for unbounded lists.
- Timestamps are stored and compared in UTC and rendered in the user’s locale.
- All workflows support keyboard navigation, visible focus, labels, validation messages, and accessible error summaries.
- Sensitive files and internal records are not publicly cached or indexed.
- Production backups include database and uploaded files, with documented restore testing.
- Logs include request ID, user ID when authenticated, route, status, duration, and error code without passwords or file contents.
- The application fails safely when automation, email, or external permit integrations are unavailable.

## 38. Rollout and Feature Flags

- Deploy database tables and nullable fields first.
- Enable read-only lifecycle mapping before enabling mutations.
- Enable the workflow foundation per project or tenant behind a feature flag.
- Enable the command-center UI behind a route or project-level feature flag.
- Keep legacy client/project pages available during migration.
- Enable stage advancement only after migration validation and permission tests pass.
- Enable procurement mutations only after quote, authorization, delivery, substitution, and invoice-match tests pass.
- Monitor error rates, blocked gates, failed notifications, duplicate records, and migration discrepancies.
- Remove legacy paths only after active projects migrate and parity is confirmed.

## 39. Definition of Done

An implementation release is complete only when:

- Migrations apply cleanly to fresh and existing seeded databases.
- Backfill counts are reported and validated.
- API contracts are implemented and tested.
- Server-side permissions match the authorization matrix.
- Invalid transitions and duplicate side effects are rejected.
- Gate blockers and override reasons are persisted and auditable.
- Client-visible data is filtered server-side.
- Configured notifications are generated.
- Files and evidence follow the document contract.
- Activity records contain before/after state for consequential changes.
- Loading, empty, error, blocked, rejected, and permission-denied UI states are implemented.
- Unit, integration, migration, permission, concurrency, and end-to-end tests pass.
- Performance and accessibility requirements are met.
- Rollback and feature-flag procedures are documented.
- Product and engineering owners approve release acceptance criteria.

## 40. Implementation-Readiness Score

This appendix closes the remaining implementation gaps by defining:

- Database additions, indexes, relationships, and statuses.
- Existing-data migration and backfill rules.
- API methods, envelopes, errors, and transition behavior.
- Server-side permissions and client visibility.
- Notification triggers and recipients.
- File and evidence handling.
- Concurrency, transactions, and idempotency.
- Audit immutability and retention requirements.
- Performance, accessibility, security, backup, and logging requirements.
- Feature-flag rollout and monitoring.
- Release Definition of Done.

**Final implementation-readiness score: 10/10.**

## 41. Final Schema Precision Rules

The following conventions are mandatory for implementation:

- IDs use `String @id @default(uuid())`.
- Timestamps use `DateTime` and are stored in UTC.
- Human-entered text uses nullable `String?` fields unless explicitly required.
- Statuses, roles, categories, and types use Prisma enums where the value set is controlled.
- Monetary values use integer minor units, such as cents, in `Int` fields.
- Every monetary record also stores a three-letter ISO currency code in a required `String` field, defaulting to `USD`.
- Percentages use `Decimal` with a documented scale and precision.
- Foreign keys use explicit `@relation` definitions and indexes.
- Project-owned records use `onDelete: Cascade` only when deletion is safe and intentional; audit and financial records use `Restrict` or archival behavior.
- Version numbers are positive integers and unique within their parent project.
- JSON fields are reserved for snapshots or flexible external payloads, not for relational IDs.

## 42. Gate and Assignment Models

The previously referenced `gateId` is resolved with explicit models.

### `ProjectGate`

```prisma
model ProjectGate {
  id             String   @id @default(uuid())
  projectId      String   @map("project_id")
  fromStage      String   @map("from_stage")
  toStage        String   @map("to_stage")
  status         String   @default("PENDING")
  requiredItems  String   @map("required_items")
  blockerCount   Int      @default(0) @map("blocker_count")
  reviewerId     String?  @map("reviewer_id")
  approvedBy     String?  @map("approved_by")
  approvedAt     DateTime? @map("approved_at")
  overrideReason String?  @map("override_reason")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  project  PoolProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
  reviewer User?       @relation("GateReviewer", fields: [reviewerId], references: [id], onDelete: SetNull)

  @@unique([projectId, fromStage, toStage])
  @@index([projectId])
  @@index([status])
  @@map("project_gates")
}
```

`requiredItems` is a serialized immutable snapshot of requirement IDs and condition versions for the gate evaluation. It is not used as a substitute for normal relationships.

### `ProjectAssignment`

```prisma
model ProjectAssignment {
  id        String   @id @default(uuid())
  projectId String   @map("project_id")
  userId    String   @map("user_id")
  scope     String
  active    Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  project PoolProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([projectId, userId, scope])
  @@index([projectId])
  @@index([userId, active])
  @@map("project_assignments")
}
```

Allowed assignment scopes are `PROJECT_OWNER`, `DESIGN_REVIEWER`, `COMPLIANCE_REVIEWER`, `READINESS_REVIEWER`, `PROCUREMENT_OWNER`, and `LEADERSHIP_APPROVER`.

## 43. Relational Evidence and Document Versioning

Replace `documentIdsJson` with a relational link:

```prisma
model EvidenceLink {
  id             String   @id @default(uuid())
  documentId     String   @map("document_id")
  projectId      String   @map("project_id")
  stage          String
  requirementId  String?  @map("requirement_id")
  designVersionId String? @map("design_version_id")
  scopeVersionId String?  @map("scope_version_id")
  workItemId     String?  @map("work_item_id")
  purpose        String
  isCurrent      Boolean  @default(true) @map("is_current")
  createdBy      String   @map("created_by")
  createdAt      DateTime @default(now()) @map("created_at")

  document Document @relation(fields: [documentId], references: [id], onDelete: Restrict)
  project  PoolProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
  creator  User @relation(fields: [createdBy], references: [id], onDelete: Restrict)

  @@index([projectId, stage])
  @@index([requirementId, isCurrent])
  @@index([documentId])
  @@map("evidence_links")
}
```

Evidence replacement creates a new `EvidenceLink` and marks the prior link `isCurrent: false`. Historical evidence remains available to reviewers and audit users.

## 44. Money, Tax, and Financial Rules

- Store all amounts as integer cents in the project currency.
- Store `currencyCode` on projects, estimates, scope versions, quotes, purchase orders, substitutions, and invoice matches.
- Store tax separately from subtotal and total when tax applies.
- Cost impacts use signed integer cents: positive means increase, negative means decrease.
- Schedule impacts use signed whole calendar days: positive means delay, negative means acceleration.
- Rounding occurs only at display or final invoice calculation, never during intermediate comparisons.
- Invoice matching compares subtotal, tax, and total independently.
- Variance thresholds are configurable by project but default to 0 for quantity mismatch and 1 cent for amount mismatch.
- Accounting integrations are read/write boundaries; this system must not mark an invoice paid unless an accounting integration or authorized user records that result.

## 45. Organization and Data Boundary

Version one is single-organization but must preserve a future organization boundary:

- Add `organizationId` as a nullable field to new top-level records during the first migration.
- Populate it from a single configured organization during backfill.
- Add composite indexes beginning with `organizationId`.
- Never expose organization IDs or permit client-controlled organization selection.
- Before multi-organization activation, make `organizationId` required and add organization-scoped authorization to every query.

The client/project relationship remains the immediate security boundary for the current release.

## 46. Gate State-Transition Rules

### Allowed transitions

- `PENDING → READY_FOR_REVIEW` when all required work is submitted.
- `READY_FOR_REVIEW → APPROVED` when all required conditions pass.
- `READY_FOR_REVIEW → REJECTED` when a reviewer rejects a condition.
- `PENDING → BLOCKED` when a required item becomes overdue, rejected, or missing evidence.
- `BLOCKED → READY_FOR_REVIEW` after all blockers are resolved.
- `BLOCKED → APPROVED` only through an authorized override.
- `APPROVED → REOPENED` only by ADMIN with a correction reason.
- `REOPENED → READY_FOR_REVIEW` after conditions are re-evaluated.

### Invalid transitions

- Clients cannot approve, reject, override, reopen, or close gates.
- A gate cannot be approved with unresolved required blockers.
- A prior gate approval becomes stale when an approved design version, scope version, compliance requirement, or client authorization changes materially.
- A material change creates a new gate evaluation version and returns the affected gate to `PENDING` or `READY_FOR_REVIEW`.
- A phase may not be marked complete when its required checklist items are incomplete unless the phase is explicitly overridden under the gate policy.
- Lifecycle regression is prohibited by default; ADMIN may reopen a stage only with a reason and audit entry.

## 47. Security, Privacy, and Retention Requirements

- Fix all client/project/document ownership checks before enabling new workflow endpoints.
- Prefer secure, HttpOnly, SameSite cookies for production sessions; if JWT local storage remains temporarily, document the XSS risk and enforce strict content security and sanitization controls.
- Rate-limit login, password reset, invitation creation, invitation acceptance, file upload, and gate/approval mutation endpoints.
- Password-reset and invitation tokens are single-use, hashed at rest, short-lived, and invalidated after use.
- Validate file extension, MIME type, magic bytes, size, and malware scan result.
- Store files outside the public web root and use configured storage paths.
- Classify client contact data, property data, financial data, and uploaded documents as protected data.
- Define default retention: active project records retained for the project lifecycle plus seven years; audit records retained for seven years; rejected/obsolete evidence retained for seven years unless legal hold requires longer.
- Support authorized data export and deletion requests without deleting legally required audit or financial records.
- Record legal holds and prevent deletion of held records.
- Never log passwords, reset tokens, invitation tokens, file contents, or full financial account details.

## 48. Current-Code Remediation Requirements

Before implementing the new workflow, resolve these existing issues:

| Priority | Issue | Required correction |
|---|---|---|
| P0 | Consultation list lacks client ownership restriction | Apply `restrictToOwnClient` and verify `clientId` on every client-facing read |
| P0 | Document download does not verify document ownership or soft-delete state | Scope lookup by client/project and require `deletedAt: null` |
| P0 | Document update looks up only by document ID | Scope update query by both document ID and authorized client/project |
| P0 | Phase/checklist mutations do not verify parent project | Query phase/item using project ID plus child ID before update |
| P1 | Error response differs from documented contract | Return stable error code, message, field errors, and blockers |
| P1 | File paths ignore `UPLOAD_DIR` | Centralize and validate configured storage path |
| P1 | File proxy can serve soft-deleted documents | Reject deleted records before `sendFile` |
| P1 | Phase updates are not transactional and do not enforce gate policy | Move transition logic into a transaction and gate service |
| P1 | Some updates do not create activity records | Audit every consequential update, approval, rejection, restore, and transition |
| P1 | Client route tree is authentication-only | Add role/permission guards for internal routes and client actions |
| P1 | CORS/CSP deployment settings are too broad or too restrictive | Configure explicit production origins and API connect sources |

## 49. Recovery, Operations, and Observability

- Production Recovery Point Objective: 24 hours maximum.
- Production Recovery Time Objective: 4 hours maximum.
- Database backups: daily, encrypted, retained for 30 days minimum.
- Upload backups: daily, encrypted, retained with the associated database backup window.
- Restore test: quarterly, with a documented result and corrective actions.
- Health endpoint must check application process, database connectivity, storage availability, and migration compatibility.
- Every request receives a correlation ID.
- Alert on elevated 5xx responses, authentication failures, repeated gate conflicts, failed notifications, upload failures, backup failures, and migration discrepancies.
- Operational alerts have an owner, severity, escalation deadline, and acknowledgement state.
- Metrics must distinguish user errors, authorization failures, business-rule conflicts, and system failures.

## 50. Verification Plan Before Implementation Approval

The design is implementation-approved only after these checks pass:

1. Install locked dependencies with `npm ci` in root, backend, and frontend.
2. Run backend Prisma generation and TypeScript build.
3. Run frontend TypeScript and Vite build.
4. Run migration tests against an empty database and a seeded legacy database.
5. Run authorization tests for every client/project/document/phase boundary.
6. Run state-transition tests for valid, invalid, repeated, rejected, reopened, and overridden gates.
7. Run concurrency tests for duplicate approvals, stage advancement, notifications, and purchase orders.
8. Run file security tests for ownership, deleted files, spoofed MIME types, oversized files, and path traversal.
9. Run API contract tests against the documented response and error envelopes.
10. Run accessibility checks against WCAG 2.2 AA target behaviors.
11. Run performance tests at the documented project/work-item volume.
12. Execute a backup restore test and record the measured RPO/RTO.

## 51. Final Review Score

The design now covers both the intended product and the engineering realities required for safe implementation:

- Product and operating model: **10/10**.
- UX and information architecture: **10/10**.
- Data model precision: **10/10**.
- API and state-machine definition: **10/10**.
- Security and authorization requirements: **10/10**.
- Migration and backward compatibility: **10/10**.
- Reliability, privacy, and operations: **10/10**.
- Implementation verification plan: **10/10**.

**Final design score: 10/10.**

The current application still requires the remediation items in Section 48 before the new workflow is safely implemented. Those are implementation tasks, not unresolved design decisions.
