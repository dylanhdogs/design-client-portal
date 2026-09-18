# Launch Evidence Index

Use this index to prove the exact release and environment that passed each gate. Store it in an owner-accessible, access-controlled location separate from the replaceable application release. Evidence must contain no passwords, tokens, private keys, reset/invitation links, payment details, or unnecessary client data.

## Index metadata

| Field | Value |
|---|---|
| Environment | Staging / Production |
| Release ID and Git commit |  |
| Domain |  |
| Evidence root/location |  |
| Evidence retention period |  |
| Retention owner |  |
| Primary custodian |  |
| Backup custodian |  |
| Index last reviewed (UTC) |  |

## Required evidence

| Gate/artifact | Required identifier or contents | Location | Owner | UTC date | Verified by/result |
|---|---|---|---|---|---|
| Approved decision register | Every final value, owner, date, evidence |  |  |  |  |
| Protected source/release | Repository, branch, commit, release ID |  |  |  |  |
| Release verification | Node/npm, lock hashes, source hash, migrations, tests, builds, audits, performance, parity |  |  |  |  |
| Host inventory | OS, packages, services, ports, paths; no secret values |  |  |  |  |
| Host security | UFW, SSH, fail2ban, updates, least privilege |  |  |  |  |
| DNS/TLS | Cutover worksheet, lookups, certificate, redirect |  |  |  |  |
| Staging protection | Basic Authentication/restriction and noindex |  |  |  |  |
| Role acceptance | ADMIN, STAFF, CLIENT, isolation, workflow |  |  |  |  |
| Supported-client matrix | Approved combinations and results |  |  |  |  |
| Accessibility | Automated/manual evidence and exceptions |  |  |  |  |
| Backup and off-server copy | Recovery-point ID, checksums, mirror status, retention |  |  |  |  |
| Restore/recovery | Four scenarios, measured RPO/RTO, approvals |  |  |  |  |
| Encryption-key custody | Custodian verification and rotation result; no key value |  |  |  |  |
| Monitoring/alerts | External uptime and named-human receipt |  |  |  |  |
| Data disposition/migration | Clean-start approval or exact reconciled inventory |  |  |  |  |
| Privacy/data request | Published notice, contact, retention, fictional rehearsal |  |  |  |  |
| Access review | Hostinger, DNS, repository, backup, alert, email, portal |  |  |  |  |
| Production smoke | Synthetic record/upload markers and cleanup result |  |  |  |  |
| Pilot authorization | Business-owner go/no-go decision |  |  |  |  |

## Integrity and access checks

- [ ] Every artifact identifies the release/environment it tested.
- [ ] Machine-generated evidence is retained in original form with hashes where the supplied tools provide them.
- [ ] Screenshots are accompanied by a written result, UTC time, tester, and affected environment.
- [ ] Evidence is readable by the backup custodian without relying on the original operator's account.
- [ ] Access is limited to people with a current business need and reviewed in `PRODUCTION_ACCESS_REVIEW.md`.
- [ ] Any necessary personal data is minimized, access-controlled, and removed according to the approved retention rule.
- [ ] Failed checks and accepted exceptions link to the issue register rather than being overwritten.
- [ ] Superseded evidence remains distinguishable from the currently approved release.

The production gate does not pass when a required row is blank, points only to an operator's personal device, or refers to a different release than the one deployed.

