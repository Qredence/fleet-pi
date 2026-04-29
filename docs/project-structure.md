# Fleet Pi Project Structure

Auto-generated overview of the monorepo workspace.

## Workspace Layout

```text
fleet-pi/
├── apps/web/                 # TanStack Start application
│   ├── src/routes/           # File-based API and page routes
│   ├── src/lib/pi/           # Pi AI integration (server.ts, plan-mode.ts, chat-protocol)
│   ├── src/lib/pii/          # PII sanitization module
│   ├── src/lib/logger.ts     # Pino logger with redaction
│   └── src/lib/api/          # API helpers and health endpoint
├── packages/ui/              # Shared React component library
│   └── src/components/
│       └── agent-elements/   # Reusable chat and tool UI
├── docs/                     # Generated and hand-written documentation
├── scripts/                  # Build and utility scripts
└── .github/workflows/        # CI/CD automation
```

## Key Dependencies

| Package                              | Purpose                                |
| ------------------------------------ | -------------------------------------- |
| @tanstack/react-start                | Full-stack React framework             |
| @mariozechner/pi-coding-agent        | Pi coding-agent runtime                |
| @mariozechner/pi-ai                  | Pi AI primitives                       |
| amazon-bedrock                       | Primary LLM provider                   |
| pino + pino-pretty                   | Structured logging                     |
| opossum                              | Circuit breaker pattern                |
| zod + @asteasolutions/zod-to-openapi | Schema validation & OpenAPI generation |
| vitest + @playwright/test            | Testing frameworks                     |
| husky + lint-staged                  | Pre-commit hooks                       |

## Data Flow

1. The **Browser** sends a user message to `/api/chat` via NDJSON stream.
2. The **Server Route** sanitizes input (PII), logs with correlation IDs, and creates or resumes a Pi session.
3. The **Pi Server Module** invokes Amazon Bedrock through a circuit breaker.
4. Streaming events (`start`, `delta`, `tool`, `done`, `error`) flow back to the client.
5. The **Client** hydrates messages from the Pi session file on reload.
6. Supporting endpoints (models, resources, sessions, health) provide metadata and lifecycle control.
