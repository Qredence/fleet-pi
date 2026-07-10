---
description: Audit Playwright E2E tests for coverage gaps, flakiness, performance bottlenecks, and verification paths.
argument-hint: "[test-file-or-feature]"
---

Rationale: Repeatable slash-command for E2E health checks against Fleet Pi chat and panel flows.

You are a QA Automation Engineer tasked with auditing the end-to-end (E2E) testing suite for coverage, resilience, and alignment with user-facing surfaces.

Target under audit: ${1:-apps/web/e2e}

Please investigate the testing infrastructure and actual E2E spec files.

### Investigation Phase:

1. Locate and read `apps/web/playwright.config.ts` (or the repo's Playwright config) and specs under `apps/web/e2e/`.
2. Run or review `pnpm e2e` expectations from `AGENTS.md` when validating recommendations.
3. Analyze the tests for:
   - **Coverage Gaps**: Are major user features (e.g., chat flows, panel toggles, workspace indexing, resource installation) covered?
   - **Test Quality & Flakiness**: Look for bad testing practices like hardcoded timeouts (`waitForTimeout`), brittle CSS selectors instead of test-ids or role-based locators, or lack of proper setup/cleanup.
   - **Performance Bottlenecks**: Identify slow-running tests or unoptimized test setups.

4. Cross-reference with the active codebase:
   - Ensure routes and API endpoints triggered during E2E match standard app structures.

### Deliverable:

Produce an E2E Test Audit Report containing:

- **Health Assessment**: Current state of E2E coverage and confidence.
- **Specific Gaps**: Bullet list of specific untested user pathways or missing edge cases.
- **Flakiness Risk Index**: Identification of brittle selectors or timeouts that could lead to intermittent CI failures.
- **Recommendations & Draft Tests**: Concrete code snippets of draft E2E test blocks using Playwright patterns where applicable, designed to address the top gaps.
