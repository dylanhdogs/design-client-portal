#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then echo "Run monitor-production.sh as root through its systemd service or approved sudo procedure." >&2; exit 1; fi

MODE="${1:-monitor}"
if [[ "$MODE" != monitor && "$MODE" != test-alert ]]; then echo "Usage: monitor-production.sh [test-alert]" >&2; exit 1; fi

ENVIRONMENT_FILE=/etc/signature-portal/production.env
# shellcheck disable=SC1090
source "$ENVIRONMENT_FILE"

if ! flock -n /run/lock/signature-portal-production-deploy.lock true; then
  echo "Production maintenance is active; health alert evaluation is deferred."
  exit 0
fi

: "${ALERT_WEBHOOK_URL:?ALERT_WEBHOOK_URL is required for production monitoring.}"
: "${APP_DOMAIN:?APP_DOMAIN is required for certificate monitoring.}"
if [[ ! "$ALERT_WEBHOOK_URL" =~ ^https://[^[:space:]]+$ ]]; then echo "ALERT_WEBHOOK_URL must be an HTTPS URL without whitespace." >&2; exit 1; fi
if [[ ! "$APP_DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]]; then echo "APP_DOMAIN must be a DNS hostname." >&2; exit 1; fi
temporary_directory="$(mktemp -d)"
trap 'rm -rf -- "$temporary_directory"' EXIT
umask 077
webhook_config="$temporary_directory/webhook.conf"
escaped_webhook_url="$(printf '%s' "$ALERT_WEBHOOK_URL" | sed 's/\\/\\\\/g; s/"/\\"/g')"
printf 'url = "%s"\n' "$escaped_webhook_url" >"$webhook_config"
unset ALERT_WEBHOOK_URL escaped_webhook_url
CPU_LOAD_PER_CORE_LIMIT="${CPU_LOAD_PER_CORE_LIMIT:-2.0}"
MEMORY_USED_PERCENT_LIMIT="${MEMORY_USED_PERCENT_LIMIT:-90}"
BACKUP_MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-26}"
CERTIFICATE_MIN_DAYS="${CERTIFICATE_MIN_DAYS:-14}"
ALERT_REPEAT_MINUTES="${ALERT_REPEAT_MINUTES:-60}"
ALERT_STATE_FILE=/srv/signature-portal-production/data/.monitor-alert-state
if [[ ! "$ALERT_REPEAT_MINUTES" =~ ^[1-9][0-9]*$ ]] || (( ALERT_REPEAT_MINUTES > 1440 )); then echo "ALERT_REPEAT_MINUTES must be an integer from 1 to 1440." >&2; exit 1; fi
if [[ ! "$PORT" =~ ^[0-9]+$ ]] || (( PORT < 1 || PORT > 65535 )); then echo "PORT must be an integer from 1 to 65535." >&2; exit 1; fi
if [[ ! "$CPU_LOAD_PER_CORE_LIMIT" =~ ^[0-9]+([.][0-9]+)?$ ]] || ! awk -v value="$CPU_LOAD_PER_CORE_LIMIT" 'BEGIN { exit !(value > 0) }'; then echo "CPU_LOAD_PER_CORE_LIMIT must be a positive number." >&2; exit 1; fi
if [[ ! "$MEMORY_USED_PERCENT_LIMIT" =~ ^[1-9][0-9]*$ ]] || (( MEMORY_USED_PERCENT_LIMIT > 100 )); then echo "MEMORY_USED_PERCENT_LIMIT must be an integer from 1 to 100." >&2; exit 1; fi
if [[ ! "$BACKUP_MAX_AGE_HOURS" =~ ^[1-9][0-9]*$ ]] || (( BACKUP_MAX_AGE_HOURS > 168 )); then echo "BACKUP_MAX_AGE_HOURS must be an integer from 1 to 168." >&2; exit 1; fi
if [[ ! "$CERTIFICATE_MIN_DAYS" =~ ^[1-9][0-9]*$ ]] || (( CERTIFICATE_MIN_DAYS > 365 )); then echo "CERTIFICATE_MIN_DAYS must be an integer from 1 to 365." >&2; exit 1; fi
if [[ ! "$MIN_FREE_STORAGE_BYTES" =~ ^[1-9][0-9]*$ ]] || (( MIN_FREE_STORAGE_BYTES < 104857600 )); then echo "MIN_FREE_STORAGE_BYTES must be an integer of at least 104857600." >&2; exit 1; fi
if [[ "$UPLOAD_DIR" != /* || "$BACKUP_DIR" != /* ]]; then echo "UPLOAD_DIR and BACKUP_DIR must be absolute paths." >&2; exit 1; fi

failures=()
if [[ "$MODE" == test-alert ]]; then failures+=("synthetic operator-requested alert delivery test"); fi
if ! systemctl is-active --quiet signature-portal@production.service; then failures+=("application service is not active"); fi
if ! curl --fail --silent --max-time 15 "http://127.0.0.1:${PORT:-4000}/api/health/ready" >/dev/null; then failures+=("readiness endpoint failed"); fi

read -r load_one _ </proc/loadavg
cores="$(nproc)"
if awk -v load="$load_one" -v cores="$cores" -v limit="$CPU_LOAD_PER_CORE_LIMIT" 'BEGIN { exit !((load / cores) > limit) }'; then failures+=("one-minute CPU load exceeded threshold"); fi
memory_used_percent="$(free | awk '/^Mem:/ { printf "%.0f", (($2-$7)/$2)*100 }')"
if (( memory_used_percent > MEMORY_USED_PERCENT_LIMIT )); then failures+=("memory use exceeded ${MEMORY_USED_PERCENT_LIMIT}%"); fi

available_bytes="$(df --output=avail -B1 "$UPLOAD_DIR" | tail -1 | tr -d ' ')"
if (( available_bytes < MIN_FREE_STORAGE_BYTES )); then failures+=("storage is below configured free-space threshold"); fi

latest_backup="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'portal-*.backup.json' -printf '%T@ %p\n' | sort -nr | head -1 || true)"
if [[ -z "$latest_backup" ]]; then
  failures+=("no encrypted application backup exists")
else
  latest_epoch="${latest_backup%% *}"
  backup_age_hours="$(awk -v now="$(date +%s)" -v then="$latest_epoch" 'BEGIN { printf "%.2f", (now-then)/3600 }')"
  if awk -v age="$backup_age_hours" -v limit="$BACKUP_MAX_AGE_HOURS" 'BEGIN { exit !(age > limit) }'; then failures+=("latest encrypted backup is stale"); fi
fi

if ! openssl x509 -checkend "$((CERTIFICATE_MIN_DAYS * 86400))" -noout -in "/etc/letsencrypt/live/$APP_DOMAIN/fullchain.pem" >/dev/null 2>&1; then failures+=("TLS certificate expires within ${CERTIFICATE_MIN_DAYS} days or is unreadable"); fi
if systemctl is-failed --quiet signature-portal-consistent-backup.service; then failures+=("consistent production backup failed"); fi
if systemctl is-failed --quiet signature-portal-backup-mirror.service; then failures+=("off-server backup mirror failed"); fi

if operations_json="$(runuser -u portal -- bash -c 'set -a; source "$1"; set +a; HOME=/tmp npm --silent --prefix /opt/signature-portal-production/current/backend run operations:status' _ "$ENVIRONMENT_FILE" 2>/dev/null)"; then
  open_alert_count="$(jq -r '.total // 0' <<<"$operations_json")"
  if (( open_alert_count > 0 )); then failures+=("$open_alert_count application operational alert(s) await acknowledgement"); fi
else
  failures+=("application operational-alert query failed")
fi

if (( ${#failures[@]} == 0 )); then
  rm -f -- "$ALERT_STATE_FILE"
  echo "Production monitor passed."
  exit 0
fi

message="Signature Portal production alert on $(hostname): $(IFS='; '; echo "${failures[*]}")"
failure_hash="$(printf '%s' "$message" | sha256sum | cut -d' ' -f1)"
if [[ "$MODE" == monitor && -f "$ALERT_STATE_FILE" ]]; then
  previous_hash=""
  previous_epoch=""
  read -r previous_hash previous_epoch <"$ALERT_STATE_FILE" || true
  if [[ "$previous_hash" == "$failure_hash" && "$previous_epoch" =~ ^[0-9]+$ && $(( $(date +%s) - previous_epoch )) -lt $(( ALERT_REPEAT_MINUTES * 60 )) ]]; then
    echo "$message (duplicate webhook suppressed until repeat interval)." >&2
    exit 1
  fi
fi
payload="$(jq -n --arg text "$message" --arg severity critical --arg service signature-portal '{text:$text,severity:$severity,service:$service}')"
printf '%s' "$payload" >"$temporary_directory/payload.json"
unset payload
curl --fail --silent --show-error --max-time 15 --config "$webhook_config" --header 'Content-Type: application/json' --data-binary "@$temporary_directory/payload.json" >/dev/null
if [[ "$MODE" == monitor ]]; then
  state_temporary="$ALERT_STATE_FILE.tmp.$$"
  printf '%s %s\n' "$failure_hash" "$(date +%s)" >"$state_temporary"
  chmod 0600 "$state_temporary"
  mv -f -- "$state_temporary" "$ALERT_STATE_FILE"
fi
echo "$message" >&2
exit 1
