#!/usr/bin/env bash
set -Eeuo pipefail

SOURCE_DIRECTORY="${1:?Usage: verify-release-candidate.sh /absolute/source /absolute/evidence-directory release-id}"
EVIDENCE_DIRECTORY="${2:?Usage: verify-release-candidate.sh /absolute/source /absolute/evidence-directory release-id}"
RELEASE_ID="${3:?Usage: verify-release-candidate.sh /absolute/source /absolute/evidence-directory release-id}"
if [[ "$SOURCE_DIRECTORY" != /* || ! -f "$SOURCE_DIRECTORY/package.json" ]]; then echo "Source must be an absolute project directory." >&2; exit 1; fi
if [[ "$EVIDENCE_DIRECTORY" != /* || -e "$EVIDENCE_DIRECTORY" ]]; then echo "Evidence directory must be an absolute path that does not exist." >&2; exit 1; fi
if [[ ! "$RELEASE_ID" =~ ^[A-Za-z0-9._-]+$ ]]; then echo "Invalid release id." >&2; exit 1; fi
if ! git -C "$SOURCE_DIRECTORY" rev-parse --is-inside-work-tree >/dev/null 2>&1; then echo "Release verification requires a protected Git checkout." >&2; exit 1; fi
if [[ -n "$(git -C "$SOURCE_DIRECTORY" status --porcelain)" ]]; then echo "Release verification requires a clean Git worktree." >&2; exit 1; fi
verified_commit="$(git -C "$SOURCE_DIRECTORY" rev-parse HEAD)"

expected_node="$(tr -d '[:space:]' <"$SOURCE_DIRECTORY/.nvmrc")"
if [[ "$(node --version)" != "v$expected_node" ]]; then echo "Release verification requires Node v$expected_node; found $(node --version)." >&2; exit 1; fi

temporary_directory="$(mktemp -d)"
trap 'rm -rf -- "$temporary_directory"' EXIT
install -d -m 0750 "$EVIDENCE_DIRECTORY"
export NODE_ENV=test
export DATABASE_URL="file:$temporary_directory/release-evidence.db"
export JWT_SECRET="$(openssl rand -hex 32)"

run_check() {
  local name="$1"
  shift
  echo "Running $name..."
  if "$@" >"$EVIDENCE_DIRECTORY/$name.log" 2>&1; then return 0; fi
  echo "Release check failed: $name. See $EVIDENCE_DIRECTORY/$name.log" >&2
  exit 1
}

run_check shell-syntax bash -c '
  set -Eeuo pipefail
  while IFS= read -r -d "" script; do bash -n "$script"; done < <(find "$1/deployment/hostinger" -type f -name "*.sh" -print0)
' _ "$SOURCE_DIRECTORY"
run_check root-install npm --prefix "$SOURCE_DIRECTORY" ci
run_check backend-install npm --prefix "$SOURCE_DIRECTORY/backend" ci
run_check frontend-install npm --prefix "$SOURCE_DIRECTORY/frontend" ci
run_check fresh-migration npm --prefix "$SOURCE_DIRECTORY/backend" exec -- prisma migrate deploy --schema "$SOURCE_DIRECTORY/backend/prisma/schema.prisma"
run_check prisma-generate npm --prefix "$SOURCE_DIRECTORY/backend" exec -- prisma generate --schema "$SOURCE_DIRECTORY/backend/prisma/schema.prisma"
run_check demo-seed npm --prefix "$SOURCE_DIRECTORY/backend" run db:seed
run_check workflow-backfill npm --prefix "$SOURCE_DIRECTORY/backend" run db:backfill
run_check backend-tests npm --prefix "$SOURCE_DIRECTORY/backend" test
run_check backend-build npm --prefix "$SOURCE_DIRECTORY/backend" run build
run_check frontend-build npm --prefix "$SOURCE_DIRECTORY/frontend" run build

run_production_preflight() (
  export NODE_ENV=production
  export REQUIRED_NODE_VERSION="$expected_node"
  export HOST=127.0.0.1
  export PORT=4000
  export APP_INSTANCE_COUNT=1
  export TRUST_PROXY_HOPS=1
  export FRONTEND_URL=https://portal.release-verification.invalid
  export CORS_ORIGINS=https://portal.release-verification.invalid
  export PRIVACY_NOTICE_URL=https://www.release-verification.invalid/privacy
  export SUPPORT_EMAIL=support@release-verification.invalid
  export DATABASE_URL="file:$temporary_directory/production-preflight/data/portal.db?connection_limit=1&socket_timeout=10"
  export UPLOAD_DIR="$temporary_directory/production-preflight/uploads"
  export BACKUP_DIR="$temporary_directory/production-preflight/backups"
  export MANIFEST_DIR="$temporary_directory/production-preflight/manifests"
  export MIN_FREE_STORAGE_BYTES=104857600
  export JWT_SECRET="$(openssl rand -hex 32)"
  export HEALTH_CHECK_TOKEN="$(openssl rand -hex 32)"
  export BACKUP_ENABLED=true
  export BACKUP_SCHEDULER_MODE=external
  export BACKUP_INTERVAL_HOURS=12
  export BACKUP_MAX_AGE_HOURS=14
  export BACKUP_RETENTION_DAYS=30
  export BACKUP_ENCRYPTION_KEY="$(openssl rand -hex 32)"
  export EXTERNAL_NOTIFICATION_MODE=disabled
  npm --prefix "$SOURCE_DIRECTORY/backend" run preflight
)
run_check production-preflight run_production_preflight

run_check performance npm --prefix "$SOURCE_DIRECTORY/backend" run verify:performance
run_check parity npm --prefix "$SOURCE_DIRECTORY/backend" run verify:parity
run_check backend-audit npm --prefix "$SOURCE_DIRECTORY/backend" audit --omit=dev --audit-level=high
run_check frontend-audit npm --prefix "$SOURCE_DIRECTORY/frontend" audit --omit=dev --audit-level=high

if [[ "$(git -C "$SOURCE_DIRECTORY" rev-parse HEAD)" != "$verified_commit" ]]; then echo "Git commit changed during release verification." >&2; exit 1; fi
if [[ -n "$(git -C "$SOURCE_DIRECTORY" status --porcelain)" ]]; then echo "Release checks left the Git worktree dirty; preserve evidence and investigate." >&2; exit 1; fi
source_sha256="$(tar --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner \
  --exclude='.git' --exclude='node_modules' --exclude='*/node_modules' --exclude='backend/dist' --exclude='frontend/dist' \
  --exclude='.env' --exclude='*/.env' --exclude='*.db' --exclude='*.db-*' --exclude='backend/uploads' --exclude='backend/backups' \
  -C "$SOURCE_DIRECTORY" -cf - . | sha256sum | cut -d' ' -f1)"
root_lock_sha256="$(sha256sum "$SOURCE_DIRECTORY/package-lock.json" | cut -d' ' -f1)"
backend_lock_sha256="$(sha256sum "$SOURCE_DIRECTORY/backend/package-lock.json" | cut -d' ' -f1)"
frontend_lock_sha256="$(sha256sum "$SOURCE_DIRECTORY/frontend/package-lock.json" | cut -d' ' -f1)"
node - "$EVIDENCE_DIRECTORY/release-verification.json" "$RELEASE_ID" "$(date --utc +%FT%TZ)" "$(node --version)" "$(npm --version)" \
  "$verified_commit" "$source_sha256" "$root_lock_sha256" "$backend_lock_sha256" "$frontend_lock_sha256" <<'NODE'
const fs = require('node:fs');
const [file, releaseId, verifiedAt, nodeVersion, npmVersion, commit, sourceSha256, rootLockSha256, backendLockSha256, frontendLockSha256] = process.argv.slice(2);
const checks = [
  'shell-syntax', 'root-install', 'backend-install', 'frontend-install', 'fresh-migration', 'prisma-generate', 'demo-seed', 'workflow-backfill',
  'backend-tests', 'backend-build', 'frontend-build', 'production-preflight', 'performance', 'parity', 'backend-audit', 'frontend-audit',
];
const evidence = {
  releaseId,
  verifiedAt,
  node: nodeVersion,
  npm: npmVersion,
  commit,
  sourceSha256,
  lockfiles: { root: rootLockSha256, backend: backendLockSha256, frontend: frontendLockSha256 },
  checks,
  passed: true,
};
fs.writeFileSync(file, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
NODE
chmod -R go-rwx "$EVIDENCE_DIRECTORY"
echo "Release candidate $RELEASE_ID passed. Evidence: $EVIDENCE_DIRECTORY"
