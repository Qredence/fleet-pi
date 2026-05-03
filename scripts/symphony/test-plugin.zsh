#!/usr/bin/env zsh

set -euo pipefail

plugin_repo=${SYMPHONY_PLUGIN_REPO:-/Volumes/SSD-T7/qredence-environnement/qredence-plugins}

if [[ ! -d "$plugin_repo" ]]; then
  echo "Symphony plugin repository not found at $plugin_repo" >&2
  echo "Set SYMPHONY_PLUGIN_REPO to a qredence-plugins checkout." >&2
  exit 1
fi

(
  cd "$plugin_repo"
  uv run pytest plugins/symphony/tests
)
