# Client Data Request Runbook

This operational runbook covers requests to access/export, correct, or delete client data. It is a workflow template, not legal advice. The business owner must adapt response deadlines, identity standards, retention, and legal obligations to the applicable contracts and jurisdictions before real-client use.

## Safety rules

- Never fulfill a request using only an unverified email, caller ID, or portal display name.
- Never send database files, backups, internal credentials, security logs, other clients' records, or unrestricted administrative exports to a requester.
- Use the minimum authorized data needed for the request and an approved secure delivery method.
- Preserve active legal holds and records that must be retained; explain any approved limitation without exposing privileged/internal material.
- Do not edit production data directly in SQLite. Use normal application actions or an approved, tested administrative procedure with audit evidence.
- A second authorized reviewer verifies scope, identity, recipient, and package contents before release or irreversible action.

## Intake record

| Field | Required value |
|---|---|
| Request ID |  |
| Request type | Access/export / Correction / Deletion / Restriction / Other |
| Received UTC |  |
| Request channel |  |
| Client/project identifiers |  |
| Assigned business owner |  |
| Technical operator |  |
| Required response date |  |
| Identity verification method/result | Record status only; never secrets |
| Legal/contract review needed | Yes / No; owner |
| Legal hold or retention restriction | Yes / No; evidence |

## Scope and identity

1. Record the request without copying unnecessary personal information into tickets or chat.
2. Match the requester to the client and authorized contact using the approved identity-verification method.
3. Define the exact people, projects, date range, and data categories in scope.
4. Check client-level and record-level legal holds before correction or deletion.
5. Identify records subject to mandatory retention and have the business owner approve exclusions.
6. Record whether internal notes, pricing, staff communications, audit/security records, third-party data, or privileged material require review or exclusion.

## Access or export

The current pilot application does not provide a one-click client export. Until a reviewed export feature is implemented, an ADMIN and technical operator must create the package in a separate restricted verification location, using a restored/verified copy when practical. The business owner must review every file and record before delivery.

- [ ] Inventory the client's profile, project records, client-visible communications, approvals, and uploaded documents.
- [ ] Exclude other clients and review internal-only notes, costs, audit/security events, and third-party information before release.
- [ ] Compare record/file counts to the scoped inventory.
- [ ] Scan the package for credentials, tokens, unrelated personal data, and unsafe files.
- [ ] Encrypt or otherwise protect the package using the approved delivery method; communicate any password/key separately.
- [ ] Record delivery time, recipient, package checksum, expiry/removal time, and second-reviewer approval without retaining the secret.

## Correction

- [ ] Capture the original value and requested correction in the restricted request record.
- [ ] Confirm the requester is authorized to change the field or project record.
- [ ] Apply the change through the application's normal edit action.
- [ ] Verify the corrected value in the client-visible view and confirm unrelated records did not change.
- [ ] Preserve required audit/history records and notify the requester through the approved channel.

## Deletion

Application deletion is recoverable soft deletion unless an approved retention process later performs disposal. A successful UI/API message must not be represented as immediate physical erasure from current backups.

- [ ] Check active legal holds first; record and communicate an authorized refusal or limitation when a hold applies.
- [ ] Confirm retention obligations and identify which records can be soft-deleted now.
- [ ] Archive the client through the application; this atomically suspends linked portal access, invalidates sessions, and deactivates client project assignments.
- [ ] Perform deletion through the application and verify the records/files are unavailable in normal and client views.
- [ ] Record when soft-deleted data and encrypted backups become eligible for expiry under policy.
- [ ] Do not manually remove historical backup content; allow approved encrypted-backup retention to expire unless legal/incident counsel directs otherwise.

## Fictional staging rehearsal

- [ ] Create a fictional client with a login, project, client-visible communication, internal note, allowed upload, and representative workflow records.
- [ ] Prove the inventory contains only that client's intended records and that internal-only content is reviewed/excluded.
- [ ] Correct one profile field and verify the audit trail/result.
- [ ] Place a client legal hold and prove deletion is refused.
- [ ] Release the hold, suspend access, soft-delete the fictional client, and prove normal/client retrieval is denied.
- [ ] Record counts, evidence, issues, elapsed time, and owner sign-off without preserving credentials.

| Approval | Name | UTC date | Result | Evidence/issue IDs |
|---|---|---|---|---|
| Business owner |  |  | Pass / Fail |  |
| Application owner |  |  | Pass / Fail |  |
| Technical reviewer |  |  | Pass / Fail |  |
