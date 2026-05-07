#!/usr/bin/env zsh

set -euo pipefail

workspace_root=${PWD:A}
script_dir=${0:A:h}
source_repo_root=${script_dir:h:h}
template_path="${source_repo_root}/.codex/symphony/config.toml"
codex_home="${workspace_root:h}/.codex-home"
config_path="${codex_home}/config.toml"

if [[ ! -f "${template_path}" ]]; then
  print -u2 "Missing Symphony Codex config template at ${template_path}"
  exit 1
fi

# Validate at least one credential is set
credential_errors=()
if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
  credential_errors+=("ANTHROPIC_API_KEY is not set")
fi
if [[ -z "${ANTHROPIC_OAUTH_KEY:-}" ]]; then
  credential_errors+=("ANTHROPIC_OAUTH_KEY is not set")
fi
if [[ -z "${AWS_BEARER_TOKEN_BEDROCK:-}" ]]; then
  credential_errors+=("AWS_BEARER_TOKEN_BEDROCK is not set")
fi

if [[ ${#credential_errors[@]} -eq 3 ]]; then
  print -u2 "Missing Anthropic/Bedrock credentials."
  print -u2 "Set at least one of the following before running pnpm symphony:run:"
  print -u2 "  - ANTHROPIC_API_KEY"
  print -u2 "  - ANTHROPIC_OAUTH_KEY"
  print -u2 "  - AWS_BEARER_TOKEN_BEDROCK"
  exit 1
fi

# Validate credential formats
if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
  if [[ ${#ANTHROPIC_API_KEY} -lt 20 ]]; then
    print -u2 "ANTHROPIC_API_KEY appears to be invalid (too short)"
    exit 1
  fi
fi

if [[ -n "${ANTHROPIC_OAUTH_KEY:-}" ]]; then
  if [[ ${#ANTHROPIC_OAUTH_KEY} -lt 20 ]]; then
    print -u2 "ANTHROPIC_OAUTH_KEY appears to be invalid (too short)"
    exit 1
  fi
fi

if [[ -n "${AWS_BEARER_TOKEN_BEDROCK:-}" ]]; then
  if [[ ${#AWS_BEARER_TOKEN_BEDROCK} -lt 20 ]]; then
    print -u2 "AWS_BEARER_TOKEN_BEDROCK appears to be invalid (too short)"
    exit 1
  fi
fi

# Validate optional variables when set
if [[ -n "${CLAUDE_CODE_USE_BEDROCK:-}" ]]; then
  if [[ "${CLAUDE_CODE_USE_BEDROCK}" != "true" && "${CLAUDE_CODE_USE_BEDROCK}" != "false" ]]; then
    print -u2 "CLAUDE_CODE_USE_BEDROCK must be 'true' or 'false', got '${CLAUDE_CODE_USE_BEDROCK}'"
    exit 1
  fi
fi

if [[ -n "${AWS_REGION:-}" ]]; then
  # Basic AWS region format validation (e.g., us-east-1, eu-west-2)
  if ! [[ "${AWS_REGION}" =~ ^[a-z]{2}-[a-z]+-[0-9]+$ ]]; then
    print -u2 "AWS_REGION appears to be invalid, got '${AWS_REGION}' (expected format like us-east-1)"
    exit 1
  fi
fi

mkdir -p "${codex_home}"
cp "${template_path}" "${config_path}"

export CODEX_HOME="${codex_home}"

exec codex app-server
