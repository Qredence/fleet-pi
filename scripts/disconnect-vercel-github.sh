#!/usr/bin/env bash
# Disconnect fleet-pi-web from GitHub on Vercel (stops push/PR deployments).
# Requires a Vercel token with access to team Qredence:
#   https://vercel.com/account/settings/tokens
#
# Usage:
#   VERCEL_TOKEN=... ./scripts/disconnect-vercel-github.sh
#
# Optional: remove Qredence/fleet-pi from the Vercel GitHub App (org owner):
#   https://github.com/organizations/Qredence/settings/installations/43603470
set -euo pipefail

PROJECT_ID="prj_qqM07NNxNCCS7hBhbQhDldP5KEIV"
TEAM_ID="team_3xJeSlyjwkTOoK3w0ygpRtcQ"

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "Set VERCEL_TOKEN (Vercel account → Settings → Tokens)." >&2
  exit 1
fi

url="https://api.vercel.com/v9/projects/${PROJECT_ID}/link?teamId=${TEAM_ID}"
http_code="$(
  curl -sS -o /tmp/vercel-unlink.json -w "%{http_code}" \
    -X DELETE \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" \
    -H "Content-Type: application/json" \
    "${url}"
)"

if [[ "${http_code}" == "200" || "${http_code}" == "204" ]]; then
  echo "OK: Disconnected Git repository from fleet-pi-web (HTTP ${http_code})."
  exit 0
fi

echo "FAIL: Vercel unlink returned HTTP ${http_code}:" >&2
cat /tmp/vercel-unlink.json >&2
exit 1
