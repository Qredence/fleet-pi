# Test Execution Automation

This project uses **pre-commit hooks** and **CI/CD pipelines** to ensure code quality through automated testing.

## Pre-Commit Hooks (Local Development)

### How It Works

When you commit changes with TypeScript files (`*.ts`, `*.tsx`, `*.js`, `*.jsx`):

```bash
git add .
git commit -m "Your commit message"
```

The pre-commit hook will:

1. **Run linting** via `lint-staged` (auto-fixes formatting issues)
2. **Detect changed packages**:
   - If files in `apps/web/` are modified → run web package tests
   - If files in `packages/hax-design/` are modified → run hax-design package tests  
   - If files in `packages/pi-protocol/` are modified → run pi-protocol package tests
3. **Block commit** if any tests fail

### Smart Test Execution

Only tests for packages with relevant code changes are run automatically. This ensures fast feedback while maintaining code quality.

Example scenarios:

- You edit only CSS/markdown → only lint runs (no tests)
- You edit TypeScript in web app → lint + web tests
- You edit shared protocol types → lint + protocol tests

## Running Tests Manually

### Run all tests

```bash
pnpm test
```

### Run tests for specific package

```bash
pnpm --filter web test          # Web application only
pnpm --filter @workspace/hax-design test    # UI components only
pnpm --filter @workspace/pi-protocol test   # Protocol types only
```

### Run specific test file

```bash
cd apps/web && pnpm vitest src/lib/pi/__tests__/server.test.ts
```

### Run tests in watch mode

```bash
cd apps/web && pnpm vitest
```

## Continuous Integration (CircleCI)

Our CI pipeline at `.circleci/config.yml` runs on every push/PR:

1. **lint** - Validate code style
2. **typecheck** - Verify TypeScript types
3. **build** - Compile all packages
4. **test** - Run full test suite
5. **e2e** - Playwright end-to-end tests (requires passing previous steps)

### Triggering CI

- **Pull Requests**: Automatically triggered when opened or updated
- **Pushes to main/master**: Scheduled tests every 6 hours
- **Manual deployment**: Approval workflow before production deployment

## Coverage Tracking

To verify test coverage metrics (like `populationCoverage.withChecks`), use the session analysis tools:

```bash
node /Users/zocho/.qoder/plugins/cache/qoder-bundler/better-harness/scripts/better-harness.mjs \
  session-analysis facts \
  --platform qoder \
  --workspace /Volumes/SSD-T7/qredence-environnement/fleet-pi \
  --selection all-eligible \
  --since 2026-07-28T00:00:00Z \
  --until $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --limit 100 \
  --format json
```

Look for coverage metrics in the output to ensure tests are being executed.

## Troubleshooting

### Hook blocks my commit

Check which test failed:

```bash
# See staged files
git diff --cached --name-only

# Manually run affected package tests
pnpm --filter web test
```

### Tests pass locally but fail in CI

Ensure your environment matches CI:

- Node version: ≥22 (defined in `.nvmrc` or `package.json`)
- Package manager: pnpm 11.x
- Dependencies installed fresh: `rm -rf node_modules && pnpm install`

### Disable hooks temporarily

For emergencies only:

```bash
git commit --no-verify -m "Your message"
```

⚠️ **Note**: Disabling hooks can lead to broken builds. Use sparingly.

## Best Practices

✅ **DO:**
- Write tests alongside new features
- Keep tests focused and isolated
- Run tests before committing complex changes
- Update existing tests when modifying behavior

❌ **DON'T:**
- Commit untested critical functionality
- Ignore failing pre-commit checks
- Add tests that don't validate actual behavior
- Disable hooks to bypass failing tests

## Architecture

See [`docs/architecture.md`](./docs/architecture.md) for test architecture overview.

---

**Last updated**: July 28, 2026
