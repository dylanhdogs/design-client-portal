#!/usr/bin/env bash
set -Eeuo pipefail

ENVIRONMENT_FILE=/etc/signature-portal/production.env
# shellcheck disable=SC1090
source "$ENVIRONMENT_FILE"

: "${BACKUP_DIR:?BACKUP_DIR is required}"
: "${RCLONE_BACKUP_REMOTE:?RCLONE_BACKUP_REMOTE is required, for example provider:signature-portal-production}"
: "${RCLONE_CONFIG:?RCLONE_CONFIG is required}"
: "${BACKUP_RETENTION_DAYS:?BACKUP_RETENTION_DAYS is required}"

if [[ "$BACKUP_DIR" != /* ]] || [[ "$RCLONE_CONFIG" != /* ]] || [[ ! "$RCLONE_BACKUP_REMOTE" =~ ^[A-Za-z0-9._-]+:[A-Za-z0-9._/-]+$ ]] || [[ "$RCLONE_BACKUP_REMOTE" == *..* ]]; then
  echo "Backup paths must be absolute locally and the remote must name a non-root, traversal-free rclone path." >&2
  exit 1
fi
if [[ ! "$BACKUP_RETENTION_DAYS" =~ ^[1-9][0-9]*$ ]] || (( BACKUP_RETENTION_DAYS > 3650 )); then
  echo "BACKUP_RETENTION_DAYS must be an integer from 1 to 3650." >&2
  exit 1
fi

/usr/bin/rclone --config "$RCLONE_CONFIG" copy \
  --immutable \
  --include 'portal-*.backup.json' \
  "$BACKUP_DIR" \
  "$RCLONE_BACKUP_REMOTE"

/usr/bin/rclone --config "$RCLONE_CONFIG" lsf "$RCLONE_BACKUP_REMOTE" --include 'portal-*.backup.json' | grep -q '^portal-'
/usr/bin/rclone --config "$RCLONE_CONFIG" delete \
  --include 'portal-*.backup.json' \
  --min-age "${BACKUP_RETENTION_DAYS}d" \
  "$RCLONE_BACKUP_REMOTE"
echo "Encrypted backups mirrored, remote presence verified, and approved remote retention applied."
