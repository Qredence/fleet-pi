Tests are run with Vitest; each test file sets up a temporary project root via `mkdtempSync` and controls `FLEET_PI_REPO_ROOT` through `beforeEach`/`afterEach` hooks to isolate chat provenance data.
