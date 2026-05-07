#!/usr/bin/env bash

load_dotenv_file() {
  local path="$1"

  [[ -f "$path" ]] || return 0

  while IFS= read -r -d '' key && IFS= read -r -d '' value; do
    export "$key=$value"
  done < <(
    uv run python - "$path" <<'PY'
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

load_repo_dotenv() {
  local path="$1"

  if [[ "${SYMPHONY_SKIP_DOTENV:-0}" == "1" || ! -f "$path" ]]; then
    return 0
  fi

  command -v uv >/dev/null 2>&1 || {
    echo "uv is required to load $path" >&2
    exit 1
  }

  load_dotenv_file "$path"
}

require_nonempty_env_var() {
  local name="$1"
  local hint="${2:-}"

  if [[ -n "${!name:-}" ]]; then
    return 0
  fi

  echo "Missing required environment variable: $name" >&2

  if [[ -n "$hint" ]]; then
    echo "$hint" >&2
  fi

  exit 1
}
