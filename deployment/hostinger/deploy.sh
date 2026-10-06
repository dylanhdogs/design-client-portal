#!/usr/bin/env bash
set -Eeuo pipefail

SOURCE_DIRECTORY="${1:?Usage: deploy.sh /absolute/source/directory release-id production|staging}"
RELEASE_ID="${2:?Usage: deploy.sh /absolute/source/directory release-id production|staging}"
ENVIRONMENT="${3:?Usage: deploy.sh /absolute/source/directory release-id production|staging}"
if [[ "$ENVIRONMENT" != production && "$ENVIRONMENT" != staging ]]; then
  echo "Environment must be production or staging." >&2
  exit 1
fi
if [[ "${EUID}" -ne 0 ]]; then echo "Run deploy.sh as root through the approved sudo procedure." >&2; exit 1; fi
APP_ROOT="/opt/signature-portal-$ENVIRONMENT"
PERSISTENT_ROOT="/srv/signature-portal-$ENVIRONMENT"
RELEASE_DIRECTORY="$APP_ROOT/releases/$RELEASE_ID"
CURRENT_LINK="$APP_ROOT/current"
PREVIOUS_LINK="$APP_ROOT/previous"
ENVIRONMENT_FILE="/etc/signature-portal/$ENVIRONMENT.env"
SERVICE_NAME="signature-portal@$ENVIRONMENT.service"
HEALTH_PORT=4000
if [[ "$ENVIRONMENT" == staging ]]; then HEALTH_PORT=4001; fi
exec 9>"/run/lock/signature-portal-$ENVIRONMENT-deploy.lock"
if ! flock -n 9; then echo "Another deployment or consistent backup is active for $ENVIRONMENT." >&2; exit 1; fi

if [[ "$SOURCE_DIRECTORY" != /* ]] || [[ ! -f "$SOURCE_DIRECTORY/package.json" ]]; then
  echo "Source directory must be absolute and contain package.json." >&2
  exit 1
fi
if [[ ! "$RELEASE_ID" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "Release id contains unsupported characters." >&2
  exit 1
fi
if [[ -e "$RELEASE_DIRECTORY" ]]; then
  echo "Release already exists: $RELEASE_DIRECTORY" >&2
  exit 1
fi

VERIFICATION_FILE="$PERSISTENT_ROOT/evidence/releases/$RELEASE_ID/release-verification.json"
if [[ ! -r "$VERIFICATION_FILE" ]]; then
  echo "Missing release verification evidence: $VERIFICATION_FILE" >&2
  exit 1
fi
EXPECTED_NODE="v$(tr -d '[:space:]' <"$SOURCE_DIRECTORY/.nvmrc")"
if ! git -C "$SOURCE_DIRECTORY" rev-parse --is-inside-work-tree >/dev/null 2>&1 || [[ -n "$(git -C "$SOURCE_DIRECTORY" status --porcelain)" ]]; then
  echo "Deployment source must be a clean protected Git checkout." >&2
  exit 1
fi
SOURCE_COMMIT="$(git -C "$SOURCE_DIRECTORY" rev-parse HEAD)"
SOURCE_SHA256="$(tar --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner \
  --exclude='.git' --exclude='node_modules' --exclude='*/node_modules' --exclude='backend/dist' --exclude='frontend/dist' \
  --exclude='.env' --exclude='*/.env' --exclude='*.db' --exclude='*.db-*' --exclude='backend/uploads' --exclude='backend/backups' \
  -C "$SOURCE_DIRECTORY" -cf - . | sha256sum | cut -d' ' -f1)"
ROOT_LOCK_SHA256="$(sha256sum "$SOURCE_DIRECTORY/package-lock.json" | cut -d' ' -f1)"
BACKEND_LOCK_SHA256="$(sha256sum "$SOURCE_DIRECTORY/backend/package-lock.json" | cut -d' ' -f1)"
FRONTEND_LOCK_SHA256="$(sha256sum "$SOURCE_DIRECTORY/frontend/package-lock.json" | cut -d' ' -f1)"
if ! jq -e \
  --arg releaseId "$RELEASE_ID" \
  --arg node "$EXPECTED_NODE" \
  --arg commit "$SOURCE_COMMIT" \
  --arg sourceSha256 "$SOURCE_SHA256" \
  --arg root "$ROOT_LOCK_SHA256" \
  --arg backend "$BACKEND_LOCK_SHA256" \
  --arg frontend "$FRONTEND_LOCK_SHA256" \
  '.passed == true and .releaseId == $releaseId and .node == $node and .commit == $commit and .sourceSha256 == $sourceSha256 and .lockfiles.root == $root and .lockfiles.backend == $backend and .lockfiles.frontend == $frontend' \
  "$VERIFICATION_FILE" >/dev/null; then
  echo "Release evidence does not match the requested release, runtime, or source lockfiles." >&2
  exit 1
fi

install -d -o portal -g portal -m 0750 "$APP_ROOT/releases"
install -d -o portal -g portal -m 0750 "$RELEASE_DIRECTORY"
rsync -a --delete --exclude node_modules --exclude .env --exclude '*.db*' --exclude backend/uploads/ "$SOURCE_DIRECTORY/" "$RELEASE_DIRECTORY/"
chown -R portal:portal "$RELEASE_DIRECTORY"

runuser -u portal -- npm --prefix "$RELEASE_DIRECTORY" ci
runuser -u portal -- npm --prefix "$RELEASE_DIRECTORY/backend" ci
runuser -u portal -- npm --prefix "$RELEASE_DIRECTORY/frontend" ci
runuser -u portal -- npm --prefix "$RELEASE_DIRECTORY/backend" run build
runuser -u portal -- npm --prefix "$RELEASE_DIRECTORY/frontend" run build

run_as_portal_with_environment() {
  local package_directory="$1"
  local npm_script="$2"
  runuser -u portal -- bash -c \
    'set -a; source "$1"; set +a; RELEASE_ID="$4" npm --prefix "$2" run "$3"' \
    _ "$ENVIRONMENT_FILE" "$package_directory" "$npm_script" "$RELEASE_ID"
}

run_as_portal_with_environment "$RELEASE_DIRECTORY/backend" preflight
ORIGINAL_TARGET=""
if [[ -L "$CURRENT_LINK" ]]; then
  ORIGINAL_TARGET="$(readlink -f "$CURRENT_LINK")"
  if [[ "$ORIGINAL_TARGET" != "$APP_ROOT/releases/"* ]]; then echo "Current release link points outside the release root." >&2; exit 1; fi
fi
systemctl stop "$SERVICE_NAME"

cleanup_on_error() {
  systemctl stop "$SERVICE_NAME" || true
  if [[ "${MIGRATIONS_STARTED:-false}" == false ]]; then
    if [[ -n "$ORIGINAL_TARGET" ]]; then
      ln -sfn "$ORIGINAL_TARGET" "$CURRENT_LINK"
      systemctl start "$SERVICE_NAME" || true
    else
      echo "Initial deployment failed before migration; no prior release exists to restart." >&2
    fi
  else
    echo "Deployment stopped after migration began. No automatic application or database rollback was attempted; follow the incident runbook." >&2
  fi
}
trap cleanup_on_error ERR

run_as_portal_with_environment "$RELEASE_DIRECTORY/backend" backup:create
MIGRATIONS_STARTED=true
run_as_portal_with_environment "$RELEASE_DIRECTORY/backend" db:deploy
run_as_portal_with_environment "$RELEASE_DIRECTORY/backend" manifest:create

if [[ -n "$ORIGINAL_TARGET" ]]; then
  ln -sfn "$ORIGINAL_TARGET" "$PREVIOUS_LINK"
fi
ln -sfn "$RELEASE_DIRECTORY" "$CURRENT_LINK"
systemctl start "$SERVICE_NAME"

for _ in {1..30}; do
  if curl --fail --silent "http://127.0.0.1:$HEALTH_PORT/api/health/ready" >/dev/null; then
    trap - ERR
    echo "Deployment succeeded: $RELEASE_ID"
    exit 0
  fi
  sleep 1
done

echo "Deployment health check failed." >&2
exit 1
