# Operations, Backup, and Recovery Runbook

## Service health

- `GET /api/health/live` confirms the process is alive.
- `GET /api/health/ready` verifies database access, readable/writable upload storage, and backup freshness when scheduled backups are enabled.
- `GET /api/health` returns the same dependency checks plus the correlation ID.

Production orchestration should use `/api/health/live` for liveness and `/api/health/ready` for readiness. A non-ready response is HTTP 503.

## Encrypted backups

Set `BACKUP_ENABLED=true`, choose `BACKUP_SCHEDULER_MODE`, set an interval no greater than 24 hours, point `BACKUP_DIR` at durable storage, and inject a separately managed `BACKUP_ENCRYPTION_KEY` of at least 32 characters. Internal mode creates a transactionally consistent SQLite snapshot with `VACUUM INTO` while the application remains online. Hostinger production uses the external consistent-backup timer documented in `HOSTINGER_OPERATIONS_RUNBOOK.md`; it briefly pauses writes so the SQLite snapshot and uploaded files represent one recovery point. Backups use AES-256-GCM, exclude symlinks, publish atomically only after encryption completes, and SHA-256 verify every restored object.

Manual backup:

```bash
cd backend
npm run backup:create
```

Manual restore into an empty verification directory:

```bash
cd backend
npm run backup:restore -- backups/<backup-file>.backup.json restore-verification
```

Never restore directly over the live database. Stop writes, restore to a new directory, verify checksums and database migration state, then atomically switch the configured paths during the recovery window.

## Recovery objectives and evidence

- RPO target: 24 hours. Configuration rejects intervals above 24 hours. Hostinger production captures and mirrors a recovery point every 12 hours and marks readiness unhealthy after 14 hours, leaving margin for the target; live timing still must be demonstrated in Phase 5.
- RTO target: 4 hours. The 2026-08-26 restore verification decrypted and checksum-verified a 2,768,896-byte database in 46 ms. The automated backup tests also require completion below four hours.
- Restore test: passed on 2026-08-26. Database SHA-256 was `4e01fba682e08a19d31f8777752b4fc6f8cf49cc4770635c0851582ca949a8e1`.

## Alert routing

The `operational_alerts` table and management APIs retain alerts for:

- `HTTP_5XX`
- `AUTH_FAILURE`
- `GATE_CONFLICT`
- `NOTIFICATION_FAILURE`
- `UPLOAD_FAILURE`
- `BACKUP_FAILURE`
- `AUTOMATION_FAILURE`

Alerts include correlation ID where available and exclude sensitive request values. Operations should connect open CRITICAL alerts to the deployment platform's paging destination and WARNING alerts to the operations queue. Acknowledge only after the underlying condition is understood.

## Incident steps

1. Capture the request ID, timestamp, health response, and alert category.
2. Check structured logs by request ID; do not request passwords or tokens from users.
3. If data integrity is uncertain, disable affected workflow feature flags and preserve legacy paths.
4. For notification failures, leave in-app records authoritative and retry the external outbox after provider recovery.
5. For backup failure, repair durable storage or the encryption-key injection and immediately run a manual backup plus restore verification.
6. Record resolution, impact, and preventive action.

## Retention and legal hold

`DOCUMENT_RETENTION_DAYS` defaults to 2,555 days (seven years). New documents receive `retentionUntil`. An ADMIN can place or release a legal hold through the management API. Active document holds and client-level holds block deletion; hold creation and release are audited. Retention cleanup must skip active holds and should run only under a formally approved data-retention schedule.
