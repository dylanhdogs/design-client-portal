#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then echo "Run as root from a working key-authenticated session or Hostinger console." >&2; exit 1; fi

authorized_keys=/root/.ssh/authorized_keys
if [[ ! -s "$authorized_keys" ]]; then
  echo "Refusing to disable password authentication: $authorized_keys is missing or empty." >&2
  exit 1
fi

drop_in_directory=/etc/ssh/sshd_config.d
drop_in="$drop_in_directory/99-signature-portal-hardening.conf"
temporary_file="$(mktemp)"
trap 'rm -f -- "$temporary_file"' EXIT

cat >"$temporary_file" <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
PubkeyAuthentication yes
PermitEmptyPasswords no
MaxAuthTries 4
X11Forwarding no
AllowAgentForwarding no
EOF

install -d -o root -g root -m 0755 "$drop_in_directory"
install -o root -g root -m 0644 "$temporary_file" "$drop_in"
/usr/sbin/sshd -t
systemctl reload ssh

effective="$(/usr/sbin/sshd -T)"
grep -qx 'passwordauthentication no' <<<"$effective"
grep -qx 'kbdinteractiveauthentication no' <<<"$effective"
grep -Eq '^permitrootlogin (prohibit-password|without-password|no)$' <<<"$effective"
grep -qx 'pubkeyauthentication yes' <<<"$effective"

echo "SSH password authentication is disabled. Keep this session open and prove a second key-authenticated login before disconnecting."
