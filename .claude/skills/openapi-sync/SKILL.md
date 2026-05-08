---
name: openapi-sync
description: Regenerate the OpenAPI spec from Zod schemas after API route changes, then validate it
disable-model-invocation: true
---

Run after modifying any schemas under `apps/web/src/lib/pi/chat-protocol.zod.ts` or adding routes under `apps/web/src/routes/api/`.

Steps:

1. `pnpm --filter web generate:openapi` — regenerates `apps/web/openapi.json` from Zod schemas via `@asteasolutions/zod-to-openapi`
2. `pnpm --filter web exec swagger-cli validate openapi.json` — validates the output spec
3. Report any validation errors, or confirm the spec is clean and show the output path
