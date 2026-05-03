#!/usr/bin/env zsh

set -euo pipefail

script_dir=${0:A:h}
source_repo_root=${script_dir:h:h}
workspace_dir=$PWD
workspace_key=${workspace_dir:t}
branch_name="codex/${workspace_key}"

if [[ -n "$(command ls -A "$workspace_dir" 2>/dev/null)" ]]; then
  echo "Expected an empty Symphony workspace, found existing files in $workspace_dir" >&2
  exit 1
fi

git -C "$source_repo_root" fetch origin main --prune
git -C "$source_repo_root" worktree add -B "$branch_name" "$workspace_dir" origin/main
