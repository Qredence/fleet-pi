#!/usr/bin/env zsh

set -euo pipefail

workspace_root=${PWD:A}
script_dir=${0:A:h}
source_repo_root=${script_dir:h:h}
template_path="${source_repo_root}/.codex/symphony/config.toml"
codex_home="${workspace_root:h}/.codex-home"
config_path="${codex_home}/config.toml"
global_auth_path="${HOME}/.codex/auth.json"
auth_path="${codex_home}/auth.json"

if [[ ! -f "${template_path}" ]]; then
  print -u2 "Missing Symphony Codex config template at ${template_path}"
  exit 1
fi

if [[ ! -f "${global_auth_path}" ]]; then
  print -u2 "Missing ChatGPT Codex auth at ${global_auth_path}"
  print -u2 "Run 'codex login' with your ChatGPT subscription before running pnpm symphony:run."
  exit 1
fi

mkdir -p "${codex_home}"
cp "${template_path}" "${config_path}"
cp "${global_auth_path}" "${auth_path}"

export CODEX_HOME="${codex_home}"

if ! codex login status >/dev/null 2>&1; then
  print -u2 "The isolated Symphony Codex home could not validate ChatGPT login state."
  print -u2 "Refresh the main Codex login with 'codex login' and retry."
  exit 1
fi

exec codex app-server
