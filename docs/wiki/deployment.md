# Deployment

## Building for production

Run the following from the repository root to build all workspaces:

```bash
pnpm build
```

This invokes the Turborepo pipeline, which builds `packages/hax-design` first and then `apps/web`. The TanStack Start / Nitro build outputs a self-contained server bundle at:

```
apps/web/.output/server/index.mjs   # Nitro HTTP server entry point
apps/web/.output/public/            # Static assets (JS, CSS, fonts, images)
```

A bundle size report is written to `apps/web/bundle-report/stats.html` after each successful build.

## Running in production

Start the server with Node.js 22 or later:

```bash
node apps/web/.output/server/index.mjs
```

The server listens on port `3000` by default. The `PORT` environment variable overrides this where supported by the Nitro adapter.

### Required environment variables at runtime

| Variable                                    | Required                      | Description                                                                                               |
| ------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| `AWS_REGION`                                | Yes (defaults to `us-east-1`) | AWS region for Bedrock API calls                                                                          |
| `AWS_PROFILE`                               | No                            | AWS named profile when using local credentials                                                            |
| `AWS_BEARER_TOKEN_BEDROCK`                  | No                            | Direct Bedrock bearer token (alternative to profile/role)                                                 |
| `BETTER_AUTH_SECRET`                        | Yes                           | Secret key used to sign session tokens                                                                    |
| `BETTER_AUTH_URL`                           | Yes                           | Public base URL of the deployment (e.g. `https://fleet-pi.example.com`)                                   |
| `BETTER_AUTH_TRUSTED_ORIGINS`               | No                            | Comma-separated list of trusted origins in addition to `BETTER_AUTH_URL`                                  |
| `FLEET_PI_REPO_ROOT`                        | No                            | Absolute path to the project root the agent workspace targets                                             |
| `FLEET_PI_RUNTIME_TTL_MS`                   | No                            | Milliseconds to keep live Pi runtimes in memory (default: 600000 = 10 min)                                |
| `FLEET_PI_AUTH_DATABASE_URL`                | No                            | Neon Postgres connection string for authentication tables; uses SQLite at `.fleet/auth.sqlite` when unset |
| `FLEET_PI_CHAT_DATABASE_URL`                | No                            | Neon Postgres connection string for mirroring Pi session data                                             |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | No                            | Enables Google OAuth sign-in via Better Auth                                                              |
| `DAYTONA_API_KEY`                           | No                            | Enables Daytona sandbox isolation for file and bash tool execution                                        |

AWS credentials follow the standard SDK resolution chain (environment variables → named profile → instance role). No special Fleet Pi configuration is needed beyond setting `AWS_REGION`.

## CI/CD

### Continuous integration

The CI workflow at `.github/workflows/ci.yml` runs on every pull request (opened, synchronized, or reopened) and on every push to `main`.

**Job graph:**

```
setup
├── lint          (parallel with typecheck, syncpack, knip, jscpd, tech-debt, agents-md-validation)
├── typecheck     (parallel)
├── syncpack      (parallel)
├── knip          (parallel)
├── jscpd         (parallel)
├── tech-debt     (parallel)
└── agents-md-validation (parallel)

lint + typecheck →
├── test          (parallel with build)
└── build         (parallel)
```

All jobs run on Blacksmith 4vCPU Ubuntu 24.04 (`blacksmith-4vcpu-ubuntu-2404`) with Node.js 22. The `setup` job installs dependencies with `pnpm install --frozen-lockfile`; each downstream job reinstalls from cache independently.

**What each job does:**

- **setup** – installs `node_modules` and primes the pnpm cache
- **lint** – runs `pnpm lint` across all workspaces
- **typecheck** – runs `pnpm typecheck` across all workspaces
- **syncpack** – checks that dependency version ranges are consistent across packages
- **knip** – detects unused exports and dead code
- **jscpd** – checks for duplicated code blocks; uploads an HTML report as a CI artifact
- **tech-debt** – scans for `TODO`, `FIXME`, and similar markers; uploads a JSON report
- **agents-md-validation** – runs `pnpm validate-agents-md` to verify that commands listed in `AGENTS.md` are accurate
- **test** – runs `pnpm --filter web test` and uploads a JSON/Markdown timing artifact
- **build** – runs `pnpm build` and uploads a timing artifact plus the bundle report

Concurrent runs for the same PR or branch are cancelled automatically via the `concurrency` key.

### Release workflow

The release workflow at `.github/workflows/release.yml` triggers when a tag matching `v*` is pushed. It mirrors the CI job graph (setup → lint + typecheck + syncpack + knip + jscpd in parallel → test + build in parallel) and then runs a final **release** job that:

1. Generates a changelog from commit messages since the previous `v*` tag, grouped into Features, Bug Fixes, Documentation, and Other Changes sections.
2. Creates a GitHub Release using `gh release create` with the generated changelog as the release notes body.

The release job requires `contents: write` permission and uses `GITHUB_TOKEN` for the GitHub CLI call.

## Devcontainer

The repository ships a VS Code devcontainer at `.devcontainer/devcontainer.json`. Opening the project in a devcontainer gives a pre-configured environment with:

- Node.js 22
- pnpm
- Git and recommended VS Code extensions
- Port `3000` forwarded automatically
- `pnpm install` runs automatically after container creation

The devcontainer is intended for local development only. Production deployments should use the build output described above.
