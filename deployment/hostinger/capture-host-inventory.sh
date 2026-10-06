#!/usr/bin/env bash
set -Eeuo pipefail

ENVIRONMENT="${1:?Usage: capture-host-inventory.sh production|staging /absolute/output.json}"
OUTPUT_PATH="${2:?Usage: capture-host-inventory.sh production|staging /absolute/output.json}"
if [[ "$ENVIRONMENT" != production && "$ENVIRONMENT" != staging ]]; then echo "Environment must be production or staging." >&2; exit 1; fi
if [[ "$OUTPUT_PATH" != /* ]] || [[ "$(basename "$OUTPUT_PATH")" == .* ]]; then echo "Output must be an absolute, visible JSON file path." >&2; exit 1; fi
if [[ -e "$OUTPUT_PATH" ]]; then echo "Refusing to overwrite existing inventory: $OUTPUT_PATH" >&2; exit 1; fi

SERVICE_NAME="signature-portal@$ENVIRONMENT.service"
PERSISTENT_ROOT="/srv/signature-portal-$ENVIRONMENT"
RELEASE_ROOT="/opt/signature-portal-$ENVIRONMENT"
ENVIRONMENT_FILE="/etc/signature-portal/$ENVIRONMENT.env"
install -d -o root -g root -m 0750 "$(dirname "$OUTPUT_PATH")"

jq -n \
  --arg capturedAt "$(date --utc +%FT%TZ)" \
  --arg environment "$ENVIRONMENT" \
  --arg hostname "$(hostname)" \
  --arg os "$(. /etc/os-release; printf '%s %s' "$NAME" "$VERSION_ID")" \
  --arg kernel "$(uname -r)" \
  --arg architecture "$(uname -m)" \
  --arg node "$(node --version)" \
  --arg npm "$(npm --version)" \
  --arg nginx "$(nginx -v 2>&1)" \
  --arg serviceState "$(systemctl is-active "$SERVICE_NAME" 2>/dev/null || true)" \
  --arg serviceEnabled "$(systemctl is-enabled "$SERVICE_NAME" 2>/dev/null || true)" \
  --arg currentRelease "$(readlink -f "$RELEASE_ROOT/current" 2>/dev/null || true)" \
  --arg persistentPermissions "$(stat -c '%U:%G:%a' "$PERSISTENT_ROOT" 2>/dev/null || true)" \
  --arg environmentPermissions "$(stat -c '%U:%G:%a' "$ENVIRONMENT_FILE" 2>/dev/null || true)" \
  --arg firewall "$(ufw status | head -1)" \
  --arg timeSynchronized "$(timedatectl show -p NTPSynchronized --value)" \
  --arg disk "$(df -h --output=size,used,avail,pcent "$PERSISTENT_ROOT" | tail -1 | xargs)" \
  '{capturedAt:$capturedAt,environment:$environment,host:{hostname:$hostname,os:$os,kernel:$kernel,architecture:$architecture},runtime:{node:$node,npm:$npm,nginx:$nginx},application:{serviceState:$serviceState,serviceEnabled:$serviceEnabled,currentRelease:$currentRelease},controls:{persistentPermissions:$persistentPermissions,environmentPermissions:$environmentPermissions,firewall:$firewall,timeSynchronized:$timeSynchronized,disk:$disk}}' \
  >"$OUTPUT_PATH"
chmod 0640 "$OUTPUT_PATH"

echo "Sanitized host inventory created at $OUTPUT_PATH. It contains configuration metadata but no environment values or secrets."
