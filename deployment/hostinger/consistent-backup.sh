#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then echo "Run consistent-backup.sh as root through its systemd service." >&2; exit 1; fi

ENVIRONMENT_FILE=/etc/signature-portal/production.env
SERVICE_NAME=signature-portal@production.service
exec 9>/run/lock/signature-portal-production-deploy.lock
if ! flock -n 9; then echo "Production deployment is active; consistent backup will retry on the next timer run." >&2; exit 1; fi

# shellcheck disable=SC1090
source "$ENVIRONMENT_FILE"
: "${BACKUP_DIR:?BACKUP_DIR is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"

was_active=false
if systemctl is-active --quiet "$SERVICE_NAME"; then
  was_active=true
  systemctl stop "$SERVICE_NAME"
fi

restart_application() {
  if [[ "$was_active" == true ]]; then systemctl start "$SERVICE_NAME" || true; fi
}
trap restart_application EXIT

runuser -u portal -- bash -c \
  'set -a; source "$1"; set +a; npm --prefix /opt/signature-portal-production/current/backend run backup:create' \
  _ "$ENVIRONMENT_FILE"

if [[ "$was_active" == true ]]; then
  systemctl start "$SERVICE_NAME"
  was_active=false
  for _ in {1..30}; do
    if curl --fail --silent "http://127.0.0.1:${PORT:-4000}/api/health/ready" >/dev/null; then
      echo "Consistent production backup completed and application readiness passed."
      exit 0
    fi
    sleep 1
  done
  echo "Backup completed, but application readiness did not recover." >&2
  exit 1
fi

echo "Consistent production backup completed while the application remained stopped."
