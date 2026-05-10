#!/usr/bin/env zsh

set -euo pipefail

SCRIPT_DIR=${0:A:h}
REPO_ROOT=${SCRIPT_DIR:h}

cd "$REPO_ROOT"

if ! command -v node >/dev/null 2>&1; then
  print -u2 "error: Node.js 22+ is required for Fleet Pi setup"
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  print -u2 "error: pnpm is required for Fleet Pi setup"
  exit 1
fi

# Bootstrap only: install dependencies for the fresh worktree, but do not
# start long-running processes or rewrite canonical workspace state here.
pnpm install --frozen-lockfile

print "Codex workspace ready: $REPO_ROOT"
print "node: $(node --version)"
print "pnpm: $(pnpm --version)"
