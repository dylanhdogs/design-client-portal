#!/usr/bin/env bash
set -Eeuo pipefail

MODE="${1:?Usage: configure-nginx-site.sh production|staging domain email}"
DOMAIN="${2:?Usage: configure-nginx-site.sh production|staging domain email}"
EMAIL="${3:?Usage: configure-nginx-site.sh production|staging domain email}"
SCRIPT_DIRECTORY="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SITE_NAME="signature-portal-${MODE}"

if [[ "${EUID}" -ne 0 ]]; then echo "Run as root." >&2; exit 1; fi
if [[ "$MODE" != production && "$MODE" != staging ]]; then echo "Mode must be production or staging." >&2; exit 1; fi
if [[ ! "$DOMAIN" =~ ^[A-Za-z0-9][A-Za-z0-9.-]*[A-Za-z0-9]$ ]] || [[ "$DOMAIN" != *.* ]] || [[ "$DOMAIN" == *..* ]]; then echo "Invalid domain." >&2; exit 1; fi
if [[ ! "$EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then echo "Invalid certificate contact email." >&2; exit 1; fi

temporary_directory="$(mktemp -d)"
trap 'rm -rf -- "$temporary_directory"' EXIT
sed "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" "$SCRIPT_DIRECTORY/nginx-bootstrap.conf" >"$temporary_directory/bootstrap.conf"
install -o root -g root -m 0644 "$temporary_directory/bootstrap.conf" "/etc/nginx/sites-available/$SITE_NAME"
ln -sfn "/etc/nginx/sites-available/$SITE_NAME" "/etc/nginx/sites-enabled/$SITE_NAME"
nginx -t
systemctl reload nginx

certbot certonly --webroot --webroot-path /var/www/html --domain "$DOMAIN" --email "$EMAIL" --agree-tos --non-interactive --keep-until-expiring

if [[ "$MODE" == production ]]; then
  sed "s/portal\.example\.com/$DOMAIN/g" "$SCRIPT_DIRECTORY/nginx-production.conf" >"$temporary_directory/final.conf"
else
  : "${STAGING_BASIC_AUTH_PASSWORD:?Set STAGING_BASIC_AUTH_PASSWORD in the environment for staging.}"
  STAGING_BASIC_AUTH_USER="${STAGING_BASIC_AUTH_USER:-portal-tester}"
  if [[ ! "$STAGING_BASIC_AUTH_USER" =~ ^[A-Za-z0-9._-]+$ ]]; then echo "Invalid staging username." >&2; exit 1; fi
  htpasswd -B -i -c /etc/nginx/.htpasswd-signature-portal-staging "$STAGING_BASIC_AUTH_USER" <<<"$STAGING_BASIC_AUTH_PASSWORD"
  unset STAGING_BASIC_AUTH_PASSWORD
  chmod 0640 /etc/nginx/.htpasswd-signature-portal-staging
  chown root:www-data /etc/nginx/.htpasswd-signature-portal-staging
  sed "s/staging-portal\.example\.com/$DOMAIN/g" "$SCRIPT_DIRECTORY/nginx-staging.conf" >"$temporary_directory/final.conf"
fi

install -o root -g root -m 0644 "$temporary_directory/final.conf" "/etc/nginx/sites-available/$SITE_NAME"
nginx -t
systemctl reload nginx
certbot renew --dry-run
echo "$MODE HTTPS site configured for $DOMAIN."
