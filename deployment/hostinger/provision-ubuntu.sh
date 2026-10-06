#!/usr/bin/env bash
set -Eeuo pipefail

ADMIN_SSH_CIDR="${ADMIN_SSH_CIDR:?Set ADMIN_SSH_CIDR to a trusted administrator IPv4/IPv6 CIDR before running.}"
CONFIG_ROOT=/etc/signature-portal
SCRIPT_DIRECTORY="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PINNED_NODE_VERSION="$(tr -d '[:space:]' <"$SCRIPT_DIRECTORY/../../.nvmrc")"
NODE_VERSION="${NODE_VERSION:-$PINNED_NODE_VERSION}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script as root on the intended Hostinger Ubuntu VPS." >&2
  exit 1
fi
if [[ ! -r /etc/os-release ]] || ! grep -qi '^ID=ubuntu' /etc/os-release; then
  echo "This provisioning script supports Ubuntu only." >&2
  exit 1
fi
if [[ ! "$NODE_VERSION" =~ ^22\.[0-9]+\.[0-9]+$ ]]; then
  echo "NODE_VERSION must be an exact Node.js 22 release." >&2
  exit 1
fi
if [[ "$NODE_VERSION" != "$PINNED_NODE_VERSION" ]]; then
  echo "NODE_VERSION must match the reviewed .nvmrc value $PINNED_NODE_VERSION." >&2
  exit 1
fi
if [[ ! "$ADMIN_SSH_CIDR" =~ ^[0-9A-Fa-f:.]+/[0-9]{1,3}$ ]]; then
  echo "ADMIN_SSH_CIDR must be a CIDR, not 'anywhere'." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends ca-certificates curl xz-utils nginx certbot python3-certbot-nginx rsync git rclone jq apache2-utils ufw fail2ban unattended-upgrades logrotate

case "$(dpkg --print-architecture)" in
  amd64) node_arch=x64 ;;
  arm64) node_arch=arm64 ;;
  *) echo "Unsupported architecture: $(dpkg --print-architecture)" >&2; exit 1 ;;
esac
node_archive="node-v${NODE_VERSION}-linux-${node_arch}.tar.xz"
temporary_directory="$(mktemp -d)"
trap 'rm -rf -- "$temporary_directory"' EXIT
curl --fail --show-error --location --proto '=https' --tlsv1.2 "https://nodejs.org/dist/v${NODE_VERSION}/${node_archive}" --output "$temporary_directory/$node_archive"
curl --fail --show-error --location --proto '=https' --tlsv1.2 "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt" --output "$temporary_directory/SHASUMS256.txt"
(cd "$temporary_directory" && grep "  ${node_archive}$" SHASUMS256.txt | sha256sum --check --strict)
install -d -o root -g root -m 0755 "/opt/node-v${NODE_VERSION}"
tar -xJf "$temporary_directory/$node_archive" --strip-components=1 -C "/opt/node-v${NODE_VERSION}"
for executable in node npm npx corepack; do
  ln -sfn "/opt/node-v${NODE_VERSION}/bin/$executable" "/usr/local/bin/$executable"
done

if ! id portal >/dev/null 2>&1; then
  useradd --system --home-dir /srv/signature-portal-production --shell /usr/sbin/nologin portal
fi
for environment in production staging; do
  app_root="/opt/signature-portal-$environment"
  persistent_root="/srv/signature-portal-$environment"
  install -d -o portal -g portal -m 0750 "$app_root" "$app_root/releases"
  install -d -o portal -g portal -m 0750 "$persistent_root" "$persistent_root/data" "$persistent_root/uploads" "$persistent_root/backups" "$persistent_root/manifests"
  install -d -o root -g root -m 0750 "$persistent_root/evidence"
done
install -d -o root -g portal -m 0750 "$CONFIG_ROOT"
install -d -o root -g adm -m 0750 /var/log/signature-portal

install -o root -g root -m 0644 "$SCRIPT_DIRECTORY/signature-portal@.service" /etc/systemd/system/signature-portal@.service
install -o root -g root -m 0644 "$SCRIPT_DIRECTORY/signature-portal-backup-mirror.service" /etc/systemd/system/signature-portal-backup-mirror.service
install -o root -g root -m 0644 "$SCRIPT_DIRECTORY/signature-portal-backup-mirror.timer" /etc/systemd/system/signature-portal-backup-mirror.timer
install -o root -g root -m 0644 "$SCRIPT_DIRECTORY/signature-portal-consistent-backup.service" /etc/systemd/system/signature-portal-consistent-backup.service
install -o root -g root -m 0644 "$SCRIPT_DIRECTORY/signature-portal-consistent-backup.timer" /etc/systemd/system/signature-portal-consistent-backup.timer
install -o root -g root -m 0644 "$SCRIPT_DIRECTORY/signature-portal-monitor.service" /etc/systemd/system/signature-portal-monitor.service
install -o root -g root -m 0644 "$SCRIPT_DIRECTORY/signature-portal-monitor.timer" /etc/systemd/system/signature-portal-monitor.timer
install -o root -g root -m 0644 "$SCRIPT_DIRECTORY/signature-portal.logrotate" /etc/logrotate.d/signature-portal
install -d -o root -g root -m 0755 /etc/systemd/journald.conf.d
install -o root -g root -m 0644 "$SCRIPT_DIRECTORY/journald-signature-portal.conf" /etc/systemd/journald.conf.d/signature-portal.conf
install -o root -g root -m 0644 "$SCRIPT_DIRECTORY/fail2ban-sshd.local" /etc/fail2ban/jail.d/signature-portal-sshd.local
systemctl daemon-reload
systemctl restart systemd-journald

timedatectl set-timezone UTC
systemctl enable --now systemd-timesyncd unattended-upgrades nginx
systemctl restart fail2ban
systemctl enable fail2ban

ufw default deny incoming
ufw default allow outgoing
ufw allow from "$ADMIN_SSH_CIDR" to any port 22 proto tcp comment 'trusted SSH administration'
ufw allow 80/tcp comment 'HTTP certificate and redirect'
ufw allow 443/tcp comment 'HTTPS portal'
ufw --force enable

echo "Provisioning complete. Node $(node --version) is installed."
echo "Next: run harden-ssh.sh and prove a second key login, populate $CONFIG_ROOT/staging.env and production.env plus rclone.conf, install the reviewed Nginx sites, then deploy staging."
