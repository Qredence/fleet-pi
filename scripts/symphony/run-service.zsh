#!/usr/bin/env zsh

set -euo pipefail

repo_root=${0:A:h:h:h}
workflow_path="${repo_root}/WORKFLOW.md"
plugin_repo=${SYMPHONY_PLUGIN_REPO:-/Volumes/SSD-T7/qredence-environnement/qredence-plugins}
service_path="${plugin_repo}/plugins/symphony/scripts/symphony_service.py"

if [[ ! -f "$service_path" ]]; then
  echo "Symphony service not found at $service_path" >&2
  echo "Set SYMPHONY_PLUGIN_REPO to a qredence-plugins checkout that contains plugins/symphony." >&2
  exit 1
fi

uv run --project "$plugin_repo" python "$service_path" "$workflow_path"
