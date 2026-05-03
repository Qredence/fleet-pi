#!/usr/bin/env zsh

set -euo pipefail

git fetch origin main --prune

manifest_files=(
  package.json
  pnpm-lock.yaml
  pnpm-workspace.yaml
  apps/*/package.json(N)
  packages/*/package.json(N)
)
deps_stamp_dir=".fleet"
deps_stamp_path="${deps_stamp_dir}/symphony-deps.sha256"
manifest_hash=$(shasum "${manifest_files[@]}" | shasum | awk '{print $1}')
previous_hash=""

if [[ -f "$deps_stamp_path" ]]; then
  previous_hash=$(<"$deps_stamp_path")
fi

if [[ ! -d node_modules || ! -f node_modules/.modules.yaml || "$manifest_hash" != "$previous_hash" ]]; then
  pnpm install --frozen-lockfile
  mkdir -p "$deps_stamp_dir"
  print -r -- "$manifest_hash" >| "$deps_stamp_path"
fi
