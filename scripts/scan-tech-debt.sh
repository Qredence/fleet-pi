#!/bin/bash
set -euo pipefail

# Tech Debt Scanner
# Scans TypeScript/JavaScript source files for TODO, FIXME, HACK, XXX, and BUG
# comments across apps/web/src and packages/ui/src.
#
# Outputs:
#   - Human-readable table to stdout
#   - Structured JSON report to tech-debt-report.json
#
# Exit codes:
#   0 - no tech debt markers found
#   1 - one or more tech debt markers found (use with continue-on-error in CI)

SCAN_DIRS=("apps/web/src" "packages/ui/src")
MARKERS="TODO|FIXME|HACK|XXX|BUG"
OUTPUT_FILE="tech-debt-report.json"
GLOB="*.{ts,tsx,js,jsx}"

echo "🔍 Scanning for tech debt markers: ${MARKERS}"
echo "   Directories: ${SCAN_DIRS[*]}"
echo ""

# Run ripgrep; exit code 1 means no matches, 2 means error
matches=""
rg_exit=0
matches=$(rg --line-number --with-filename \
  --glob "${GLOB}" \
  -i "(?://|/\*|\*)\s*(${MARKERS})[\s:]" \
  "${SCAN_DIRS[@]}" 2>/dev/null) || rg_exit=$?

if [ -z "${matches}" ]; then
  echo "✅ No tech debt markers found."
  echo "[]" > "${OUTPUT_FILE}"
  exit 0
fi

# Count findings (wc -l includes trailing newline; use line count from matches)
count=$(printf '%s\n' "${matches}" | wc -l | tr -d ' ')

echo "⚠️  Found ${count} tech debt item(s):"
echo ""

# Print markdown table for CI logs
echo "| File | Line | Marker | Comment |"
echo "|------|------|--------|---------|"

# Build JSON array via a temp file
temp_json=$(mktemp)
echo '[' > "${temp_json}"

first=true
while IFS= read -r line; do
  # ripgrep output: file:line:text
  file_path=$(printf '%s' "${line}" | cut -d: -f1)
  lineno=$(printf '%s' "${line}" | cut -d: -f2)
  text=$(printf '%s' "${line}" | cut -d: -f3-)

  # Extract marker (first match of TODO/FIXME/HACK/XXX/BUG)
  marker=$(printf '%s' "${text}" | grep -oEi "(${MARKERS})" | head -1 | tr '[:lower:]' '[:upper:]')

  # Print table row
  echo "| ${file_path} | ${lineno} | ${marker} | ${text} |"

  # Append to JSON
  if [ "${first}" = true ]; then
    first=false
  else
    echo ',' >> "${temp_json}"
  fi

  python3 -c '
import sys, json
file_path = sys.argv[1]
lineno = int(sys.argv[2])
marker = sys.argv[3]
text = sys.argv[4]
json.dump({
  "file": file_path,
  "line": lineno,
  "marker": marker,
  "text": text.strip()
}, sys.stdout)
' "${file_path}" "${lineno}" "${marker}" "${text}" >> "${temp_json}"
done <<< "${matches}"

echo '' >> "${temp_json}"
echo ']' >> "${temp_json}"

cp "${temp_json}" "${OUTPUT_FILE}"
rm "${temp_json}"

echo ""
echo "📄 Structured report saved to ${OUTPUT_FILE}"

# Exit with error code so CI can show a warning (when combined with continue-on-error)
exit 1
