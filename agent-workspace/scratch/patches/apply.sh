#!/bin/bash
# Apply staged prompt-aware memory retrieval patches to the active Pi config.
# Ensure you are running this in Agent/Harness mode where file writes outside the workspace are allowed.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../" && pwd)"

echo "Copying prompt-aware memory retrieval indexer..."
cp "$SCRIPT_DIR/workspace-memory-index.ts" "$PROJECT_ROOT/.pi/extensions/lib/workspace-memory-index.ts"

echo "Copying updated workspace context extension..."
cp "$SCRIPT_DIR/workspace-context.ts" "$PROJECT_ROOT/.pi/extensions/workspace-context.ts"

echo "Patches successfully applied! Please run a new session or '/reload' to verify."
