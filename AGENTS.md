# AGENTS.md

## Project Conventions

- Use `pnpm` from the repository root for dependency and task commands.
- The root `pnpm-lock.yaml` is the canonical lockfile; do not create nested app lockfiles.
- Run workspace commands with `pnpm --filter <workspace> <script>` when only one package is affected.

## Validation

- Install/update dependencies with `pnpm install`.
- Type-check with `pnpm typecheck`.
- Lint with `pnpm lint`.
- Build with `pnpm build`.

## Architecture Notes

- `apps/web` is a TanStack Start app. File routes are generated into `apps/web/src/routeTree.gen.ts`; do not edit that generated file manually.
- `packages/ui` contains shared React UI components exported under `@workspace/ui/*`.
- Chat UI types live in `packages/ui/src/components/agent-elements/chat-types.ts`.

## AI Integration

- The chat backend uses `@mariozechner/pi-ai`, not Vercel AI SDK.
- The primary provider is Amazon Bedrock via Pi's `amazon-bedrock` provider.
- The chat API route is `apps/web/src/routes/api/chat.ts`.
- The browser chat client consumes newline-delimited JSON events from `/api/chat`.
- Bedrock credentials should come from standard AWS environment/profile configuration. `AWS_REGION` defaults to `us-east-1` when unset.
