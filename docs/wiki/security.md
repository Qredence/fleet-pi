# Security

## Trust boundaries and tool scoping

Pi tools (read, write, edit, bash) execute on the server inside the Node.js process. All file path operations are validated against `projectRoot` before execution. The workspace contract module (`apps/web/src/lib/pi/workspace-contract.ts`) rejects any path that would escape the project root via path traversal, symlink abuse, or absolute path injection.

Bash commands in **Plan mode** are evaluated by `apps/web/src/lib/pi/command-policy.ts` before reaching Pi. The policy enforces a strict allowlist:

- Shell metacharacters — command substitution (`$(…)`, backticks), redirections (`>`, `>>`), process substitution — are blocked outright.
- Command separators (`;`, `&&`, `||`) are not allowed.
- A fixed set of mutating commands (`rm`, `mv`, `chmod`, `sudo`, `kill`, `systemctl`, etc.) and all network commands (`curl`, `wget`, `nc`, `ssh`, etc.) are blocked.
- Only commands in a known read-only set (`cat`, `grep`, `find`, `ls`, `git status/log/diff/show`, `pnpm list`, etc.) are permitted.
- Excessively long commands (> 10 000 characters) and control characters are rejected to prevent injection and denial-of-service.

In **Agent mode** the full Pi bash tool is available; tool execution remains scoped to the active `projectRoot` but is not restricted to the read-only command set.

## Authentication

Authentication is provided by Better Auth (`apps/web/src/lib/auth/server.ts`):

- **Email and password** sign-in is enabled by default.
- **Google OAuth** is enabled when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set. Account linking with Google is allowed for existing email/password accounts.
- Session management uses the `tanstackStartCookies` adapter, which sets secure HTTP-only session cookies via TanStack Start's server-side cookie API.
- Auth endpoints are mounted at `/api/auth/$` (all Better Auth routes).
- The `secret` field uses `BETTER_AUTH_SECRET`. Production deployments must set this to a strong random value.
- Trusted origins are controlled by `BETTER_AUTH_TRUSTED_ORIGINS` (comma-separated). When unset, only `BETTER_AUTH_URL` and common local development ports are trusted.

**Database backend:**

By default, Better Auth uses a SQLite file at `.fleet/auth.sqlite` relative to the project root. This is appropriate for single-user local use. For multi-user deployments, set `FLEET_PI_AUTH_DATABASE_URL` to a Neon Postgres (or compatible) connection string; Better Auth will use the Neon serverless driver instead.

The auth schema (user, session, account, verification tables) is created automatically by `migrateAuthSchema` on first run when SQLite is in use.

## PII sanitization

The module at `apps/web/src/lib/pii/sanitizer.ts` provides `sanitizePii(text)`, which scrubs user-supplied content before it is passed to logging or external systems. It replaces:

- Email addresses matching a standard pattern with `[EMAIL_REDACTED]`
- Phone numbers (7+ digits, various formats including international prefixes) with `[PHONE_REDACTED]`

The chat API calls this sanitizer on user message content before forwarding it to Pi.

## URL security

The extension library at `.pi/extensions/lib/url-security.ts` provides `isPrivateNetworkAddress(host)`, used by the `fetch_content` tool to block requests to private and internal network addresses. Blocked ranges include loopback (127.0.0.0/8, `::1`), RFC 1918 private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), link-local (169.254.0.0/16), and ULA/link-local IPv6. The `fetch_content` tool is only available in Agent and Harness mode, not Plan mode.

## Daytona sandbox isolation

When `DAYTONA_API_KEY` is set, Pi file and bash tools run inside a Daytona container rather than the host filesystem. This provides:

- Process isolation: tool execution happens in a separate container with no access to host system files.
- Filesystem isolation: writes are contained within the sandbox volume.
- Optional network blocking: the `networkBlockAll` option can prevent the sandbox from making outbound network calls.

Without `DAYTONA_API_KEY`, tools run directly in the server process. Daytona is recommended for multi-tenant or public-facing deployments.

## Circuit breaker

Bedrock API calls are wrapped with an Opossum circuit breaker (`apps/web/src/lib/pi/circuit-breaker.ts`). Configuration:

| Parameter                  | Value      |
| -------------------------- | ---------- |
| `errorThresholdPercentage` | 50%        |
| `volumeThreshold`          | 5 requests |
| `timeout`                  | 30 seconds |
| `resetTimeout`             | 30 seconds |

When the error rate exceeds 50% over at least 5 requests, the breaker opens and subsequent calls fail immediately with a user-visible error rather than hammering Bedrock. The breaker resets after 30 seconds.

## Dependency management

Dependabot is configured for the npm/pnpm ecosystem. It opens automated PRs for dependency updates. Transitive vulnerabilities are resolved via `overrides` in `package.json` where no direct-dependency update is available. Dependency version consistency across packages is enforced by `syncpack` in both CI and the release workflow.

## Vulnerability reporting

Refer to `SECURITY.md` for the full security policy. In summary:

- Do not open public GitHub issues for security reports.
- Use GitHub's private vulnerability reporting for this repository.
- If private reporting is unavailable, contact the maintainers privately through GitHub.
- Reports should include a description, affected files or routes, reproduction steps, and any mitigation ideas.
- The maintainers aim to acknowledge reports within 3 business days.

Only the `main` branch is supported for security fixes. Older tags and branches are not patched.
