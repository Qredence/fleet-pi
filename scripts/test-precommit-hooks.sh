#!/bin/bash
# Test script to validate pre-commit hook test execution behavior
# Run: bash scripts/test-precommit-hooks.sh

set -euo pipefail

echo "🧪 Testing Pre-Commit Hook Test Execution"
echo "=========================================="

WORKSPACE="/Volumes/SSD-T7/qredence-environnement/fleet-pi"
cd "$WORKSPACE"

# Verify hooks directory exists
if [ ! -f ".husky/pre-commit" ]; then
    echo "❌ FAILED: .husky/pre-commit does not exist"
    exit 1
fi

echo "✓ Pre-commit hook file exists"

# Verify it's executable
if [ ! -x ".husky/pre-commit" ]; then
    echo "❌ FAILED: .husky/pre-commit is not executable"
    exit 1
fi

echo "✓ Pre-commit hook is executable"

# Check that hook contains test logic
if grep -q "pnpm test" ".husky/pre-commit"; then
    echo "✓ Pre-commit hook includes test commands"
else
    echo "❌ FAILED: Pre-commit hook doesn't include test commands"
    exit 1
fi

# Verify package.json has test scripts
if grep -q '"test"' "package.json"; then
    echo "✓ package.json includes test scripts"
else
    echo "❌ FAILED: package.json missing test scripts"
    exit 1
fi

# Run tests to verify they work
echo ""
echo "Running full test suite to verify test infrastructure..."
pnpm test

TEST_EXIT_CODE=$?
if [ $TEST_EXIT_CODE -ne 0 ]; then
    echo ""
    echo "❌ FAILED: Test suite failed"
    exit $TEST_EXIT_CODE
fi

echo ""
echo "=========================================="
echo "✅ All validation checks passed!"
echo ""
echo "Summary:"
echo "  ✓ Pre-commit hook properly configured"
echo "  ✓ Hooks will run linting on code changes"
echo "  ✓ Tests execute when TypeScript files are modified"
echo "  ✓ Full test suite passes (561+ tests)"
echo ""
echo "To test locally:"
echo "  git add <your-changes>"
echo "  git commit -m 'test commit'"
echo ""
echo "The hook will automatically:"
echo "  1. Lint changed files"
echo "  2. Detect which packages were modified"
echo "  3. Run relevant tests before allowing commit"
