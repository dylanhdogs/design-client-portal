# Recovery Acceptance Checklist

Use fictional staging data for destructive drills. Never overwrite production during a rehearsal. A production restore must first go to a new, empty verification directory and requires incident-owner authorization before cutover.

## Recovery evidence header

| Field | Value |
|---|---|
| Drill or incident ID |  |
| Environment |  |
| Scenario | Process / database / uploads / complete VPS |
| Started (UTC) |  |
| Recovery point timestamp (UTC) |  |
| Service restored (UTC) |  |
| Measured data loss |  |
| Measured RTO |  |
| Technical operator |  |
| Business witness |  |
| Release ID and manifest |  |
| Backup filename and off-server provider object/version |  |
| Evidence directory |  |

Do not record passwords, tokens, encryption keys, client document contents, or webhook URLs.

## Required scenarios

### 1. Application-process loss

- [ ] Use staging and confirm liveness/readiness before the drill.
- [ ] Stop or terminate only `signature-portal@staging.service`.
- [ ] Confirm `systemd` restores the process according to the service policy.
- [ ] Confirm readiness, role login, database records, and a fictional uploaded file remain available.
- [ ] Record service timestamps and relevant sanitized journal lines.

### 2. Database-path loss

- [ ] Create and mirror a fresh encrypted staging backup.
- [ ] Stop staging and preserve the database, WAL, and SHM files under a drill-specific quarantine name; do not delete them.
- [ ] Restore the backup into a new empty directory and verify its reported checksums/integrity.
- [ ] Install the verified database at the configured staging path with `portal:portal` ownership and mode `0600`.
- [ ] Apply forward migrations from the compatible release, start staging, and verify the representative record set.
- [ ] Reconcile a frozen inventory and record RPO/RTO.

### 3. Upload-path loss

- [ ] Create and mirror a fresh encrypted staging backup.
- [ ] Stop staging and move the upload directory to a drill-specific quarantine path; do not delete it.
- [ ] Restore into a new empty verification directory.
- [ ] Install the verified upload tree with `portal:portal` ownership and directory/file permissions no broader than required.
- [ ] Start staging and download representative fictional files through the authenticated proxy.
- [ ] Compare upload paths, sizes, and SHA-256 values and record RPO/RTO.

### 4. Complete VPS loss

- [ ] Provision a replacement Ubuntu VPS in the approved region using the reviewed provisioning and SSH-hardening scripts.
- [ ] Restore production configuration from the protected secret store; do not copy staging secrets.
- [ ] Deploy the release identified by the backup/release manifest, but keep public traffic disabled until recovery verification passes.
- [ ] Retrieve the selected encrypted backup from the independent provider and verify provider object/version metadata.
- [ ] Restore into a new empty directory using `backup:restore`; require `verified: true` before cutover.
- [ ] Preserve any replacement-server database/uploads in quarantine, then install the verified database and upload tree at the configured persistent paths.
- [ ] Apply only compatible forward migrations, start the service, and run host, health, authorization, file, and reconciliation checks.
- [ ] Restore Nginx/TLS, monitoring, timers, and the external uptime check.
- [ ] Change DNS only after the business and technical witnesses approve recovered state.
- [ ] Record measured RPO/RTO, missing records if any, follow-up actions, and final authorization.

## Recovery acceptance

- [ ] Database integrity is `ok`.
- [ ] Source/backup and recovered upload checksums reconcile.
- [ ] ADMIN, STAFF, and CLIENT boundaries work with fictional or approved verification accounts.
- [ ] No staging secret, test account, or unapproved data appears in production.
- [ ] Backup, mirror, monitor, and certificate checks are active after recovery.
- [ ] RPO and RTO meet the approved targets, or an owned Severity 0/1 issue blocks launch.

| Approval | Name | Decision | UTC timestamp | Signature/evidence |
|---|---|---|---|---|
| Technical owner |  | Pass / Fail |  |  |
| Application owner |  | Pass / Fail |  |  |
| Business owner |  | Pass / Fail |  |  |

## Backup encryption-key rotation

1. Two authorized custodians confirm the current key is recoverable from the approved secret store without exposing it in evidence.
2. Retain the old key while any backup encrypted with it remains inside retention.
3. Generate and escrow a new independent key, update only the protected production environment, and restart through the controlled deployment procedure.
4. Create a new write-consistent backup, mirror it off-server, and restore it into a new empty directory with the new key.
5. Restore one retained historical backup with the old key.
6. Record only key identifiers/fingerprints, custodians, test outcomes, and dates—not key material.
7. Retire the old key only after every backup requiring it has expired or been deliberately disposed under the approved retention policy.

