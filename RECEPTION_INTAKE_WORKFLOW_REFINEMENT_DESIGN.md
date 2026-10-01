# Reception Intake Workflow Refinement Design

**Status:** Implementation in progress — Phase 1 (atomic editing)

**Scope:** Reception Intake improvements for contact history, phase readiness, final Design handoff, and safe editing
**Source of truth:** The original Inquiry remains the single record for the project from first contact through Design handoff.

## 1. Purpose

Make Reception Intake reliable and easy to operate when project information arrives gradually through phone calls, texts, emails, referrals, and meetings. Representatives should be able to record what happened, understand what is still needed, and move a qualified inquiry forward without duplicate records, guessed answers, or ambiguous save results.

This design refines the existing Reception workflow. It does not replace its four visible phases, its inquiry-to-client conversion, or the representative-led discovery form.

## 2. Product decisions

1. **One inquiry remains authoritative.** Follow-up contacts, clarifications, evidence, and client responses attach to the existing inquiry.
2. **Record outside conversations manually first.** This release provides a fast internal activity log. It does not depend on RingCentral, email-provider, or SMS integrations.
3. **Unknown is not the same as complete.** An unknown answer can be recorded honestly. It blocks a required criterion unless the criterion is explicitly marked deferrable below and a follow-up is created.
4. **Exceptions are explainable.** “Not applicable” requires a reason and is available only for checklist items that permit it. Conflicting answers remain unresolved until reviewed.
5. **The final Reception deliverable is preliminary.** Reception may record and present a preliminary ROM and project brief; it must not imply that detailed design work has already been completed. Only a client response of **Proceed to Design** can lead to conversion. Other responses take separate Reception paths.
6. **A save is atomic.** Client, inquiry, and property edits in one intake form either all persist or none do.
7. **The server owns workflow truth.** Phase counts, readiness, blockers, and allowed transitions use the same versioned server-side criteria.

## 3. Scope and non-goals

### In scope

- Inquiry-scoped internal contact/activity history.
- Explicit field certainty and exception states for phase criteria.
- Readiness criteria and card counts that agree with the server’s phase transition rules.
- Clear preliminary-ROM/proposal language at the Reception-to-Design boundary.
- Atomic save behavior and understandable save/error states.
- Audit history and automated tests for these behaviors.

### Not in scope

- Automatically sending or importing texts and emails.
- Changing the four existing Reception phase names or adding staff roles.
- Replacing the existing Inquiry, Client, Property, or Design project records.
- Generating a final design, construction quote, or binding price from Reception data.
- Broad CRM, marketing automation, or a new matching-queue workflow.

## 4. Proposed experience

### 4.1 Inquiry activity timeline

Add an **Activity** area within the inquiry’s existing **Files & conversation** tab. The area combines a chronological, inquiry-specific timeline of manually logged contacts and existing inquiry-linked consultations/documents, while preserving their current forms and permissions.

The primary action is **Log contact**. Its compact form captures:

| Field | Rule |
|---|---|
| Channel | Required enum: `PHONE`, `SMS`, `EMAIL`, `WEBSITE`, `IN_PERSON`, `REFERRAL`, `OTHER` |
| Direction | Required enum: `INBOUND` or `OUTBOUND` |
| Contact/person | Optional `contactPerson` text, maximum 120 characters; prefill with the client’s display name but allow the representative to name another person or clear it when unknown |
| Date and time | Required; default to now, editable for delayed entry; submitted/stored as UTC with the organization timezone retained for display and local-time entry |
| Summary | Required; concise internal note of what was discussed |
| Outcome | Optional structured result, with a short detail field |
| Follow-up action, owner, and due date | Optional unless the contact creates a commitment; if an action is entered, require an owner and due date. Default owner to the assigned Reception owner but allow an Admin to change it. |
| Attachment | Not part of the initial log form. Upload through the existing secure Files flow; an activity may reference only document IDs already associated with the same inquiry |

Each contact entry displays channel, direction, occurred-at time, contact person, author, summary, outcome, and any follow-up. The `contactPerson` value is a display-name snapshot, not a new Client relationship; it defaults to the inquiry client’s current display name when the form opens and is stored exactly as submitted (or null if cleared). It does not update the Client record. Entries are immutable after creation for all users; a correction creates a linked correction event that identifies the original entry and the correcting actor. Entries cannot be silently edited or deleted. The timeline is internal-only and is never returned by client communication endpoints. Existing email/SMS integrations, if added later, must create equivalent auditable events and deduplicate provider retries.

### 4.2 Answer certainty and checklist behavior

For fields used by phase gates, store or derive a clear answer state:

| State | Meaning | Gate behavior |
|---|---|---|
| `CONFIRMED` | Answer was provided or verified | Satisfies the item |
| `PRELIMINARY` | Useful early answer; not yet verified | Satisfies only if the gate permits preliminary answers |
| `UNKNOWN` | Not known or not discussed | Does not satisfy a required item; prompt for an owner/next action |
| `NOT_APPLICABLE` | Requirement does not apply | Satisfies only if permitted, with a reason and actor recorded |
| `NEEDS_REVIEW` | Conflicting, stale, or unverified information | Blocks affected requirement until reviewed |

Do not treat a non-empty string such as “UNKNOWN” as the data contract. Keep the answer and its certainty separate. Existing Inquiry, Property, and discovery fields remain the sole source for answer values; do not copy those values into a second checklist store. Persist certainty/reason metadata separately, keyed to stable criterion IDs, and retain changes in the audit history. Any schema addition requires a reviewed migration and conservative legacy-data backfill.

Each criterion has a stable `criterionId`, phase, requirement class (`BLOCKING`, `DEFERRABLE`, or `OPTIONAL`), accepted answer states, and whether `NOT_APPLICABLE` is permitted. The server owns a versioned criterion registry; the registry version is included in readiness responses and transition audit events. For this release the registry is a typed server-side definition, not user-editable settings. UI labels are presentation only and cannot change gate behavior.

The checklist shows three groups:

- **Required to advance** — blocks the transition until validly complete.
- **Important, can follow up** — does not block, but requires an assigned next action and due date when unknown.
- **Optional context** — improves the handoff but never blocks it.

Every blocked transition identifies the exact criterion ID and field, why it is unresolved, and the action needed. A `DEFERRABLE` criterion marked `UNKNOWN` can pass only when a follow-up WorkItem is linked to that criterion and has an owner and due date. This does not convert the answer to complete; the readiness result explicitly reports it as deferred. `BLOCKING` criteria never pass as unknown. Any permitted `NOT_APPLICABLE` exception records who made it, when, and why.

### 4.3 Phase criteria and status consistency

Preserve the four current phase names, but do **not** infer the active phase from `qualificationStatus`. The current code maps `NEW`, `IN_REVIEW`, `QUALIFIED`, and `CONVERTED` to queue cards; that mapping cannot represent a qualified inquiry preparing or awaiting its preliminary proposal.

For every active inquiry (`NEW`, `IN_REVIEW`, or `QUALIFIED`), calculate `activeReceptionPhase` on the server as the **earliest phase not ready to advance**. A blocking criterion passes only in an allowed answered state. A deferrable criterion permits advancement only when its linked follow-up has an owner and due date; report it as deferred, never as answered. Phase state is `IN_PROGRESS`, `READY_WITH_DEFERRED_ITEMS`, or `COMPLETE`. A phase with valid deferrals can advance but must display “Advanced with follow-up,” not “Complete.” Phase 4 remains active while a proposal is being prepared or the client is deciding. `MORE_INFORMATION` keeps the inquiry in Phase 4 with its follow-up. `NURTURED`, `DECLINED`, and `CONVERTED` are not counted in the four active-phase cards; show them in closed/history instead. Converted inquiries keep their historical handoff result and are never re-evaluated as active.

`qualificationStatus` remains the separate business disposition: `NEW` (unreviewed), `IN_REVIEW` (being qualified), `QUALIFIED` (Admin-approved prospect awaiting site/ROM/handoff completion), `NURTURED`, `DECLINED`, or `CONVERTED`. It may change without changing `activeReceptionPhase`; phase advancement is derived, not a separate user-controlled status. To advance from Phase 2 to Phase 3, all other Phase 2 blocking criteria must first pass, then an Admin reviews the brief and explicitly sets `qualificationStatus=QUALIFIED`; qualification approval is the final Phase 2 gate, not an independent prerequisite to its own review. If a later edit invalidates a Phase 2 criterion before conversion, atomically return status to `IN_REVIEW`, record the reason/audit event, and derive Phase 2 again. If a Phase 1 or Phase 3 criterion regresses, preserve status but block later progression and derive the earliest incomplete phase. Always preserve later answers; do not delete or reset them.

Maintain one versioned server-side criterion definition for the queue cards, profile, readiness response, and transition endpoint. Each active inquiry appears in exactly one phase card. Overdue, awaiting-client-response, and needs-review are independent badges/filters, not extra phase counts. The UI may present criteria in the inquiry profile but should not put the full checklist on each queue card.

| Reception phase | Required outcome before advancing |
|---|---|
| **Initial Contact Made** | **Blocking:** client identity and at least one contact method; original incoming channel; Reception owner; next action and due date. **Deferrable:** property address may be unknown only when `SITE_NOT_IDENTIFIED` is explicitly recorded and a linked, owned, dated follow-up exists. |
| **Pre-Design Discovery** | **Blocking:** project type, primary use, desired outcome, decision-maker/approval path, and must-have features (or explicit `NONE_IDENTIFIED`) have valid answers; inspiration is captured or explicitly marked `NONE_PROVIDED`; an onsite consultation is scheduled; and after the other Phase 2 criteria pass, an Admin explicitly qualifies the inquiry by reviewing the brief. **Deferrable:** property access, reported site conditions, utilities, survey status, budget, and timing may remain unknown only with a linked, owned, dated follow-up. `PRELIMINARY` is allowed for budget/timing and is labeled non-binding. |
| **Site Meetings & ROM Preparation** | The phase begins with the onsite meeting scheduled. **Blocking before advancing:** the meeting is completed onsite and has an outcome; onsite meetings cannot be skipped in the first release. A scheduled-but-not-completed or remote discovery meeting does not pass. Known access/site constraints are recorded, or the site review confirms none are known. Site evidence is optional context in this release; it does not block advancement. Open required client requests must be resolved or individually linked to a criterion that permits deferral. |
| **ROM Approval & Design Handoff** | **Blocking for conversion:** rendered ROM/range and project brief saved; the complete preview reviewed and approved by an Admin; ROM approval recorded; design agreement accepted or explicitly marked not required by an Admin with a reason; presentation date and handoff summary recorded; client disposition is attributed, Admin-reviewed `PROCEED_TO_DESIGN`. The approved, revision-bound ROM preview remains available read-only to Design after atomic, idempotent conversion. `MORE_INFORMATION` stays in Reception with a linked follow-up; `PAUSE` moves to nurture with a reason and next review date; `DECLINE` closes with a reason. None of those three outcomes converts to Design. The displayed “proposal” is explicitly preliminary and non-binding, not a construction contract or authorization to build. |

The phase names above are the existing visible labels in the Reception UI. The requirements below map onto those four phases; they do not introduce replacement labels.

The first-release criterion registry uses these stable IDs and classifications. Field paths refer to the existing Inquiry/Property fields or keys in `Inquiry.discoveryData`; map every path to the production-compatible source before migration. The retained production schema, selected feature-branch Prisma schema, API, and UI contain both `Inquiry.proposalNarrative` (`proposal_narrative`) and `Inquiry.romProposalDetails` (`rom_proposal_details`). They are distinct: `proposalNarrative` is supplemental free text; `romProposalDetails` is structured ROM-editor override JSON. Neither is a duplicate canonical inquiry answer. The user’s saved inquiry answers remain the default source for the rendered ROM; structured overrides are proposal-specific, and the supplemental narrative is optional. Editing the ROM must never mutate canonical discovery answers. Keep both fields and their current API behavior; do not add a parallel proposal-text field or auto-copy one into the other. The inspected production schema also includes `rom_status`, `rom_decision_at`, `rom_approved_by`, design-agreement status/acceptance fields, `handoff_summary`, and handoff approval fields. Existing Consultation `activityType` and compliance fields are present in the deployed migration chain. The implementation must preserve these behaviors and map the explicit gate fields below; no Phase 0 source/schema reconciliation remains other than documenting the deployed source commit as unknown.

| Criterion ID | Canonical field/source | Class | Pass condition |
|---|---|---|---|
| `CONTACT_IDENTITY` | Client name | BLOCKING | Valid non-empty name |
| `CONTACT_METHOD` | Client email or phone | BLOCKING | At least one valid method |
| `INCOMING_CHANNEL` | `Inquiry.source` | BLOCKING | Supported source selected |
| `RECEPTION_OWNER` | `Inquiry.ownerId` | BLOCKING | Active Admin assigned |
| `INITIAL_NEXT_ACTION` | `Inquiry.nextAction`, `nextActionDueAt` | BLOCKING | Both present and due date valid |
| `PROPERTY_IDENTIFIED` | `Property.address` / criterion state | DEFERRABLE | Address present, or `SITE_NOT_IDENTIFIED` reason plus linked owner/due follow-up |
| `PROJECT_TYPE` | `Inquiry.discoveryData.projectType` | BLOCKING | One of `New pool and spa`, `New pool only`, `Pool renovation`, or `Outdoor living addition`; `Not yet determined` is `UNKNOWN` and blocks |
| `PRIMARY_USE` | `Inquiry.discoveryData.primaryUse` | BLOCKING | Supported use selected; `Not sure yet` is `UNKNOWN` and blocks |
| `DESIRED_OUTCOME` | `Inquiry.objectives` | BLOCKING | Outcome recorded |
| `DECISION_MAKERS` | `Inquiry.discoveryData.decisionMakers` | BLOCKING | Supported decision/approval choice; `Not decided yet` is `UNKNOWN` and blocks |
| `PROPERTY_ACCESS` | `Inquiry.discoveryData.propertyAccess` | DEFERRABLE | Access known, or unknown with linked owner/due follow-up |
| `REPORTED_SITE_CONDITIONS` | `Inquiry.discoveryData.siteConditions` | DEFERRABLE | Client/reception-reported conditions recorded, or unknown with follow-up; distinct from verified site assessment |
| `UTILITIES` | `Inquiry.discoveryData.utilities` | DEFERRABLE | Utility constraints recorded, or unknown with follow-up |
| `SURVEY_STATUS` | `Inquiry.discoveryData.surveyStatus` | DEFERRABLE | Status recorded, or unknown with follow-up |
| `MUST_HAVE_FEATURES` | `Inquiry.discoveryData.mustHaveFeatures` | BLOCKING | Selected features recorded, or explicit `NONE_IDENTIFIED`; unknown blocks until answered |
| `QUALIFICATION_APPROVAL` | `Inquiry.qualificationStatus` plus status audit event | BLOCKING | After the other Phase 2 blocking criteria pass, status becomes `QUALIFIED` from an explicit Admin review; actor/time are auditable |
| `INSPIRATION_STATUS` | `Inquiry.designInspirations` / criterion state | BLOCKING | Reference captured or explicit `NONE_PROVIDED` state |
| `SITE_MEETING_SCHEDULED` | Inquiry-linked Consultation | BLOCKING | Onsite consultation has a scheduled date/time before Phase 2 advances; a phone/video meeting does not satisfy it |
| `BUDGET_EXPECTATION` | `Inquiry.budgetExpectation` (canonical) | DEFERRABLE | Preliminary/confirmed range recorded, or unknown with follow-up; `discoveryData.budgetRange` is legacy input only |
| `DESIRED_TIMING` | `Inquiry.desiredTiming` (canonical) | DEFERRABLE | Timing recorded, or unknown with follow-up; `discoveryData.targetCompletion` is legacy input only |
| `SITE_MEETING_OUTCOME` | Inquiry-linked Consultation plus `meetingMode` | BLOCKING | Completed Consultation with `meetingMode=ONSITE` and outcome; scheduled/remote alone does not pass |
| `SITE_ASSESSMENT` | `Inquiry.siteAssessment` | BLOCKING | Site measurements/access/feasibility recorded or site review confirms none known; distinct from client-reported `discoveryData.siteConditions` |
| `SITE_EVIDENCE` | InquiryEvidence links to inquiry Documents | OPTIONAL | Categorized site photos/plans/surveys may inform Design; evidence availability never blocks phase advancement in this release. Unrelated documents are not categorized as site evidence. |
| `CLIENT_REQUESTS` | Inquiry-linked required WorkItems | BLOCKING | Each request resolved or individually deferred only if its criterion permits deferral |
| `PRELIMINARY_ROM` | `Inquiry.romAmount` | BLOCKING | Preliminary range recorded and labeled non-binding |
| `PRELIMINARY_BRIEF` | Rendered ROM: canonical inquiry answers + `Inquiry.romProposalDetails` overrides + optional `Inquiry.proposalNarrative` | BLOCKING | Reviewed ROM preview is complete, saved as a revision-bound snapshot, and labeled preliminary/non-binding; inquiry answers remain the default source |
| `PROPOSAL_PRESENTED_AT` | `Inquiry.proposalProvidedAt` | BLOCKING | Presentation/delivery date recorded |
| `ROM_APPROVAL` | `Inquiry.romStatus`, `Inquiry.romDecisionAt`, `Inquiry.romApprovedBy` | BLOCKING | The reviewed rendered ROM is explicitly approved with actor/time; pending or rejected status blocks conversion |
| `DESIGN_AGREEMENT` | `Inquiry.designAgreementStatus`, `Inquiry.designAgreementAcceptedAt`, `Inquiry.designAgreementAcceptedBy` | BLOCKING | Agreement is accepted, or an Admin records `NOT_REQUIRED` with a reason and audit event |
| `CLIENT_DISPOSITION` | New constrained disposition fields (defined below) | BLOCKING | Explicit, attributable disposition; only `PROCEED_TO_DESIGN` permits conversion |
| `HANDOFF_REVIEW` | Handoff review/audit record | BLOCKING | An `APPROVED` review exists for the current intake revision and workflow version and contains the immutable rendered ROM snapshot/hash; this is the final gate after all other Phase 4 criteria |

No criterion is `NOT_APPLICABLE` by default. In this release only `SURVEY_STATUS` permits `NOT_APPLICABLE`, and only with an Admin-recorded reason; any additional criterion requires a design change before implementation. The registry validates the reason and actor.

Existing `Inquiry.preliminaryScope` is a legacy summary, not a second independent answer. For new records, structured pool must-haves are captured in `discoveryData.mustHaveFeatures`; outdoor/equipment selections stay in their existing separate discovery fields. The brief may summarize these, but disagreement cannot count as two separate facts. `inquiry.preliminaryScope` is retained for historical/API compatibility, backfilled only when its value maps unambiguously to structured options, and otherwise preserved as `NEEDS_REVIEW` context. It is not separately required for progression.

The existing discovery fields `householdUsers`, `poolSize`, `depthProfile`, `stylePreferences`, `deckingOutdoorScope`, `equipmentPreferences`, `heatingPreference`, `hoaRequirements`, `priorityTradeoffs`, `knownConcerns`, and `representativeNotes` are **optional context** in this release. They remain available to the representative and handoff, but do not block a phase. Their previously required status for `propertyAccess`, `siteConditions`, `utilities`, `surveyStatus`, `mustHaveFeatures`, `budgetRange`, and `targetCompletion` is superseded by the classifications above. The mapping adapter writes current canonical budget/timing fields and does not maintain competing editable copies in `discoveryData.budgetRange` or `discoveryData.targetCompletion`.

`projectType` must be one of the supported project types. The existing UI choice “Not yet determined” is stored as `answerState=UNKNOWN` with no completed value; it blocks Phase 2 until answered. The existing primary-use option “Not sure yet” and decision option “Not decided yet” likewise map to `UNKNOWN` and block Phase 2. “Access needs site review,” “No known concerns yet,” and “No known constraints yet” are unknown—not confirmed clear—and require the corresponding follow-up. Survey status “Not applicable” is accepted only as `NOT_APPLICABLE` for `SURVEY_STATUS` with an Admin-recorded reason. Add an explicit `NONE_IDENTIFIED` value for must-have features and `NONE_PROVIDED` for inspirations; these are affirmative answers stored with `answerState=CONFIRMED`, not empty fields or special answer states. After an onsite review, “No known site constraints” is also an explicit `CONFIRMED` value with `source=ADMIN` and supporting meeting/assessment evidence.

The first-release criteria for access, reported site conditions, utilities, and survey status are deferrable in Phase 2 with a linked owner/due follow-up. They remain visible as deferred in the handoff. The onsite assessment in Phase 3 is a separate blocking criterion; it cannot be replaced by the client’s earlier discovery answers.

### Final disposition transition contract

Store the client disposition as a constrained value, not free text: `PROCEED_TO_DESIGN`, `MORE_INFORMATION`, `PAUSE`, or `DECLINE`. `PROCEED_TO_DESIGN` is the only disposition that can call the conversion operation. It records intent to begin the Design phase; it is **not** a signed construction contract, final price acceptance, or authorization to begin construction. Require evidence of the client’s statement and an Admin review before conversion.

Add `clientDisposition`, `clientDispositionSource` (`CLIENT_PORTAL`, `PHONE`, `SMS`, `EMAIL`, `IN_PERSON`, `OTHER`), `clientDispositionAt`, `clientDispositionRecordedBy`, nullable `clientDispositionClientUserId`, nullable `clientDispositionEvidenceActivityId`, and `clientDispositionReviewedBy/At` to the inquiry/handoff record. A portal submission creates a pending internal event; it does not itself set the authoritative disposition or change inquiry status. An Admin reviews and confirms it. For an external conversation, the Admin records an immutable InquiryActivity with channel, time, and summary, then attests that it captures the client’s explicit instruction. A missing source, timestamp, evidence reference, or Admin review blocks `PROCEED_TO_DESIGN`. These fields are versioned/audited; client free text alone never triggers conversion.

`MORE_INFORMATION` is an active Phase 4 wait state. `PAUSE` and `DECLINE` are Admin-recorded decisions, not client portal status mutations. The source of each choice is retained in its audit event. The other outcomes are handled as follows:

| Disposition | Inquiry status after action | Required data/action | Creates Design project? |
|---|---|---|---|
| `PROCEED_TO_DESIGN` | `CONVERTED` only after all gates pass and conversion transaction commits | Attributed client evidence, Admin review, then Admin initiates conversion | Yes |
| `MORE_INFORMATION` | Remains in its current active status and Phase 4 | Create/retain an assigned, dated inquiry WorkItem; do not mark converted | No |
| `PAUSE` | `NURTURED` | Client-request/representative rationale plus a dated next-review action; Admin records it | No |
| `DECLINE` | `DECLINED` | Client/representative rationale; Admin records it; preserve record/history | No |

Extend the server transition rules to permit `QUALIFIED → NURTURED` and `QUALIFIED → DECLINED` with the same reason/audit requirements as other such transitions. `QUALIFIED → CONVERTED` remains available only through the guarded conversion transaction. Reopening a nurtured inquiry follows the existing audited reopen path.

Product rule for the final phase: this gate means the client has received a **preliminary range and project brief**, not that a full pool design or final construction price has been produced. If the business intends to require a fully designed proposal before conversion, rename the destination clearly and document where that design work occurs; do not silently conflate the two workflows.

The four phase-card totals group active inquiries by computed `activeReceptionPhase`, not `qualificationStatus`; counts are mutually exclusive and sum to all active inquiries. Declined, nurtured, and converted records are excluded from active phase totals and available in closed/history. “Scheduled” and “completed” meeting indicators remain distinct. A proposal awaiting the client is counted in Phase 4 and is not counted as accepted or converted.

### 4.4 Safe edit and save experience

The current single edit form can change Client, Inquiry, and Property data. Save them through one authenticated backend operation backed by a database transaction:

1. Validate the complete submitted payload and authorization.
2. Update the linked Client, Inquiry, and Property records in one transaction.
3. Record any required audit entries in that transaction.
4. Return the canonical saved record only after commit.

If any update fails, the transaction rolls back and the UI says the changes were not saved. The form remains open with entered values intact. It must not show success or partially close. While saving, disable repeat submission and show a visible saving state. If the user tries to close a dirty form, offer **Keep editing** or **Discard changes**. Any retry must not create duplicate activity/audit entries.

Optimistic concurrency is mandatory. The intake aggregate has a monotonically increasing `intakeRevision` on the Inquiry. The edit form submits `expectedIntakeRevision`; the server conditionally increments it inside the same transaction as Client, Inquiry, Property, and audit writes. Every other endpoint that changes a field owned by an open Reception intake—including client contact and property edits—must also increment this revision in its transaction. A stale revision returns `409 STALE_INTAKE_REVISION` and the current revision; it makes no writes. Preserve the user’s draft and offer review/reload; never silently overwrite a newer edit. This Reception revision contract applies while the inquiry is active; post-handoff edits use their existing project/client rules.

### 4.5 Queue cards and inquiry profile

Keep queue cards concise: client, property, phase/status, owner, completion indicator, last activity, and next action/due date. Add a clear overdue or awaiting-client-response indicator. Clicking a card continues to open the existing inquiry profile modal.

Within the profile, show:

- Phase checklist with complete, unknown, not applicable, and needs-review states.
- The owner and next action near any unresolved item.
- A chronological activity timeline in Files & conversation.
- A Handoff summary that distinguishes confirmed from preliminary facts.
- A clear client response and conversion result after final review.

## 5. Data and API contract

### Activity record

Use a dedicated `InquiryActivity` record for this feature. Do not extend the client-visible `Communication` record for internal Reception notes: the existing communication API is accessible to the owning client and supports client-submitted inbound records. Do not duplicate an event in both models. The activity record has: `id`, `inquiryId`, `clientId`, nullable `actorId` for system-generated events, `origin` (`ADMIN`, `CLIENT_PORTAL`, or `SYSTEM`), nullable unique `sourceEventId` for portal/system-generated events, `channel`, `direction`, nullable `contactPerson` (display-name snapshot, maximum 120 characters), `occurredAt`, `organizationTimezone`, `summary`, `outcomeCode`, `outcomeDetail`, nullable constrained `clientDispositionValue`, `followUpWorkItemId`, `idempotencyKey`, `correctionOfActivityId`, `correctionJson`, and `createdAt`. Activity-to-document links use a join relation and may reference only inquiry documents. `channel` and `direction` use the enums defined above. `outcomeCode` is one of `CONNECTED`, `LEFT_MESSAGE`, `NO_ANSWER`, `CLIENT_RESPONSE_RECEIVED`, `CLIENT_DISPOSITION_RECEIVED`, `MEETING_SCHEDULED`, `FOLLOW_UP_REQUIRED`, `OTHER`. No email/SMS body or sensitive credentials are stored as a substitute for a provider integration.

Add nullable `criterionId` to inquiry follow-up WorkItems (indexed with inquiry and status). This is the authoritative link from a deferred gate criterion to its follow-up. A deferrable criterion passes only when a linked WorkItem has an owner and due date; completion of the WorkItem does not itself change the answer state. A representative must separately record or verify the answer.

Add `Consultation.meetingMode` with `ONSITE`, `VIDEO`, `PHONE`, or `OTHER`; only a completed `ONSITE` consultation with an outcome satisfies `SITE_MEETING_OUTCOME`. Add an `InquiryEvidence` relation joining an inquiry to an existing secure Document with category `SITE_PHOTO`, `SITE_PLAN`, `SURVEY`, or `OTHER_SITE_EVIDENCE`, plus actor/time. `SITE_EVIDENCE` evaluates these categorized links and ignores unrelated inquiry documents. Continue serving files through the authenticated file endpoint.

### Criterion state and field mapping

Add `InquiryCriterionState` with `inquiryId`, stable `criterionId`, `answerState`, optional `reason`, `source` (`CLIENT`, `ADMIN`, `SYSTEM`, `LEGACY_UNVERIFIED`), `updatedBy`, and timestamps; enforce one current state per inquiry/criterion. Keep a separate immutable audit record for every state transition, including before/after state, reason, actor, time, and `workflowVersion`. The registry maps every criterion ID to its canonical existing field path(s), such as `contact.identity`, `contact.method`, `inquiry.source`, `property.address`, `discovery.projectType`, `inquiry.objectives`, `discovery.mustHaveFeatures`, `inquiry.budgetExpectation`, `inquiry.desiredTiming`, and `inquiry.siteAssessment`. Composite criteria must document each constituent field and how its state is derived. The canonical field value is never duplicated in `InquiryCriterionState`. ROM approval and design-agreement gates read their existing Inquiry status/actor/time fields; an allowed `NOT_REQUIRED` agreement decision must additionally retain its Admin, reason, and timestamp in audit data.

Required schema additions are explicit: `Inquiry.intakeRevision` (integer, default 1), the disposition/source/time/recorder/client-user/evidence/reviewer fields defined above, and a migration marker for legacy review; unique `(inquiryId, criterionId)` on `InquiryCriterionState`; an immutable criterion-state audit record; `WorkItem.criterionId`; `Consultation.meetingMode`; `InquiryEvidence` (inquiry, document, category, actor, timestamp, unique inquiry/document/category); `InquiryHandoffReview` (inquiry, reviewer, review result, intake revision, workflow version, checklist snapshot/hash, ROM preview snapshot/hash, timestamp); and `InquiryActivity` plus its correction/document relations. `InquiryHandoffReview` stores `APPROVED` or `RETURNED`, reviewer ID, reviewed time, the exact `intakeRevision` and `workflowVersion`, structured checklist snapshot (including deferred and unknown values) and its hash, the fully rendered ROM preview snapshot (canonical answer values, applied override values, supplemental narrative, range, and presentation metadata) and its hash, and optional reason. The existing `romStatus`/`romDecisionAt`/`romApprovedBy` fields record approval of that rendered ROM; this is not a second approval action. `InquiryHandoffReview` is the separate final review of the full intake, gates, and snapshot. The immutable snapshot remains readable from the inquiry after conversion; Design receives a read-only link/reference through the converted project's original inquiry relationship so conversion does not lose the proposal. Do not duplicate all canonical inquiry answers into editable project fields. Only `APPROVED` for the current intake revision and workflow version can satisfy `HANDOFF_REVIEW`. Any change to an answer, ROM override, or supplemental narrative increments the intake revision and invalidates prior review. All foreign keys must validate that linked client, inquiry, project, document, activity, and follow-up belong together. The existing production fields are reused; migration names and SQL for only the new state/audit features are selected after a fresh production preflight.

The intake save request includes changed canonical values and any changed criterion-state metadata in one transaction. When an answer changes, the server validates the value/state combination (for example, `CONFIRMED` requires a non-empty valid answer; `UNKNOWN` cannot carry a fabricated value; `NOT_APPLICABLE` requires a permitted criterion and reason). State changes and the aggregate revision update commit or roll back with the field changes.

### Existing-record migration contract

Run a read-only preflight against the exact production-compatible database before migration and report counts by active status, converted status, blank field, duplicate/conflicting canonical/legacy values, and unsupported dropdown value. Do not mutate or auto-advance records during preflight.

- **Active inquiries (`NEW`, `IN_REVIEW`, `QUALIFIED`):** preserve `qualificationStatus`. Empty fields become `UNKNOWN`. Valid values in controlled dropdown fields are preserved with `source=LEGACY_UNVERIFIED` and `answerState=NEEDS_REVIEW` until an Admin reviews them; unsupported free text is also preserved and marked `NEEDS_REVIEW`. No old value is upgraded to `CONFIRMED` solely because it is non-empty.
- **Canonical/legacy duplicates:** if canonical budget/timing is empty and its legacy discovery value is present, copy it to the canonical field and mark `LEGACY_UNVERIFIED/NEEDS_REVIEW`. If both values match, preserve the canonical value and retain the alias as migration metadata. If they differ, preserve both in an Admin review record and block that criterion until resolved; never overwrite one silently. Apply the same conservative rule when converting `preliminaryScope` text into structured features. Convert comma-separated must-have values only when every token matches a supported option; retain unmatched text and mark the criterion `NEEDS_REVIEW`.
- **Existing discovery sentinels:** map `Not yet determined`, `Not sure yet`, `Not decided yet`, `Not discussed yet`, `Access needs site review`, `No known concerns yet`, and `No known constraints yet` to `UNKNOWN`, not a completed answer. Migrate `surveyStatus=Not applicable` as `NEEDS_REVIEW` pending a reason because the old value has no exception audit.
- **Existing meetings/evidence:** a `SCHEDULED` consultation remains scheduled and does not satisfy the onsite outcome. A `COMPLETED` consultation without an outcome or without sufficient evidence that it was onsite remains `NEEDS_REVIEW`. Do not infer onsite status from a title alone. Existing documents remain attached; an Admin confirms whether any is appropriate site evidence.
- **Already converted inquiries:** preserve their client/project links, `CONVERTED` status, and historical snapshot; do not reopen or retroactively block a created Design project. Add a migration marker so the active readiness evaluator skips them.
- **Admin review and rollout:** create an Admin-only “Legacy intake review” queue showing each unresolved criterion and original value. New inquiries use the new registry immediately in local/staging. Do not enforce new gate transitions on existing active records in production until the review queue and count report have been tested, all active inquiries have a documented disposition, and a backup/rollback plan is approved. The rollout must not bulk-set `QUALIFIED` or `CONVERTED` based on derived readiness.

The migration report, reviewed record counts, and exceptions are retained with the release record. If the preflight finds a production schema/source mismatch, stop before applying the migration.

Every activity record identifies inquiry, client, actor/origin, channel, direction, occurred-at time, summary, and creation time. The server verifies that the inquiry belongs to the specified client and organization. Only Admin-authenticated endpoints can list/create/correct activities. Client endpoints never include activity data. A database unique constraint on `(inquiryId, actorId, idempotencyKey)` prevents duplicate Admin-created activity; replaying the same key and identical payload returns the original activity, while a different payload with the same key returns `409 IDEMPOTENCY_KEY_REUSED`. Portal/system events use a separate uniqueness constraint on `(origin, sourceEventId)`. A correction references the original activity, records corrected fields in `correctionJson`, and preserves before/after values in the audit trail. Linked documents must already belong to the same inquiry; document access remains governed by the existing authenticated file endpoint. Organization timezone is initially `America/Phoenix`, persisted/configurable, and used for local display and local-time input; timestamps are stored as UTC instants.

Admin-created activity requires an `actorId` and idempotency key. Portal/system-generated events use a null idempotency key only when their source event has a unique ID; persist that source ID with a unique constraint to prevent duplicate timeline entries. When a client submits a response to an existing information request, create a read-only internal timeline event in the same transaction as the response, with `origin=CLIENT_PORTAL`, `direction=INBOUND`, and `outcomeCode=CLIENT_RESPONSE_RECEIVED`. The client may see their own response in the portal’s existing request history, but never the internal timeline or Reception notes.

If the Log contact form includes a follow-up, create the activity and WorkItem in one database transaction. Require action, owner, and due date together. The idempotency key guards the entire operation so retries cannot create duplicate activity or follow-up tasks.

### Save endpoint

Use `PUT /api/inquiries/:id/intake`. It accepts only editable canonical intake fields, criterion-state changes, and required `expectedIntakeRevision`. Success returns the canonical inquiry, client, property, criterion states, and new revision. Validation errors identify fields/criterion IDs; a stale revision returns `409 STALE_INTAKE_REVISION`; unauthorized or invalid requests make no changes. The server verifies ownership/organization relationships before updating any record. Every endpoint that edits fields in the active Reception aggregate must use the same revision check/increment. No out-of-transaction email, SMS, or other side effect is triggered by this save.

### Workflow/readiness endpoint

Use the same versioned server-side readiness calculation for list cards, detail checklist, and advance/convert actions. Each response includes `workflowVersion`, `intakeRevision`, `activeReceptionPhase` (null for terminal/closed inquiries), `phaseState` (`IN_PROGRESS`, `READY_WITH_DEFERRED_ITEMS`, `COMPLETE`), criterion IDs/classes, item state, deferred follow-up ID where applicable, blockers, permitted exceptions, and next action. The transition endpoint recalculates readiness inside the mutation transaction; it does not trust client-supplied completion flags. Changing gate rules requires incrementing `workflowVersion` and recording the version in transition/handoff audit data.

### Activity API

- `GET /api/inquiries/:id/activities`: Admin-only, paginated, newest/oldest ordering explicitly selectable.
- `POST /api/inquiries/:id/activities`: Admin-only; validates channel/direction, occurred-at, summary, linked follow-up, document ownership, and idempotency key; returns `201` for a new event and the existing event for an identical replay.
- `POST /api/inquiries/:id/activities/:activityId/corrections`: Admin-only; creates an immutable correction event and never overwrites/deletes the source event.
- `POST /api/inquiries/:id/disposition-responses`: CLIENT-only for its own inquiry while Phase 4 is active; accepts one constrained disposition plus optional comment and idempotency key, creates an internal pending event, and does not change inquiry status or authorize conversion.
- `POST /api/inquiries/:id/disposition`: Admin-only; confirms a pending portal event or records an external response using a linked activity, actor attestation, and expected inquiry revision. This records the authoritative disposition; `PROCEED_TO_DESIGN` still requires the separate guarded conversion endpoint.
- `POST /api/inquiries/:id/handoff-review`: Admin-only; accepts `expectedIntakeRevision` and `workflowVersion`, recalculates all **pre-review** Phase 4 gates transactionally (excluding `HANDOFF_REVIEW` itself), and creates an immutable `APPROVED` or `RETURNED` review snapshot/hash. Approve only when every other gate passes; otherwise record `RETURNED` with blockers. A stale revision returns `409` and does not create a review. Approval is valid only for that exact revision/version. Conversion rechecks full readiness, including the approved review, in its own transaction.
- Client-facing `/communications` routes must not return `InquiryActivity` records.

The correction payload identifies changed fields and the reason; only the original author or an Admin may correct an entry. If an activity has an incorrect inquiry/client association, do not re-parent it: create an auditable correction and a replacement entry with the correct association.

## 6. Permissions and audit

- Only `ADMIN` users may log contacts, correct activity, edit Reception-owned intake fields, decide permitted exceptions, and advance or hand off an inquiry. There are no STAFF/Reception roles in this design.
- Client users may not view internal-only activity or change phase, owner, readiness, or handoff status.
- Clients continue to submit answers/files through the existing client portal flow; those submissions remain attached to the original inquiry and are visibly attributable as client-provided.
- Contact creation, correction, certainty changes, not-applicable decisions, gate transitions, and handoff decisions record actor, timestamp, before/after values where relevant, reason, and workflow version.
- Sensitive personal details not needed for project intake should not be added to free-text summaries.

## 7. Error and edge-case behavior

- **Unknown required fact:** keep the answer unknown, assign follow-up, and show the blocker; never require a fabricated value.
- **Not applicable rejected:** explain that the item is required for this project type or phase.
- **Conflicting answers:** mark needs review and preserve both sources until a human resolves them.
- **Site meeting not yet completed:** block Phase 3 and handoff. No bypass is available in the first release; do not show “not required” or count a remote discovery call as the onsite visit.
- **No photos/plan available:** record “not yet provided” and assign follow-up only if evidence is required for that project/phase.
- **Failed cross-record save:** rollback all writes, preserve the form draft, and show a retryable error.
- **Concurrent edit:** return a conflict with the current revision; do not overwrite silently.
- **Duplicate contact submit:** apply the documented per-inquiry/per-actor idempotency key behavior; reject key reuse with a different payload.
- **Handoff request repeated:** return the already linked project when it is the same inquiry; never create a second project.
- **Legacy incomplete records:** show their current values and explicit unknown status without fabricating history; avoid bulk status advancement.

## 8. Implementation sequence

### Phase 0 — source and schema reconciliation

#### Comparison snapshot — 2026-09-30

This is a read-only comparison. The evidence sources are deliberately distinguished so local notes are not mistaken for direct production verification.

| Surface | Observed evidence | Confidence / implication |
|---|---|---|
| Local checkout | Branch `codex/update-reception-workflow` at commit `05411e335c48323061076f5681a86380fa8e1e63` (2026-09-30), matching `origin/codex/update-reception-workflow`; the working tree was clean before this design-only edit. Root/backend/frontend package files declare `1.1.0`; this review did not build that package-version candidate. The migration tree ends at `20260923180000_rom_proposal_details`. | Directly checked in the project UNC checkout. Use this immutable commit as the implementation base and keep its package version distinct from a verified release. |
| Existing local Reception behavior | The four visible labels are `Initial Contact Made`, `Pre-Design Discovery`, `Site Meetings & ROM Preparation`, and `ROM Approval & Design Handoff`. Queue phase currently follows `qualificationStatus`; existing discovery, meeting, ROM, agreement, handoff, and conversion gates are present. Both `proposalNarrative` and `romProposalDetails` exist in schema/API/UI; `romProposalDetails` stores structured editor override JSON, while `proposalNarrative` is a separate supplemental narrative field. The proposed `intakeRevision`, `InquiryCriterionState`, `InquiryActivity`, and `InquiryHandoffReview` models are not implemented. | Directly checked in UI, API, and Prisma schema. Preserve existing phase labels and ROM fields; implement the new audit/concurrency models additively. |
| GitHub | The configured `origin` is `https://github.com/dylanhdogs/design-client-portal.git`. The checked feature branch `codex/update-reception-workflow` is at `05411e335c48323061076f5681a86380fa8e1e63`; `main` is at `7ef8e34ba9060bfd94629937787e0b0a3ea07395`. The feature branch has the migration endpoint below; `main` does not. | Directly checked local refs after fetch. The feature branch is the implementation base; `main` is not a production-compatible substitute. |
| Public production app | A read-only request to `https://app.srv1633240.hstgr.cloud/` returned HTTP 200 on 2026-09-30. Its response reports `Last-Modified: 2026-09-23 18:29:10 GMT` and serves HTML referencing `index-U4Yd4_rx.js` and `index-BMT880wA.css`. | Directly checked public response. This verifies the site is serving, but does not identify the source commit, Docker image digest, API build, or database migration state. Hashed asset names are not a semantic version. |
| VPS release and database | Read-only SSH verified `/docker/webapp/docker-compose.yml` points to retained context `./releases/20260923-1827`, image `signature-portal:20260923-1827`; running `webapp-backend-1` is healthy with digest `sha256:25119e9d30e8c6d51393087ad98124c2b6e394242a4814f6f3281a485142318d`. The release directory has no Git metadata and inspected Compose labels expose no source commit, so exact deployed source provenance is unknown. Five production files that affect this design (`backend/prisma/schema.prisma`, inquiry routes, consultation routes, frontend Inquiries page, and frontend inquiry types) compare byte-for-byte after line-ending normalization with selected local commit `05411e335c48323061076f5681a86380fa8e1e63`. Production and local migration trees contain the same 33 migration names and SQL after line-ending normalization; all 33 are applied in production through `20260923180000_rom_proposal_details`. The read-only production DB baseline is 6 inquiries: 1 `NEW`, 1 `QUALIFIED`, 4 `CONVERTED`. | Directly checked against the VPS using read-only commands and a read-only SQLite connection. Relevant source surfaces and complete migration history are compatible with the selected base; byte-level source provenance of the running image remains unknown. No application/database/VPS state was changed. |
| SSH access readiness | Matching private key and trusted host-key entry are now present locally; strict host-key SSH authentication succeeded for read-only inspection. | Directly checked. Keep future production commands read-only until a separate implementation/deployment request and required release safeguards. |

**Implementation gate:** Phase 0 technical reconciliation is complete for the surfaces and records relevant to this design. Implementation may begin from immutable feature-branch commit `05411e335c48323061076f5681a86380fa8e1e63`, with source/migration comparisons and production baseline recorded above. The retained deployed release has no Git metadata; its exact source commit is explicitly unknown and must not be inferred from the image tag. The design preserves the production fields and existing client/API behavior, and adds only the specified readiness/audit concepts. Before implementation adds schema or changes enforcement, run the planned legacy-data preflight against the then-current DB and review results; before any production migration or rollout, require a fresh verified backup, tests, and reviewed rollback procedure. No production writes were made during this readiness pass.

#### Phase 0 exit checklist

- **Complete:** record the healthy running image/tag/digest, Compose release context, all 33 applied migration names and SQL, and the six-record status baseline (1 `NEW`, 1 `QUALIFIED`, 4 `CONVERTED`). These are point-in-time read-only observations; refresh before implementation touches production.
- **Complete:** compare the five design-critical production source files to the selected feature-branch source after line-ending normalization. They match. The retained release folder has no Git metadata, so record its exact source commit as **unknown**; do not infer it from the image tag or migration endpoint.
- **Complete:** compare all 33 production migration names and SQL with the selected base after line-ending normalization. They match, and all are applied through `20260923180000_rom_proposal_details`.
- **Complete:** reconcile the ROM fields: canonical inquiry answers remain the default source; `romProposalDetails` is structured proposal-only override data; `proposalNarrative` is supplemental narrative. Preserve both and do not automatically copy between them. ROM approval and design-agreement approval remain separate blocking gates.
- **Complete:** verify existing Communication, Consultation, inquiry, and ROM read/write surfaces; preserve client-visible Communication and add the dedicated internal `InquiryActivity` model specified here.
- **Complete:** use immutable feature-branch commit `05411e335c48323061076f5681a86380fa8e1e63` as implementation base, not `main`; do not package an uncommitted tree as a release.
- **Complete for design baseline only:** capture the read-only schema/count/status baseline. Immediately before any migration, rerun the data preflight on current production and require an independently verified backup plus a reviewed rollback procedure.
- **Implementation task:** implement and test every criterion mapping/sentinel in the versioned registry, including ROM approval and agreement status, against the reconciled schema. For `NOT_REQUIRED` design agreement, require Admin actor, reason, timestamp, and audit.
- **Pre-enforcement gate:** produce/review the legacy-data preflight report, assign record-review workload, and agree the rollout gate before enforcing new criteria on existing active inquiries.

#### Fresh read-only legacy-data preflight — 2026-09-30

The approved refresh used strict-host-key SSH and opened the live SQLite database with `mode=ro` plus connection-level `query_only`. The report contains aggregate counts only; no inquiry, contact, property, credential, or free-text values were emitted. No production data or files were changed.

| Check | Result | Implication |
|---|---|---|
| Inquiry statuses | 6 total: 1 `NEW`, 1 `QUALIFIED`, 4 `CONVERTED`; 2 active | Preserve the four converted records as history; review the two active records before enforcing new criteria. |
| Active intake blanks | Both active inquiries have a contact method, name, channel, owner, next action/due date, property address, objective, canonical budget, canonical timing, and preliminary scope. Both lack design inspiration. | Inspiration cannot be presumed complete; capture `NONE_PROVIDED` explicitly or add a reference. |
| Active ROM/handoff fields | Both active records have no ROM amount/status or design-agreement status. | These are later-phase work, not an intake migration defect. |
| Legacy discovery fields | No active controlled discovery values were present; no malformed/non-object discovery JSON; no populated legacy budget/timing aliases or preliminary-scope/features overlaps. | This refresh found no legacy-value conflicts to resolve, but all existing active answers still require explicit human confirmation under the migration contract. |
| Consultations | 1 non-deleted consultation linked to an active inquiry; it is completed, has an outcome, and matches the legacy “site meeting” candidate rule. The deployed schema has no `meeting_mode`. | Do not infer onsite completion from the legacy record; it needs Admin review/evidence. |
| Migration history | Production has 35 applied migration entries through `20260923180000_rom_proposal_details`; this branch has 33 baseline migration directories. Production contains `20260619194000_add_communication_threads` and `20260619201000_add_client_action_required`, whose migration directories are absent from this branch. `intake_revision` and the new criterion/activity/handoff models are not in production. | Migration history is not reconciled. Continue code work locally, but do not apply a migration or deploy until the two production-only migrations are reconciled and the generated migration is checked against the live schema. |

The earlier six-inquiry status baseline remains an accurate count, but its statement that production and branch migration trees matched is superseded by this fresh comparison. Production remains untouched; migration, backup, and rollout approvals are still separate gates.

### Phase 1 — atomic editing

- [x] Add the single cross-record intake update operation and transaction, guarded by `intakeRevision`.
- [x] Add visible saving, validation, dirty-form close protection, and stale-draft review/reload handling.
- [x] Test rollback by forcing each constituent update to fail.

### Phase 2 — checklist certainty and canonical readiness

- [x] Define each criterion by stable ID, phase, requirement class, allowed answer states, and not-applicable permission in one versioned server registry.
- [x] Additive schema changes represent certainty and audit requirements.
- [x] Update queue counts, detail checklist, and server transition validation to use the same evaluator.
- [ ] Run the conservative legacy backfill after production migration history is reconciled; preserve values and mark unverified data for Admin review.
- [x] Add computed `activeReceptionPhase` and test active inquiry assignment to a phase independent of `qualificationStatus`.

### Phase 3 — inquiry activity timeline

- [x] Add the compact Log contact form, dedicated internal-only activity APIs/model, and chronological timeline.
- [x] Add `criterionId` to deferrable inquiry follow-up WorkItems and validate that relationship server-side.
- [x] Link activities securely to the original inquiry and client.
- [x] Preserve existing document/consultation behavior and show relevant records without duplicating them.

### Phase 4 — final handoff wording and safeguards

- [x] Rename explanatory copy to state that ROM/proposal is preliminary.
- [x] Add the authenticated client response path and Admin review for client disposition; log external responses with attributable activity evidence.
- [x] Require a handoff review against the current intake revision and current workflow version.
- [x] Verify conversion preconditions and idempotency with local API/security tests; production release validation remains open.

### Phase 5 — end-to-end verification

- [x] Exercise readiness rules, API saves, revision conflicts, client activity, idempotency, permissions, and conversion gates on isolated local test data.
- [x] Add transaction fault-injection tests for client, property, and inquiry writes.
- [ ] Add browser-level workflow smoke coverage.
- [ ] Verify the deployed migration chain and create a backup/rollback note before release.

## 9. Acceptance criteria

The change is accepted when:

1. A representative can log a phone call, SMS, email, meeting, or other contact directly on the existing inquiry.
2. Every activity shows channel, direction, time, actor/origin, and summary, and is internal-only; client users never receive these records.
3. No follow-up action requires a second inquiry.
4. A representative can record unknown information without inventing a value; required unknowns show an owner and next step and block advancement as defined.
5. Not-applicable exceptions require a reason, are limited to allowed criteria, and are auditable.
6. Queue counts, profile checklist, and backend transitions agree for every inquiry status and phase.
7. Scheduled meetings are not counted as completed meetings; proposal delivery is not counted as client acceptance; only `PROCEED_TO_DESIGN` can convert.
8. Reception copy clearly describes the ROM and proposal as preliminary and distinguishes proceed, more-information, pause, and decline responses.
9. A portal disposition is pending until Admin review; an external disposition requires a linked activity and Admin attestation; no free-text response can convert an inquiry.
10. Updating client, inquiry, and property through the edit form is all-or-nothing.
11. On a failed save, entered data remains in the form and no false success message appears.
12. Concurrent edits use mandatory `intakeRevision` compare-and-increment behavior; stale edits return `409` and cannot overwrite newer values.
13. Duplicate contact submissions and repeated handoffs do not create duplicate activity or Design projects.
14. Role and relationship tests prove that clients cannot see internal contact notes or modify internal workflow state.
15. Existing inquiries, communications, consultations, files, and client portal follow-up still work after migration.
16. The four phase cards use their approved labels and count each active inquiry exactly once from server-derived readiness; a qualified inquiry with Phases 1–3 complete appears in the ROM/proposal phase, not an earlier status-derived card.
17. Phase 2 cannot advance without a scheduled onsite consultation; Phase 3 cannot advance on scheduling alone and requires a completed onsite meeting with outcome.
18. Handoff review is bound to the current intake revision and workflow version; any edit or rule-version change invalidates a stale approval.
19. The ROM preview defaults to canonical inquiry answers, applies only explicit structured ROM overrides, and includes supplemental `proposalNarrative` only as separate narrative; editing the preview never changes inquiry answers.
20. The approved handoff retains an immutable rendered ROM snapshot and hash; after conversion, Design can open it read-only from the converted project/inquiry link, including the range, narrative, source answers, applied overrides, and review metadata.
21. Conversion is blocked unless the ROM approval is recorded, the design agreement is accepted or Admin-approved as not required with reason/audit, and the client disposition is reviewed `PROCEED_TO_DESIGN`.

## 10. Required test matrix

| Scenario | Expected result |
|---|---|
| Create incoming call entry with a follow-up | Timeline entry and linked follow-up appear once |
| Log outgoing email without a follow-up | Entry saves with correct channel/direction and internal visibility |
| Mark required site fact unknown | Phase remains blocked; exact item and next action are shown |
| Mark permitted criterion not applicable without reason | Validation error; no state change |
| Mark permitted criterion not applicable with reason | Item satisfies gate and audit entry is recorded |
| Two internal users edit same intake revision | Second stale update gets conflict; no silent overwrite |
| Client data update succeeds but inquiry update is forced to fail | Entire transaction rolls back |
| Property write fails during intake update | Client and inquiry writes also roll back |
| Repeat activity request with same idempotency key and payload | One activity record exists and the original is returned |
| Reuse activity idempotency key with different payload | `409 IDEMPOTENCY_KEY_REUSED`; no second activity is created |
| Meeting is scheduled but not completed | Scheduled count increases; completed gate remains unmet |
| Inquiry is `QUALIFIED` with Phase 3 incomplete | Counted in Phase 3, not Phase 2 or Phase 4 |
| Inquiry is `QUALIFIED` with Phases 1–3 complete and proposal awaiting client | Counted in Phase 4, remains active, and shows awaiting-client-response |
| Phase 2 criteria are complete but onsite consultation is not scheduled | Remains in Phase 2; cannot advance |
| Onsite consultation is scheduled but not completed | Counted in Phase 3; Phase 3 remains incomplete |
| Earlier field changes and makes a completed phase criterion fail | Derived phase regresses to earliest incomplete; later values remain intact and regression is audited |
| Remote call is entered as a discovery call without onsite meeting | Phase 3 remains blocked |
| Existing inquiry has a non-empty legacy value with no source provenance | Value preserved as `NEEDS_REVIEW`; no automatic confirmation or phase advancement |
| Client responds `MORE_INFORMATION` to preliminary proposal | Inquiry remains in Reception with criterion-linked follow-up, not converted |
| Client responds `PAUSE` or `DECLINE` | Inquiry moves to nurture/declined with required reason; no conversion |
| Client responds `PROCEED_TO_DESIGN`, Admin reviews and confirms it, and all gates pass | One client activation/project conversion succeeds |
| Client submits `PROCEED_TO_DESIGN` from portal | Pending internal response is recorded; no conversion until Admin reviews and confirms it |
| Admin records `PROCEED_TO_DESIGN` from an external call without linked evidence activity | Validation fails; no authoritative disposition or conversion |
| Client disposition is reviewed and then converted | Reviewer, response source/time, evidence activity, workflow version, and conversion are auditable |
| Handoff review submits a stale revision or workflow version | No approval is created; current readiness is returned for review |
| ROM editor changes a proposal-specific value | ROM preview changes, canonical inquiry answer is unchanged, and prior handoff approval becomes stale |
| ROM preview is approved and inquiry is converted | Immutable reviewed snapshot/hash remains available read-only to Design and is not silently regenerated from later edits |
| ROM approval is pending/rejected, or required agreement gate is unresolved | Conversion is blocked with the exact gate shown |
| Design agreement is marked not required without Admin, reason, and audit | Validation fails; conversion is blocked |
| Active inquiry with `Not yet determined` project type | Project type is `UNKNOWN`; Phase 2 remains blocked |
| Active inquiry with `QUALIFIED` status and Phase 4 active | Phase 4 queue count increases regardless of qualification status |
| Completed remote consultation with outcome | Does not satisfy onsite meeting criterion |
| Client attempts to read internal activity through inquiry or communications APIs | No internal activity is returned; access is denied or endpoint is unavailable to CLIENT |

## 11. Risks and safeguards

| Risk | Safeguard |
|---|---|
| Checklist becomes overly permissive | Define allowed exception states per individual criterion; enforce server-side |
| Reception over-collects sensitive data | Keep summaries project-relevant and internal by default; avoid unnecessary personal data |
| Activity feature becomes a full CRM project | Limit first release to concise manual contact logging and follow-up |
| Internal activity exposes private notes | Use the dedicated `InquiryActivity` model and Admin-only API; never serialize it through client communication routes |
| Queue labels drift from actual rules | One canonical server readiness evaluator and contract tests |
| “Proposal” is mistaken for final design/pricing | Explicit preliminary language in UI, reports, and handoff snapshot |
| Transaction differs between local and VPS schema | Reconcile production migrations and test against the exact deploy source before rollout |
| Legacy data appears complete when it is not | Backfill unknown conservatively; never infer confirmation from non-empty legacy text alone |
| GitHub default branch is mistaken for the production source | Pin the running image/source revision and migration inventory before selecting an implementation base |
| Local package version or frontend asset hash is mistaken for a complete release identity | Track semantic version, unique release ID, source commit, image digest, and database migration endpoint together; frontend asset names alone are not release proof |

## 12. Definition of design readiness

This design is implementation-ready. Phase 0 read-only reconciliation is complete and documented in the comparison snapshot; the deployed image’s exact source commit remains unknown, while the five relevant source files and all 33 migration files were directly compared with the pinned implementation base. Feature implementation can start from that immutable commit. Before any production migration or enforcement rollout, rerun the data preflight against current production, verify a backup, complete tests, and approve a rollback plan. Never infer source provenance from an image tag. The criterion registry must follow the explicit blocking/deferrable/optional rules in Section 4.3; no criterion may be treated as deferrable by default. The spec includes a revision-bound, immutable ROM preview derived from inquiry answers with structured overrides, separate ROM/agreement/client-disposition approvals, and read-only Design access after conversion. Product behavior, activity/API contract, save atomicity/concurrency, permissions, disposition branches, rollout, acceptance criteria, and tests are specified. **At the time of the design-readiness review, no application, database, or VPS changes had been made.**

## 13. Implementation status — local branch, 2026-09-30

Implementation is underway on `codex/update-reception-workflow`. The changes are local, uncommitted project work. They have not been pushed to GitHub or deployed.

Implemented locally: revision-checked intake saves and stale-edit handling; the versioned readiness registry and conservative legacy-answer review states; phase assignment and shared queue/detail/API gates; inquiry activity, evidence, and follow-up linkage; attributed, replay-safe client responses; ROM preview snapshots bound to the inquiry revision; client-safe proposal response controls; Admin disposition/handoff review; and conversion safeguards. Existing canonical inquiry answers remain the ROM defaults, with structured proposal overrides kept separate.

Local verification on an isolated disposable SQLite database:

- Backend test suite: **60 passed, 0 failed**.
- Backend build (`prisma generate` and TypeScript compile): passed.
- Frontend build (TypeScript compile and Vite production bundle): passed. Vite reports the generated JavaScript bundle is 627.91 kB and above its 500 kB advisory threshold; this is a performance follow-up, not a build failure.
- All migration SQL in the local branch was applied to an in-memory SQLite database with foreign-key checks enabled. This does not verify Prisma deployment behavior or compatibility with the live production schema.
- `prisma migrate deploy` also applied all 36 branch migrations successfully to a fresh, disposable local SQLite database. This is fresh-database validation only; it does not simulate production’s extra applied migration records.

The atomic intake-save test now injects a failure at each client, property, and inquiry update in turn, verifies that all earlier writes and the revision are rolled back, and confirms that no audit event is created. Unexpected database failures are returned as internal errors rather than being mislabeled as request-validation errors.

Release remains blocked. The refreshed read-only preflight found two production-applied migrations (`20260619194000_add_communication_threads` and `20260619201000_add_client_action_required`) absent from this branch’s baseline migration directories, and neither definition appears in the available local Git refs. Reconcile the exact historical migration records/SQL and verify how Prisma treats that production history before any migration or rollout. The legacy backfill has not been executed; browser-level end-to-end smoke tests remain open. Do not migrate, backfill, write to production, deploy, or push until migration history is reconciled, the live schema compatibility is reviewed, a backup/rollback procedure is verified, and separate authorization is granted. The approved live check was read-only only.
