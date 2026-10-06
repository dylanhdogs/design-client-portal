# Production Data Migration Runbook

## Default Decision

Start production with a clean database. Import local records only after the business owner identifies them as authoritative and approves migration.

## Controlled Migration Requirements

1. Freeze writes to the source application.
2. Create and verify an encrypted source backup.
3. Inventory users, clients, projects, documents, and physical upload files.
4. Remove demonstration accounts and fictional records from the approved migration copy.
5. Apply every migration and workflow backfill to a separate verification copy.
6. Run database integrity and parity checks.
7. Reconcile record counts by entity and uploaded files by filename mapping, size, and checksum.
8. Require business-owner review of rejected or ambiguous records.
9. Transfer the approved database and uploads through an encrypted channel.
10. Set least-privilege ownership, start production, and repeat reconciliation.
11. Preserve the source backup until production acceptance and retention approval.

## Reconciliation Record

| Entity | Source count | Approved count | Production count | Difference explained | Owner approval |
|---|---:|---:|---:|---|---|
| Users |  |  |  |  |  |
| Clients |  |  |  |  |  |
| Projects |  |  |  |  |  |
| Documents |  |  |  |  |  |
| Upload files |  |  |  |  |  |

Record database and upload-set checksums separately. Never put credentials or document contents in the reconciliation record.

After writes are frozen, generate a machine-readable source or destination inventory with:

```bash
MIGRATION_INVENTORY_ACK=writes-frozen npm --prefix backend run inventory:create -- /protected/evidence/source-inventory.json
```

The command refuses to overwrite evidence, records every database-table count, hashes the SQLite database, and records upload paths, sizes, and SHA-256 checksums without copying document contents into the report. Run it once for the approved source and once for production, then compare the reports and explain every intended difference.

Before either environment resumes writes, perform a fail-closed exact reconciliation:

```bash
MIGRATION_RECONCILIATION_ACK=source-and-destination-writes-frozen npm --prefix backend run inventory:compare -- /protected/evidence/source-inventory.json /protected/evidence/production-inventory.json /protected/evidence/inventory-comparison.json
```

The comparison refuses to overwrite evidence and fails if the SQLite file hash/size, any table count, or any upload path/size/hash differs. An exact comparison proves the approved frozen copy arrived unchanged; it does not approve the business meaning of the records. Record rejected or ambiguous source records, their disposition, owner, and approval separately in the reconciliation table before creating the approved source copy.
