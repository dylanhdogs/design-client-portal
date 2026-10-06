import 'dotenv/config';
import { prisma } from '../src/utils/prisma';

type CountRow = { count: bigint | number };
const count = async (sql: string) => {
  const [row] = await prisma.$queryRawUnsafe<CountRow[]>(sql);
  return Number(row?.count ?? 0);
};

async function run() {
  await prisma.$connect();
  const tables = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('users', 'clients', 'invitations', 'checklist_items', 'project_phases', 'activity_logs')",
  );
  const present = new Set(tables.map((table) => table.name));
  if (!present.has('users')) {
    console.log(JSON.stringify({ level: 'info', event: 'user_management_preflight_skipped', reason: 'database has no application schema yet' }));
    return;
  }

  const requiredTables = ['clients', 'invitations', 'checklist_items', 'project_phases', 'activity_logs'];
  const missingTables = requiredTables.filter((table) => !present.has(table));
  if (missingTables.length) throw new Error(`Existing database schema is incomplete; missing tables: ${missingTables.join(', ')}.`);

  // Read-only checks run before the user-management migration. Never repair or
  // merge legacy identities automatically; operators must resolve blockers.
  const [invalidRoles, duplicateClientAccounts, invalidClientLinks, duplicatePendingInvitations, pendingInvitationAccountConflicts, invalidChecklistCompleters, completedPhasesWithoutDate, auditRows, activityRowsWithResolvableActor] = await Promise.all([
    count("SELECT COUNT(*) AS count FROM users WHERE role NOT IN ('ADMIN', 'CLIENT')"),
    count('SELECT COUNT(*) AS count FROM (SELECT client_id FROM users WHERE client_id IS NOT NULL GROUP BY client_id HAVING COUNT(*) > 1)'),
    count("SELECT COUNT(*) AS count FROM users u LEFT JOIN clients c ON c.id = u.client_id WHERE (u.role = 'ADMIN' AND u.client_id IS NOT NULL) OR (u.role = 'CLIENT' AND (u.client_id IS NULL OR c.id IS NULL OR c.deleted_at IS NOT NULL))"),
    count("SELECT COUNT(*) AS count FROM (SELECT lower(email) FROM invitations WHERE status = 'PENDING' AND expires_at > CURRENT_TIMESTAMP GROUP BY lower(email) HAVING COUNT(*) > 1)"),
    count("SELECT COUNT(*) AS count FROM invitations i JOIN users u ON lower(u.email) = lower(i.email) WHERE i.status = 'PENDING' AND i.expires_at > CURRENT_TIMESTAMP AND u.active = 1"),
    count('SELECT COUNT(*) AS count FROM checklist_items ci LEFT JOIN users u ON u.id = ci.completed_by WHERE ci.completed_by IS NOT NULL AND u.id IS NULL'),
    count("SELECT COUNT(*) AS count FROM project_phases WHERE status = 'COMPLETED' AND completed_date IS NULL"),
    count('SELECT COUNT(*) AS count FROM activity_logs'),
    count('SELECT COUNT(*) AS count FROM activity_logs a JOIN users u ON u.id = a.user_id'),
  ]);

  const blockers = {
    invalidRoles,
    duplicateClientAccounts,
    invalidClientLinks,
    duplicatePendingInvitations,
    pendingInvitationAccountConflicts,
    invalidChecklistCompleters,
  };
  const blocked = Object.values(blockers).some((value) => value > 0);
  const report = {
    level: blocked ? 'error' : 'info',
    event: blocked ? 'user_management_preflight_blocked' : 'user_management_preflight_passed',
    blockers,
    warnings: { completedPhasesWithoutDate },
    preservedData: { activityRows: auditRows, activityRowsWithResolvableActor },
  };
  console.log(JSON.stringify(report));
  if (blocked) process.exitCode = 1;
}

run()
  .catch((error) => {
    console.error(JSON.stringify({ level: 'error', event: 'user_management_preflight_failed', message: String(error?.message || error) }));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
