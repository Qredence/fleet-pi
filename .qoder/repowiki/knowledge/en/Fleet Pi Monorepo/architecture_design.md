# Fleet Pi — Architecture Design

## System Architecture Overview

Fleet Pi follows a **browser-first, agent-assisted development** model:

1. **Browser Client**: React 19 SPA with TanStack Router, composed of hax-design components
2. **TanStack Start App**: Full-stack routing with API routes and SSR support
3. **Pi Runtime Layer**: In-memory session management with short TTL (10 min default)
4. **External Integrations**: Neon DB, Daytona sandboxes, configured AI providers
5. **Durable Context**: agent-workspace/ as persistent project memory

## Key Design Principles

- **Component Isolation**: No app-local components; all UI in @workspace/hax-design
- **Protocol-First**: Wire formats defined in @workspace/pi-protocol (Zod schemas)
- **Session-Based Chat**: NDJSON streaming with localStorage hydration on reload
- **Plan Mode Extension**: Read-only planning tools via web-native Pi extension
- **Vercel-First Deployment**: Settings/providers persist in Neon JSONB, not writable files
- **Neon Managed Auth Cutover**: pi_* tables use RLS with neon_auth.identity for tenancy

## Architecture Layers

### Browser Layer
- React 19 with concurrent features
- TanStack Router with file-based routes
- AgentChat component (tool calling UI)
- InputBar with slash commands & Plan mode selector
- Right panels: Resources, Workspace, Artifacts
- Settings dialog (Appearance, Sandbox, Providers, Models, Skills)

### API Layer
- /api/chat — Main chat endpoint (NDJSON stream)
- /api/chat/models — Model discovery
- /api/chat/resources — Resource catalog (skills, extensions, prompts)
- /api/chat/settings — PATCH for settings hot-reload
- /api/chat/providers — OAuth credentials management
- /api/chat/session|new|resume|abort — Session lifecycle
- /api/workspace/tree|file|item(s)|search — Workspace filesystem view
- /api/health — Health check

### Runtime Layer
- ServerRuntime: Manages live AgentSessionRuntime instances
- handleChatTurn: Orchestrates chat turns with circuit breakers
- PlanModeExtension: Blocks unsafe tools, extracts numbered plans
- resolveUserSandboxContext: Daytona integration with BYOK policy
- SettingsManager: Per-user runtime config from Neon JSONB

### Persistence Layer
- Pi sessions: JSONL files with full turn history
- Mirror tables: pi_sessions, pi_run_events, pi_user_providers, pi_user_settings
- agent-workspace/: Seeded markdown stubs, plans, memory, artifacts
- .pi/: Committed project config, skills, extensions
