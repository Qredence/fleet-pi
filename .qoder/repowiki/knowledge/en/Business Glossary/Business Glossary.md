---
kind: business_term
name: Business Glossary
category: business_term
scope:
  - "**"
---

### Agent Workspace

- Definition：The durable, Git-native workspace directory (`agent-workspace/`) where the AI agent operates, reads memory, writes plans, creates skills, and evaluates itself. Contains project memory, active/completed/abandoned plans, evaluation rubrics, artifacts, and Pi resources. Every change is reviewable in Git and available to future sessions.
- Aliases：workspace、agent-workspace

### Pi Session

- Definition：A persistent conversation context created by Fleet Pi's Pi agent harness, scoped to the project root. Handles streaming NDJSON responses, resume after refresh, and tool calls that run on the server. Sessions are stored in `.fleet/sessions` JSONL format with local SQLite provenance.
- Aliases：session、chat session

### Trust Zone

- Definition：Deployment environment classification system distinguishing between production and preview environments. Controls database connections, CORS origins, and security policies. Set via `FLEET_PI_DEPLOYMENT_TRUST_ZONE` environment variable with values like 'preview' or 'production'.
- Aliases：trust-zone、deployment zone

### Sandbox Context

- Definition：Runtime context resolution mechanism that determines whether code execution should occur in a Daytona sandbox or locally. Used by workspace routes and chat handlers to isolate potentially unsafe operations in per-user sandboxes with durable volumes.
- Aliases：sandbox、execution context

### OpenUI Blocks

- Definition：Inline generative UI components rendered inside assistant messages within the chat interface. Built using the OpenUI renderer and agent-elements framework, allowing dynamic UI generation based on agent responses.
- Aliases：openui、generative UI

### Plan Mode

- Definition：Read-only exploration mode that generates structured plans with InputBar questions and execute/refine/stay actions. Blocks mutating commands and provides a safe way for agents to explore codebases and propose changes without immediate execution.
- Aliases：plan、planning mode

### Skill

- Definition：Reusable agent capabilities defined in TypeScript under `.agents/skills/` or `.pi/skills/`. Skills extend agent functionality with specialized tools, prompts, and behaviors. The project ships with 30+ built-in skills covering code review, architecture analysis, UI improvements, and more.
- Aliases：skills、agent skills

### BYOK (Bring Your Own Key)

- Definition：Security model where users provide their own API keys and credentials rather than relying on shared organizational keys. Applied to Daytona sandboxes (per-user `daytona` key), LLM providers (GEMINI_API_KEY), and authentication systems. Never uses org-level keys for end-user access.
- Aliases：BYOK、bring your own key
