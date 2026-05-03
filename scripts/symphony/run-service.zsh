#!/usr/bin/env bash

set -euo pipefail

script_dir=$(cd -- "$(dirname -- "$0")" && pwd)
repo_root=$(cd -- "${script_dir}/../.." && pwd)
workflow_path="${repo_root}/WORKFLOW.md"
plugin_repo=${SYMPHONY_PLUGIN_REPO:-/Volumes/SSD-T7/qredence-environnement/qredence-plugins}
service_path="${plugin_repo}/plugins/symphony/scripts/symphony_service.py"
dotenv_path="${repo_root}/.env"

if [[ ! -f "$service_path" ]]; then
  echo "Symphony service not found at $service_path" >&2
  echo "Set SYMPHONY_PLUGIN_REPO to a qredence-plugins checkout that contains plugins/symphony." >&2
  exit 1
fi

if [[ "${SYMPHONY_SKIP_DOTENV:-0}" != "1" && -f "$dotenv_path" ]]; then
  # Keep local operator secrets in the repo root .env for shell-driven runs.
  set -a
  # shellcheck disable=SC1090
  source "$dotenv_path"
  set +a
fi

uv run --project "$plugin_repo" python "$service_path" "$workflow_path"
