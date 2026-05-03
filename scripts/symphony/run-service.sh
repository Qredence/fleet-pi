#!/usr/bin/env bash

set -euo pipefail

script_dir=$(cd -- "$(dirname -- "$0")" && pwd)
repo_root=$(cd -- "${script_dir}/../.." && pwd)
workflow_path="${repo_root}/WORKFLOW.md"
dotenv_path="${repo_root}/.env"

load_dotenv() {
  local path="$1"

  [[ -f "$path" ]] || return 0

  while IFS= read -r -d '' key && IFS= read -r -d '' value; do
    export "$key=$value"
  done < <(
    python3 - "$path" <<'PY'
import re
import shlex
import sys
from pathlib import Path


def parse_value(raw: str) -> str:
    raw = raw.strip()
    if not raw:
        return ""
    if raw[0] in "\"'":
        lexer = shlex.shlex(raw, posix=True)
        lexer.whitespace_split = True
        lexer.commenters = ""
        parts = list(lexer)
        return parts[0] if parts else ""
    comment = raw.find(" #")
    if comment != -1:
        raw = raw[:comment]
    return raw.rstrip()


for original in Path(sys.argv[1]).read_text().splitlines():
    line = original.strip()
    if not line or line.startswith("#"):
        continue
    if line.startswith("export "):
        line = line[7:].lstrip()
    if "=" not in line:
        continue
    key, value = line.split("=", 1)
    key = key.strip()
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
        continue
    sys.stdout.write(key)
    sys.stdout.write("\0")
    sys.stdout.write(parse_value(value))
    sys.stdout.write("\0")
PY
  )
}

if [[ "${SYMPHONY_SKIP_DOTENV:-0}" != "1" ]]; then
  load_dotenv "$dotenv_path"
fi

plugin_repo=${SYMPHONY_PLUGIN_REPO:-/Volumes/SSD-T7/qredence-environnement/qredence-plugins}
service_path="${plugin_repo}/plugins/symphony/scripts/symphony_service.py"

if [[ ! -f "$service_path" ]]; then
  echo "Symphony service not found at $service_path" >&2
  echo "Set SYMPHONY_PLUGIN_REPO to a qredence-plugins checkout that contains plugins/symphony." >&2
  exit 1
fi

uv run --project "$plugin_repo" python "$service_path" "$workflow_path"
