#!/usr/bin/env bash

set -euo pipefail

script_dir=$(cd -- "$(dirname -- "$0")" && pwd)
source "${script_dir}/common.sh"
repo_root=$(cd -- "${script_dir}/../.." && pwd)
workflow_path="${repo_root}/WORKFLOW.md"
dotenv_path="${repo_root}/.env"
load_repo_dotenv "$dotenv_path"

plugin_repo=${SYMPHONY_PLUGIN_REPO:-/Volumes/SSD-T7/qredence-environnement/qredence-plugins}
service_path="${plugin_repo}/plugins/symphony/scripts/symphony_service.py"

if [[ ! -f "$service_path" ]]; then
  echo "Symphony service not found at $service_path" >&2
  echo "Set SYMPHONY_PLUGIN_REPO to a qredence-plugins checkout that contains plugins/symphony." >&2
  exit 1
fi

require_nonempty_env_var "LINEAR_API_KEY" \
  "Set LINEAR_API_KEY in ${dotenv_path} or export it and set SYMPHONY_SKIP_DOTENV=1."

LINEAR_API_KEY="$LINEAR_API_KEY" uv run --project "$plugin_repo" python "$service_path" "$workflow_path" --dry-run-config
