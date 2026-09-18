#!/usr/bin/env bash
set -Eeuo pipefail

ENVIRONMENT="${1:?Usage: rollback.sh production|staging}"
if [[ "$ENVIRONMENT" != production && "$ENVIRONMENT" != staging ]]; then echo "Environment must be production or staging." >&2; exit 1; fi
if [[ "${EUID}" -ne 0 ]]; then echo "Run rollback.sh as root through the approved sudo procedure." >&2; exit 1; fi
APP_ROOT="/opt/signature-portal-$ENVIRONMENT"
SERVICE_NAME="signature-portal@$ENVIRONMENT.service"
HEALTH_PORT=4000
if [[ "$ENVIRONMENT" == staging ]]; then HEALTH_PORT=4001; fi
CURRENT_LINK="$APP_ROOT/current"
PREVIOUS_LINK="$APP_ROOT/previous"
exec 9>"/run/lock/signature-portal-$ENVIRONMENT-deploy.lock"
if ! flock -n 9; then echo "Another deployment, rollback, or consistent backup is active for $ENVIRONMENT." >&2; exit 1; fi

if [[ ! -L "$CURRENT_LINK" || ! -L "$PREVIOUS_LINK" ]]; then
  echo "Both current and previous release links are required for rollback." >&2
  exit 1
fi

CURRENT_TARGET="$(readlink -f "$CURRENT_LINK")"
PREVIOUS_TARGET="$(readlink -f "$PREVIOUS_LINK")"
if [[ "$CURRENT_TARGET" != "$APP_ROOT/releases/"* || "$PREVIOUS_TARGET" != "$APP_ROOT/releases/"* ]]; then
  echo "Release link points outside the approved release root." >&2
  exit 1
fi
systemctl stop "$SERVICE_NAME"
ln -sfn "$PREVIOUS_TARGET" "$CURRENT_LINK"
ln -sfn "$CURRENT_TARGET" "$PREVIOUS_LINK"
systemctl start "$SERVICE_NAME"

for _ in {1..30}; do
  if curl --fail --silent "http://127.0.0.1:$HEALTH_PORT/api/health/ready" >/dev/null; then
    echo "Application rollback succeeded. Database schema was not reversed."
    exit 0
  fi
  sleep 1
done

systemctl stop "$SERVICE_NAME"
ln -sfn "$CURRENT_TARGET" "$CURRENT_LINK"
ln -sfn "$PREVIOUS_TARGET" "$PREVIOUS_LINK"
systemctl start "$SERVICE_NAME" || true
echo "Rollback candidate failed health checks; original application links were restored. Preserve current data and follow the incident runbook." >&2
exit 1
