#!/usr/bin/env zsh

set -euo pipefail

workspace_dir=${PWD:A}

# Startup cleanup can revisit a workspace path that Symphony already reduced to
# an empty placeholder directory. In that case there is no git worktree left to
# unregister, so exit quietly.
if [[ ! -f .git ]]; then
  exit 0
fi

git_common_dir=$(git rev-parse --git-common-dir)
source_repo_root=${${git_common_dir:A}:h}

cd "$source_repo_root"

if git worktree list --porcelain | grep -Fqx "worktree $workspace_dir"; then
  git worktree remove --force "$workspace_dir"
  git worktree prune

  # Symphony removes the workspace directory after this hook returns, so
  # recreate an empty placeholder once git has released the worktree metadata.
  mkdir -p "$workspace_dir"
fi
