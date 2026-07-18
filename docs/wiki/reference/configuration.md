# Configuration

Fleet Pi is configured through environment variables and a project-local settings file at `.pi/settings.json`. Copy `.env.example` to `.env` in the repo root for local development.

---

## Environment Variables

### Google Gemini (default chat provider)

| Variable         | Default | Description                                                                                             |
| ---------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| `GEMINI_API_KEY` | —       | **Required for default chat.** API key from [Google AI Studio](https://aistudio.google.com/app/apikey). |

Pi's `google` provider maps to `GEMINI_API_KEY`. `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are for Better Auth login only — they do not power chat.

The dev server loads repo-root `.env`, then `.env.local` (`.env.local` wins). Credentials saved from the Configurations UI are written to `.env.local`.

### AWS / Amazon Bedrock

| Variable                   | Default     | Description                                                                                    |
| -------------------------- | ----------- | ---------------------------------------------------------------------------------------------- |
| `AWS_REGION`               | `us-east-1` | AWS region used for Bedrock calls.                                                             |
| `AWS_PROFILE`              | —           | Named AWS profile from `~/.aws/credentials`. Leave unset to use default credential resolution. |
| `AWS_BEARER_TOKEN_BEDROCK` | —           | Bearer token for Bedrock setups that use token-based auth instead of access keys.              |

Standard AWS credential resolution applies: environment variables (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`) take precedence, then named profiles, then IAM roles. `AWS_REGION` defaults to `us-east-1` if unset.

### Pi Agent

| Variable                  | Default           | Description                                                                                                      |
| ------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| `PI_AGENT_DIR`            | —                 | Override the Pi agent resource directory. Leave unset to use the Pi default.                                     |
| `FLEET_PI_REPO_ROOT`      | `process.cwd()`   | Absolute path to the repository root. Pi sessions, workspace files, and tool calls are scoped to this directory. |
| `FLEET_PI_RUNTIME_TTL_MS` | `600000` (10 min) | How long a Pi `AgentSessionRuntime` is kept alive in memory between chat turns before being released.            |

### Logging

| Variable    | Default | Description                                                                       |
| ----------- | ------- | --------------------------------------------------------------------------------- |
| `LOG_LEVEL` | `info`  | Pino log level. Valid values: `trace`, `debug`, `info`, `warn`, `error`, `fatal`. |

### Authentication (Better Auth)

| Variable                               | Default                        | Description                                                                                                                    |
| -------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `BETTER_AUTH_SECRET`                   | —                              | **Required when auth is enabled.** Secret used to sign sessions. Generate with `openssl rand -base64 32`.                      |
| `BETTER_AUTH_URL`                      | `http://localhost:3000`        | Base URL used to construct OAuth callback URLs. Set to your deployment URL in production.                                      |
| `BETTER_AUTH_TRUSTED_ORIGINS`          | Derived from `BETTER_AUTH_URL` | Comma-separated list of trusted origins for CSRF checks.                                                                       |
| `FLEET_PI_AUTH_DATABASE_URL`           | —                              | Neon Postgres connection string for the auth database (DML role only). When unset, auth data is stored in a local SQLite file. |
| `FLEET_PI_AUTH_MIGRATION_DATABASE_URL` | —                              | Neon Postgres connection string with full DDL privileges. Required only when running `pnpm --filter web auth:migrate`.         |
| `AUTH_DATABASE_PATH`                   | `<repo>/.fleet/auth.sqlite`    | Custom path for the local SQLite auth database. Ignored when `FLEET_PI_AUTH_DATABASE_URL` is set.                              |

### Google OAuth (optional)

| Variable               | Default | Description                                                                       |
| ---------------------- | ------- | --------------------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | —       | Google OAuth app client ID. The Google login button is hidden when this is unset. |
| `GOOGLE_CLIENT_SECRET` | —       | Google OAuth app client secret.                                                   |

### Chat Session Mirror (Neon Postgres)

| Variable                               | Default | Description                                                                                                                                                                                                                                                |
| -------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FLEET_PI_CHAT_DATABASE_URL`           | —       | Neon Postgres connection string (DML role only). When set, Pi session entries, run events, tool executions, and file mutations are mirrored to Neon asynchronously. Pi JSONL files remain the source of truth; mirror failures do not interrupt streaming. |
| `FLEET_PI_CHAT_MIGRATION_DATABASE_URL` | —       | Neon Postgres connection string with full DDL privileges. Required only when running `pnpm chat:migrate`.                                                                                                                                                  |

### Daytona Sandboxes (optional)

| Variable                  | Default                                    | Description                                                                                                                                                             |
| ------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DAYTONA_API_KEY`         | —                                          | Local/dev Daytona API key fallback. On Vercel, each user must BYOK a `daytona` provider secret in `pi_user_providers` — env alone does not enable Daytona.              |
| `DAYTONA_API_URL`         | `https://app.daytona.io/api`               | Daytona API base URL. The SDK default is used when unset.                                                                                                               |
| `DAYTONA_TARGET`          | —                                          | Daytona target (region/runner). Leave unset to use the Daytona default.                                                                                                 |
| `DAYTONA_WEBHOOK_SECRET`  | —                                          | Shared secret expected in the `x-daytona-signature` header for incoming Daytona webhooks. When unset, webhook side effects are skipped but requests are still accepted. |
| `FLEET_PI_REPOSITORY_URL` | `https://github.com/Qredence/fleet-pi.git` | HTTPS repo URL used to sparse-seed `agent-workspace/` into empty Daytona volumes.                                                                                       |

---

## `.pi/settings.json`

Project-local Pi settings are stored in `.pi/settings.json` at the repo root. These override the global Pi defaults. The file is read at runtime and can be edited through the Configurations tab in the UI or by patching `PATCH /api/chat/settings`.

Supported fields:

| Field                         | Type                                                           | Description                                                                       |
| ----------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `defaultProvider`             | `string`                                                       | Default Pi provider (e.g. `"amazon-bedrock"`).                                    |
| `defaultModel`                | `string`                                                       | Default model ID within the provider.                                             |
| `defaultThinkingLevel`        | `"off" \| "minimal" \| "low" \| "medium" \| "high" \| "xhigh"` | Default reasoning/thinking level for models that support it.                      |
| `enabledModels`               | `string[]`                                                     | Allowlist of model keys. When set, only listed models appear in the model picker. |
| `enableSkillCommands`         | `boolean`                                                      | Whether Pi skill slash commands are enabled.                                      |
| `skills`                      | `string[]`                                                     | Paths or names of Pi skills to load.                                              |
| `prompts`                     | `string[]`                                                     | Paths or names of Pi prompt files to load.                                        |
| `extensions`                  | `string[]`                                                     | Paths to Pi extension directories to load.                                        |
| `packages`                    | `string[] \| object[]`                                         | Pi packages to activate (npm package names or objects with config).               |
| `themes`                      | `string[]`                                                     | Pi theme files to load.                                                           |
| `transport`                   | `"auto" \| "sse" \| "websocket"`                               | Streaming transport preference.                                                   |
| `steeringMode`                | `"all" \| "one-at-a-time"`                                     | How steering prompts are delivered to the agent.                                  |
| `followUpMode`                | `"all" \| "one-at-a-time"`                                     | How follow-up prompts are delivered.                                              |
| `compaction.enabled`          | `boolean`                                                      | Whether context compaction is enabled.                                            |
| `compaction.reserveTokens`    | `number`                                                       | Token budget reserved after compaction.                                           |
| `compaction.keepRecentTokens` | `number`                                                       | Recent token window kept verbatim during compaction.                              |
| `retry.enabled`               | `boolean`                                                      | Whether automatic retry on transient errors is enabled.                           |
| `retry.maxRetries`            | `number`                                                       | Maximum number of retry attempts.                                                 |
| `retry.baseDelayMs`           | `number`                                                       | Base delay in milliseconds between retries (exponential backoff).                 |

Provider credentials (AWS keys, etc.) belong in environment variables, not in `.pi/settings.json`.
