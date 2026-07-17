# Patterns and conventions

## Project conventions

- **Package manager:** pnpm only. Never run `npm install` or `yarn` in this repo.
- **Monorepo commands:** Run from the repo root using `pnpm --filter <workspace> <script>` for workspace-scoped work. `turbo` handles caching and parallelism.
- **File-based routing:** `apps/web/src/routes/` is TanStack Router territory. Never edit `src/routeTree.gen.ts` manually — it is auto-generated on `pnpm dev`.
- **Component imports:** Use `@workspace/hax-design/components/<name>` for shared UI components, never relative cross-package imports.
- **shadcn components:** Always install from the repo root targeting the web app: `pnpm dlx shadcn@latest add <component> -c apps/web`. shadcn places output in `packages/hax-design`.

## Code style

- **Prettier:** 80-char line width, 2-space indent, no semicolons. Tailwind classes sorted via `prettier-plugin-tailwindcss`.
- **Path aliases:** `@/*` → `apps/web/src/*`, `@workspace/hax-design/*` → `packages/hax-design/src/*`.
- **Tailwind CSS v4:** No `tailwind.config.js`. All design tokens live in `packages/hax-design/src/styles/globals.css`.
- **No explicit `any`:** TypeScript strict mode is on. Use proper types or `unknown` + narrowing.
- **ESLint rules of note:** Complexity cap (≤ 10), max-lines warning (300), `@typescript-eslint/naming-convention` for consistent casing.

## React patterns

- React 19 is the target. Use `use()`, server actions, and concurrent features where appropriate.
- Prefer `@tanstack/react-query` hooks (`useQuery`, `useMutation`) for all server state. The query client is provided in `apps/web/src/lib/query-client.ts`.
- Custom hooks for chat state live under `apps/web/src/lib/pi/use-*.ts`. Follow the naming pattern.
- No `useEffect` for derived state — compute it during render or use `useMemo`.

## API routes

- API routes are TanStack Start file routes under `apps/web/src/routes/api/`. Each file exports a `Route` created with `createFileRoute`.
- All chat API responses are NDJSON streams (`ChatStreamEvent` lines) or JSON objects typed in `packages/pi-protocol/src/chat-protocol.ts`.
- Validate request bodies with Zod schemas from `chat-protocol.zod.ts`. Use `RequestContextError` from `app-runtime.ts` for structured HTTP errors.

## Error handling

- Server-side errors that should propagate to the client use `RequestContextError(message, status)` from `apps/web/src/lib/app-runtime.ts`.
- `getResponseStatus(error)` extracts the HTTP status from any thrown value.
- Chat streaming errors are emitted as `{type: "error", message: string}` NDJSON events — never crash the stream silently.
- Bedrock calls are wrapped in an Opossum circuit breaker (`apps/web/src/lib/pi/circuit-breaker.ts`). When the breaker is open, a graceful fallback error is returned.

## Logging

- Use `pino` via `apps/web/src/lib/logger.ts`. Call `createRequestLogger(requestId)` in API route handlers.
- Never log PII. Pass user content through `sanitizePii()` from `apps/web/src/lib/pii/sanitizer.ts` before logging.
- Log levels: `debug` for verbose trace, `info` for normal operations, `warn` for degraded-but-recoverable states, `error` for unexpected failures.

## Pi integration

- Never import `@earendil-works/pi-coding-agent` directly from React components. All Pi interaction goes through the server-side `apps/web/src/lib/pi/server*.ts` modules and the `/api/chat*` endpoints.
- `server.ts` is the public re-export surface; use it rather than importing individual `server-*.ts` files.
- The runtime cache in `server-runtime.ts` holds live `AgentSessionRuntime` instances. Always use `retainPiRuntime` / `releasePiRuntime` rather than creating runtimes ad hoc.

## Testing

- Unit tests: Vitest, colocated as `*.test.ts` / `*.spec.ts` next to the source file.
- E2E tests: Playwright under `apps/web/e2e/`.
- Coverage thresholds are enforced in `vitest.config.ts`. Do not reduce them.
- Mock Pi sessions with lightweight JSONL fixtures rather than calling Bedrock in tests.
