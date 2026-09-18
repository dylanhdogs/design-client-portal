#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${BASE_URL:?Set BASE_URL to the public HTTPS origin, without a trailing slash.}"
PORTAL_TEST_EMAIL="${PORTAL_TEST_EMAIL:-}"
PORTAL_TEST_PASSWORD="${PORTAL_TEST_PASSWORD:-}"
PORTAL_TEST_CLIENT_ID="${PORTAL_TEST_CLIENT_ID:-}"

if [[ ! "$BASE_URL" =~ ^https://[^/]+$ ]]; then
  echo "BASE_URL must be a bare HTTPS origin." >&2
  exit 1
fi

temporary_directory="$(mktemp -d)"
document_id=""
communication_id=""
curl_options=(--fail --silent --show-error --location --max-time 30)
cleanup() {
  set +e
  if [[ -n "$document_id" && -n "$PORTAL_TEST_CLIENT_ID" ]]; then
    curl "${curl_options[@]}" --cookie "$temporary_directory/cookies" --request DELETE "$BASE_URL/api/clients/$PORTAL_TEST_CLIENT_ID/documents/$document_id" >/dev/null 2>&1 || true
  fi
  if [[ -n "$communication_id" && -n "$PORTAL_TEST_CLIENT_ID" ]]; then
    curl "${curl_options[@]}" --cookie "$temporary_directory/cookies" --request DELETE "$BASE_URL/api/clients/$PORTAL_TEST_CLIENT_ID/communications/$communication_id" >/dev/null 2>&1 || true
  fi
  rm -rf -- "$temporary_directory"
}
trap cleanup EXIT
sensitive_config="$temporary_directory/curl-sensitive.conf"
umask 077
: >"$sensitive_config"
escape_curl_config() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
if [[ -n "${STAGING_BASIC_AUTH:-}" ]]; then
  if [[ "$STAGING_BASIC_AUTH" == *$'\n'* || "$STAGING_BASIC_AUTH" == *$'\r'* ]]; then echo "STAGING_BASIC_AUTH contains an invalid newline." >&2; exit 1; fi
  printf 'user = "%s"\n' "$(escape_curl_config "$STAGING_BASIC_AUTH")" >>"$sensitive_config"
  unset STAGING_BASIC_AUTH
fi
if [[ -n "${HEALTH_CHECK_TOKEN:-}" ]]; then
  if [[ "$HEALTH_CHECK_TOKEN" == *$'\n'* || "$HEALTH_CHECK_TOKEN" == *$'\r'* ]]; then echo "HEALTH_CHECK_TOKEN contains an invalid newline." >&2; exit 1; fi
  printf 'header = "X-Health-Check-Token: %s"\n' "$(escape_curl_config "$HEALTH_CHECK_TOKEN")" >>"$sensitive_config"
  unset HEALTH_CHECK_TOKEN
fi
if [[ -s "$sensitive_config" ]]; then curl_options+=(--config "$sensitive_config"); fi

curl "${curl_options[@]}" "$BASE_URL/api/health/live" | jq -e '.status == "ok"' >/dev/null
curl "${curl_options[@]}" "$BASE_URL/api/health/ready" | jq -e '.status == "ready" and ((.checks == null) or ([.checks[].ok] | all))' >/dev/null
curl "${curl_options[@]}" --dump-header "$temporary_directory/headers" --output /dev/null "$BASE_URL/login"
grep -qi '^strict-transport-security:' "$temporary_directory/headers"
grep -qi '^x-content-type-options: *nosniff' "$temporary_directory/headers"

if [[ -n "$PORTAL_TEST_EMAIL" || -n "$PORTAL_TEST_PASSWORD" || -n "$PORTAL_TEST_CLIENT_ID" ]]; then
  : "${PORTAL_TEST_EMAIL:?Set PORTAL_TEST_EMAIL, PORTAL_TEST_PASSWORD, and PORTAL_TEST_CLIENT_ID together.}"
  : "${PORTAL_TEST_PASSWORD:?Set PORTAL_TEST_EMAIL, PORTAL_TEST_PASSWORD, and PORTAL_TEST_CLIENT_ID together.}"
  : "${PORTAL_TEST_CLIENT_ID:?Set PORTAL_TEST_EMAIL, PORTAL_TEST_PASSWORD, and PORTAL_TEST_CLIENT_ID together.}"
  if [[ ! "$PORTAL_TEST_CLIENT_ID" =~ ^[0-9a-fA-F-]{36}$ ]]; then echo "PORTAL_TEST_CLIENT_ID must be a UUID." >&2; exit 1; fi
  export PORTAL_TEST_EMAIL PORTAL_TEST_PASSWORD
  jq -n '{email:env.PORTAL_TEST_EMAIL,password:env.PORTAL_TEST_PASSWORD}' >"$temporary_directory/login.json"
  unset PORTAL_TEST_PASSWORD
  curl "${curl_options[@]}" --cookie-jar "$temporary_directory/cookies" --header 'Content-Type: application/json' --data-binary "@$temporary_directory/login.json" "$BASE_URL/api/auth/login" >"$temporary_directory/login-response.json"
  jq -e '.user.id and (.token | not)' "$temporary_directory/login-response.json" >/dev/null
  grep -q 'portal_session' "$temporary_directory/cookies"
  grep -q 'portal_csrf' "$temporary_directory/cookies"
  curl "${curl_options[@]}" --cookie "$temporary_directory/cookies" "$BASE_URL/api/auth/me" | jq -e --arg email "$PORTAL_TEST_EMAIL" '.email == $email' >/dev/null
  csrf_token="$(awk '$6 == "portal_csrf" {print $7}' "$temporary_directory/cookies")"
  test -n "$csrf_token"
  printf 'header = "X-CSRF-Token: %s"\n' "$(escape_curl_config "$csrf_token")" >>"$sensitive_config"
  unset csrf_token

  smoke_id="hosted-smoke-$(date --utc +%Y%m%dT%H%M%SZ)-$$"
  jq -n --arg subject "$smoke_id" '{type:"OTHER",subject:$subject,body:"Sanitized deployment verification record.",direction:"OUTBOUND"}' >"$temporary_directory/communication.json"
  curl "${curl_options[@]}" --cookie "$temporary_directory/cookies" --header 'Content-Type: application/json' --data-binary "@$temporary_directory/communication.json" "$BASE_URL/api/clients/$PORTAL_TEST_CLIENT_ID/communications" >"$temporary_directory/communication-response.json"
  communication_id="$(jq -er '.id' "$temporary_directory/communication-response.json")"

  printf '%s' 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' | base64 --decode >"$temporary_directory/smoke.png"
  curl "${curl_options[@]}" --cookie "$temporary_directory/cookies" --form "file=@$temporary_directory/smoke.png;type=image/png" --form "description=$smoke_id" "$BASE_URL/api/clients/$PORTAL_TEST_CLIENT_ID/documents" >"$temporary_directory/document-response.json"
  document_id="$(jq -er '.id' "$temporary_directory/document-response.json")"
  curl "${curl_options[@]}" --cookie "$temporary_directory/cookies" --output "$temporary_directory/downloaded.png" "$BASE_URL/api/clients/$PORTAL_TEST_CLIENT_ID/documents/$document_id/download"
  cmp "$temporary_directory/smoke.png" "$temporary_directory/downloaded.png"

  curl "${curl_options[@]}" --cookie "$temporary_directory/cookies" --request DELETE "$BASE_URL/api/clients/$PORTAL_TEST_CLIENT_ID/documents/$document_id" | jq -e '.message == "Document deleted successfully."' >/dev/null
  document_status="$(curl "${curl_options[@]}" --no-fail --output /dev/null --write-out '%{http_code}' --cookie "$temporary_directory/cookies" "$BASE_URL/api/clients/$PORTAL_TEST_CLIENT_ID/documents/$document_id/download")"
  [[ "$document_status" == "404" ]]
  document_id=""
  curl "${curl_options[@]}" --cookie "$temporary_directory/cookies" --request DELETE "$BASE_URL/api/clients/$PORTAL_TEST_CLIENT_ID/communications/$communication_id" | jq -e '.message == "Communication deleted successfully."' >/dev/null
  communication_id=""

  curl "${curl_options[@]}" --cookie "$temporary_directory/cookies" --request POST "$BASE_URL/api/auth/logout" | jq -e '.message == "Logged out."' >/dev/null
fi

echo "Hosted smoke test passed for $BASE_URL."
