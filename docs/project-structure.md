# Fleet Pi Project Structure

Auto-generated overview of the monorepo workspace.

Start with [docs/README.md](README.md) and [docs/quickstart.md](quickstart.md) if you are new to Fleet Pi. This file is generated reference material.

## Workspace Layout

```text
fleet-pi/
├── .codex/                   # Codex local environment and bootstrap scripts
├── .pi/                      # Committed Pi config, skills, and built-in extensions
├── agent-workspace/          # Durable agent memory, plans, skills, artifacts, and installs
├── apps/web/                 # TanStack Start application
│   ├── src/routes/           # File-based API and page routes
│   ├── src/lib/pi/           # Pi runtime integration (server.ts, plan-mode.ts, chat-protocol)
│   ├── src/lib/workspace/    # agent-workspace tree and file helpers
│   ├── src/lib/pii/          # PII sanitization module
│   ├── src/lib/logger.ts     # Pino logger with redaction
│   └── src/components/pi/    # Right-panel resources, workspace, and config UI
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
| @earendil-works/pi-coding-agent      | Pi coding-agent runtime                |
| @earendil-works/pi-ai                | Pi AI primitives                       |
| Amazon Bedrock                       | Primary LLM provider                   |
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
5. The **Client** hydrates messages from the Pi session file on reload and opens supporting resources/workspace panels on demand.
6. Supporting endpoints expose models, resources, workspace files, sessions, and health checks.
7. Durable agent context lives in `agent-workspace/`, including project memory, plans, artifacts, and workspace-installed Pi resources.
