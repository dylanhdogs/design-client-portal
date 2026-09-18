# Workflow Foundation Migration Runbook

## Apply and validate

1. Back up the SQLite database and upload directory.
2. Run `npm run db:deploy` from `backend/`.
3. Run `npm run db:backfill` again; the backfill is idempotent.
4. Verify each project has five lifecycle stages, four project gates, and one converted inquiry.
5. Keep `workflowEnabled` false until API and UI acceptance tests pass.

## Rollback

The migration is additive and does not delete or rewrite legacy clients, projects, phases, or checklist items. Application rollback therefore consists of disabling the workflow feature and deploying the previous application version. Retain the new tables during rollback so workflow history is not destroyed. If a database-level rollback is required, restore the pre-migration backup; do not manually drop workflow tables from a production database.

## Count checks

- `lifecycle_stages` must contain exactly five rows per migrated project.
- `project_gates` must contain exactly four rows per migrated project.
- Every legacy project must have a converted inquiry.
- A property is expected when the legacy client has a non-empty address.
- Existing phase and checklist counts must be unchanged before and after the migration.
