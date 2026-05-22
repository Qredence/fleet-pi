# Testing

Fleet Pi has two test layers: **Vitest** for unit/integration tests and **Playwright** for end-to-end tests.

## Unit and Integration Tests (Vitest)

### Location

Test files live colocated with the source they cover:

```
apps/web/src/routes/api/webhooks/daytona.test.ts   # alongside daytona.ts
apps/web/src/lib/.../*.test.ts
```

Name files `*.test.ts` or `*.spec.ts`. The Vitest config in `apps/web` picks them up automatically.

### Running Tests

```bash
# Run all unit tests once (also used by CI)
pnpm test

# Run only the web workspace tests
pnpm --filter web test

# Watch mode — re-runs on file change
pnpm --filter web test:watch

# With coverage report
pnpm --filter web test:coverage
```

Coverage is collected via `@vitest/coverage-v8`. After running `test:coverage`, open the HTML report in `apps/web/coverage/`.

### Writing Tests

Import from `vitest` directly:

```ts
import { describe, expect, it, vi } from "vitest"
```

Keep tests focused on a single unit. For functions that depend on environment variables, set them in `beforeEach` and restore in `afterEach`:

```ts
beforeEach(() => {
  process.env.DAYTONA_WEBHOOK_SECRET = "test-secret"
})
afterEach(() => {
  delete process.env.DAYTONA_WEBHOOK_SECRET
})
```

### Mocking Pi Sessions

Fleet Pi stores Pi sessions as JSONL files. For tests that exercise session-dependent code, use lightweight JSONL fixture files rather than spinning up a real Pi runtime. Place fixtures under `apps/web/src/__fixtures__/` or alongside the test file. A minimal session fixture needs only enough entries for the code path being tested — full conversation history is not required.

When testing code that calls `createPiRuntime` or other live Pi functions, mock the Pi module:

```ts
vi.mock("@/lib/pi/server", () => ({
  createPiRuntime: vi
    .fn()
    .mockResolvedValue({ runtime: mockRuntime, diagnostics: [] }),
}))
```

## End-to-End Tests (Playwright)

### Location

E2E tests live in `apps/web/e2e/`.

### Running E2E Tests

```bash
# Run all e2e tests
pnpm e2e

# Or from the web workspace
pnpm --filter web e2e
```

The Playwright config in `apps/web` defines a `webServer` block that starts the Vite dev server automatically before tests run. You do not need to start the app separately.

### Writing E2E Tests

Use `@playwright/test`:

```ts
import { expect, test } from "@playwright/test"

test("chat sends a message", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("textbox").fill("hello")
  await page.keyboard.press("Enter")
  await expect(page.getByRole("article")).toContainText("hello")
})
```

Keep E2E tests focused on user-visible behaviour. Avoid asserting on internal state or implementation details.

### CI vs Local

In CI (GitHub Actions), Playwright runs headless on Blacksmith runners. Locally, it defaults to headless unless `--headed` is passed:

```bash
pnpm --filter web e2e -- --headed
```

The CI `e2e` job is defined in `.github/workflows/ci.yml` and depends on the `build` job completing successfully.

## CI Pipeline Summary

The CI workflow (`.github/workflows/ci.yml`) runs on every pull request and push to `main`. Jobs:

| Job                    | Command                   | Depends on          |
| ---------------------- | ------------------------- | ------------------- |
| `lint`                 | `pnpm lint`               | `setup`             |
| `typecheck`            | `pnpm typecheck`          | `setup`             |
| `syncpack`             | `pnpm syncpack`           | `setup`             |
| `test`                 | `pnpm --filter web test`  | `lint`, `typecheck` |
| `build`                | `pnpm build`              | `lint`, `typecheck` |
| `knip`                 | `pnpm knip`               | `setup`             |
| `jscpd`                | `pnpm jscpd`              | `setup`             |
| `tech-debt`            | `pnpm tech-debt`          | `setup`             |
| `agents-md-validation` | `pnpm validate-agents-md` | `setup`             |

All jobs run on Blacksmith 4-vCPU Ubuntu 24.04 runners. The `test` and `build` jobs upload performance metric and artifact reports.
