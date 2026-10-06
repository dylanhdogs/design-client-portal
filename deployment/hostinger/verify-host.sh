#!/usr/bin/env bash
set -Eeuo pipefail

failures=0
ENVIRONMENT="${1:?Usage: verify-host.sh production|staging}"
if [[ "$ENVIRONMENT" != production && "$ENVIRONMENT" != staging ]]; then echo "Environment must be production or staging." >&2; exit 1; fi
SERVICE_NAME="signature-portal@$ENVIRONMENT.service"
PERSISTENT_ROOT="/srv/signature-portal-$ENVIRONMENT"
ENVIRONMENT_FILE="/etc/signature-portal/$ENVIRONMENT.env"
# shellcheck disable=SC1090
source "$ENVIRONMENT_FILE"
check() {
  local description="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    printf 'PASS  %s\n' "$description"
  else
    printf 'FAIL  %s\n' "$description" >&2
    failures=$((failures + 1))
  fi
}

check "Ubuntu host" grep -qi '^ID=ubuntu' /etc/os-release
check "exact reviewed Node.js runtime" bash -c "[[ \"\$(node --version)\" == v'$REQUIRED_NODE_VERSION' ]]"
check "portal service account" id portal
check "application does not run as root" bash -c "[[ \"\$(systemctl show -p User --value '$SERVICE_NAME')\" == portal ]]"
check "environment file protected" bash -c "[[ \"\$(stat -c %U:%G:%a '$ENVIRONMENT_FILE')\" == root:portal:640 ]]"
check "database directory writable by portal" runuser -u portal -- test -w "$PERSISTENT_ROOT/data"
check "upload directory writable by portal" runuser -u portal -- test -w "$PERSISTENT_ROOT/uploads"
check "backup directory writable by portal" runuser -u portal -- test -w "$PERSISTENT_ROOT/backups"
check "manifest directory writable by portal" runuser -u portal -- test -w "$PERSISTENT_ROOT/manifests"
check "Nginx configuration valid" nginx -t
check "portal access-log rotation valid" logrotate --debug /etc/logrotate.d/signature-portal
check "host firewall active" bash -c 'ufw status | grep -q "Status: active"'
check "time synchronized" bash -c '[[ "$(timedatectl show -p NTPSynchronized --value)" == yes ]]'
check "fail2ban active" systemctl is-active fail2ban
check "fail2ban SSH jail active" fail2ban-client status sshd
check "automatic updates active" systemctl is-active unattended-upgrades
check "SSH password authentication disabled" bash -c "/usr/sbin/sshd -T | grep -qx 'passwordauthentication no'"
check "root password login disabled" bash -c "/usr/sbin/sshd -T | grep -Eq '^permitrootlogin (prohibit-password|without-password|no)$'"
check "application enabled" systemctl is-enabled "$SERVICE_NAME"
check "application active" systemctl is-active "$SERVICE_NAME"
if [[ "$ENVIRONMENT" == production ]]; then
  check "consistent backup timer enabled" systemctl is-enabled signature-portal-consistent-backup.timer
  check "consistent backup timer active" systemctl is-active signature-portal-consistent-backup.timer
  check "backup mirror timer enabled" systemctl is-enabled signature-portal-backup-mirror.timer
  check "backup mirror timer active" systemctl is-active signature-portal-backup-mirror.timer
  check "production monitor timer enabled" systemctl is-enabled signature-portal-monitor.timer
  check "production monitor timer active" systemctl is-active signature-portal-monitor.timer
fi
check "local readiness" curl --fail --silent --show-error "http://127.0.0.1:$PORT/api/health/ready"

if (( failures > 0 )); then
  echo "$failures host verification check(s) failed." >&2
  exit 1
fi
echo "All host verification checks passed. Hostinger-managed firewall, DNS, TLS, monitoring delivery, and off-server backup presence still require hPanel/provider evidence."
