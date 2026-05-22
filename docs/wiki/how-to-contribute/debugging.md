# Debugging

## Common Errors and Fixes

### AWS credentials missing → Bedrock authentication failure

**Symptom:** The chat stream returns an error event with a message like `UnrecognizedClientException` or `The security token included in the request is invalid`.

**Cause:** Pi uses Amazon Bedrock to power the AI. Standard AWS credential resolution is used — environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`), a named profile (`AWS_PROFILE`), or an IAM role. If none are present, Bedrock calls fail immediately.

**Fix:**

1. Verify credentials are configured: `aws sts get-caller-identity`
2. Set `AWS_REGION` in your `.env` (defaults to `us-east-1` if unset).
3. For temporary credentials with bearer-token auth, set `AWS_BEARER_TOKEN_BEDROCK`.

### Daytona API key missing → sandboxes disabled

**Symptom:** The `/api/sandbox/preview` endpoint returns `503 Sandbox not available`. The app continues to function normally — Daytona sandboxes are an optional feature.

**Cause:** `DAYTONA_API_KEY` is not set. The Daytona integration is disabled when the key is absent.

**Fix:** If you need sandbox functionality locally, set `DAYTONA_API_KEY` and optionally `DAYTONA_API_URL` in your `.env`. If you don't need sandboxes, ignore the 503 — the rest of the app is unaffected.

### Session file path issues → fresh session fallback

**Symptom:** After a page refresh, the chat starts a brand-new session instead of restoring the previous one. No error is shown.

**Cause:** The browser stores Pi session metadata in `localStorage` (`sessionFile`, `sessionId`). If the stored `sessionFile` path points outside the active `projectRoot`, or the file no longer exists, the server silently starts a fresh project-scoped session.

**How to reproduce deliberately:** Set `sessionFile` in `localStorage` to `/etc/hosts`. The app should silently recover rather than showing an outside-session error.

**Fix:** Clear `localStorage` to reset to a fresh state. If sessions are consistently failing to hydrate, verify that `FLEET_PI_REPO_ROOT` is correctly set (or that the app is being started from the expected working directory).

### Circuit breaker open

**Symptom:** API calls to the Pi backend fail with a circuit-breaker error after repeated failures.

**Cause:** The server uses `opossum` to wrap calls to the Pi runtime. After a configurable number of consecutive failures the circuit opens and requests are rejected immediately without hitting Bedrock.

**Fix:** The circuit closes automatically after the timeout expires. To force an immediate reset, restart the dev server. Check server logs for the upstream error that triggered the open state.

## Using Pino Logs

The server logs structured JSON via `pino`. In development, `pino-pretty` formats output for readability. Log level is controlled by the `LOG_LEVEL` environment variable (default: `info`).

To see verbose logs:

```bash
LOG_LEVEL=debug pnpm dev
```

Each request gets a `requestId` (generated or taken from the `x-request-id` header) that appears in every log line for that request. Use it to correlate log lines across a single chat request.

## Inspecting the NDJSON Stream

The `/api/chat` endpoint returns newline-delimited JSON. You can inspect the raw stream with `curl`:

```bash
curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "say hello", "mode": "agent"}' \
  | while IFS= read -r line; do echo "$line" | jq .; done
```

Each line is a `ChatStreamEvent` JSON object. Event types: `start`, `delta`, `tool`, `plan`, `state`, `queue`, `thinking`, `compaction`, `retry`, `done`, `error`. See [`apps/web/src/lib/pi/chat-protocol.ts`](../../../apps/web/src/lib/pi/chat-protocol.ts) for the full union type.

## localStorage Session Metadata

The browser client stores session metadata in `localStorage` under a key derived from the app origin. The shape is:

```json
{
  "sessionFile": "/absolute/path/to/.pi/sessions/abc123.jsonl",
  "sessionId": "abc123"
}
```

On page load the client sends this metadata with each chat request so the server can resume the right Pi session. Inspect and clear it via browser DevTools → Application → Local Storage.

## Auth / Session Cookies

Fleet Pi uses Better Auth with TanStack Start cookies. If you see 401 responses from the API, check that:

1. `BETTER_AUTH_SECRET` is set.
2. The auth database is accessible (SQLite at `.fleet/auth.sqlite` by default, or Neon Postgres if `FLEET_PI_AUTH_DATABASE_URL` is set).
3. The session cookie is present in the browser.

## Neon Postgres Mirror Failures

When `FLEET_PI_CHAT_DATABASE_URL` is set, session data is mirrored to Neon asynchronously. Mirror failures are logged but do not interrupt the chat stream — Pi JSONL files remain the source of truth. If mirror writes are consistently failing, check the connection string and Neon project status.
