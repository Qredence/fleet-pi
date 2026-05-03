#!/usr/bin/env bash

set -euo pipefail

script_dir=$(cd -- "$(dirname -- "$0")" && pwd)
repo_root=$(cd -- "${script_dir}/../.." && pwd)
workflow_path="${repo_root}/WORKFLOW.md"
plugin_repo=${SYMPHONY_PLUGIN_REPO:-/Volumes/SSD-T7/qredence-environnement/qredence-plugins}
service_path="${plugin_repo}/plugins/symphony/scripts/symphony_service.py"
dotenv_path="${repo_root}/.env"
linear_api_key=${LINEAR_API_KEY:-fleet-pi-dry-run-token}

if [[ ! -f "$service_path" ]]; then
  echo "Symphony service not found at $service_path" >&2
  echo "Set SYMPHONY_PLUGIN_REPO to a qredence-plugins checkout that contains plugins/symphony." >&2
  exit 1
fi

if [[ "${SYMPHONY_SKIP_DOTENV:-0}" != "1" && -f "$dotenv_path" ]]; then
  # Mirror the runtime wrapper so validation sees the same repo-local secrets.
  set -a
  # shellcheck disable=SC1090
  source "$dotenv_path"
  set +a
fi

linear_api_key=${LINEAR_API_KEY:-$linear_api_key}

LINEAR_API_KEY="$linear_api_key" uv run --project "$plugin_repo" python "$service_path" "$workflow_path" --dry-run-config
