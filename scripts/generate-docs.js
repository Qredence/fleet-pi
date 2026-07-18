#!/usr/bin/env node
/**
 * Doc generation script for Fleet Pi.
 *
 * Produces:
 *   - docs/api.md              — Markdown API reference from openapi.json
 *   - docs/architecture.mmd    — Mermaid architecture diagram
 *   - docs/architecture.md     — Markdown wrapper for the architecture diagram
 *   - docs/project-structure.md — Project structure overview
 */

import { execSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const repoRoot = join(__dirname, "..")
const docsDir = join(repoRoot, "docs")
const webDir = join(repoRoot, "apps", "web")

// Ensure docs directory exists
if (!existsSync(docsDir)) {
  mkdirSync(docsDir, { recursive: true })
}

// ─── 1. Refresh OpenAPI JSON ───
console.log("Refreshing openapi.json...")
try {
  execSync("pnpm --filter web generate:openapi", {
    cwd: repoRoot,
    stdio: "inherit",
  })
} catch {
  console.error(
    "Failed to generate openapi.json, using existing file if available"
  )
}

// ─── 2. Generate API docs from OpenAPI ───
const openapiPath = join(webDir, "openapi.json")
if (!existsSync(openapiPath)) {
  console.error("openapi.json not found at", openapiPath)
  process.exit(1)
}

const openapi = JSON.parse(readFileSync(openapiPath, "utf-8"))

let apiMd = `# Fleet Pi API Reference\n\n`
apiMd += `Generated from \`openapi.json\`.\n\n`
apiMd += `Start with [docs/README.md](README.md) and [docs/quickstart.md](quickstart.md) if you are new to the project. This file is generated reference material.\n\n`
apiMd += `**Base URL:** \`${openapi.servers?.[0]?.url ?? "http://localhost:3000"}\`\n\n`
apiMd += `---\n\n`

for (const [path, methods] of Object.entries(openapi.paths ?? {})) {
  for (const [method, spec] of Object.entries(methods)) {
    const title = `${method.toUpperCase()} ${path}`
    apiMd += `## ${title}\n\n`
    if (spec.description) {
      apiMd += `${spec.description}\n\n`
    }

    if (spec.requestBody?.content?.["application/json"]?.schema) {
      apiMd += `### Request Body\n\n`
      apiMd += formatSchema(spec.requestBody.content["application/json"].schema)
      apiMd += `\n`
    }

    if (spec.parameters?.length) {
      apiMd += `### Parameters\n\n`
      apiMd += `| Name | In | Required | Description |\n`
      apiMd += `|------|-----|----------|-------------|\n`
      for (const param of spec.parameters) {
        const required = param.required ? "Yes" : "No"
        apiMd += `| \`${param.name}\` | ${param.in} | ${required} | ${param.description ?? ""} |\n`
      }
      apiMd += `\n`
    }

    if (spec.responses) {
      apiMd += `### Responses\n\n`
      for (const [code, response] of Object.entries(spec.responses)) {
        apiMd += `- **${code}** — ${response.description ?? ""}\n`
        const schema =
          response.content?.["application/json"]?.schema ??
          response.content?.["application/x-ndjson"]?.schema ??
          response.content?.["text/plain"]?.schema
        if (schema) {
          apiMd += formatSchema(schema, 1)
        }
      }
      apiMd += `\n`
    }

    apiMd += `---\n\n`
  }
}

writeFileSync(join(docsDir, "api.md"), `${apiMd.trimEnd()}\n`)
console.log("docs/api.md written")

// ─── 3. Generate architecture Mermaid diagram ───
const mermaid = `%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e1f5fe', 'primaryTextColor': '#01579b', 'primaryBorderColor': '#0288d1', 'lineColor': '#0288d1', 'secondaryColor': '#fff3e0', 'tertiaryColor': '#e8f5e9'}}}%%
graph TD
    subgraph Client["Browser Client"]
        React[React 19 + TanStack Router]
        AgentChat[AgentChat Component]
        InputBar[InputBar Component]
        MessageList[MessageList Component]
        RightPanels[Resources and Workspace Panels]
    end

    subgraph WebApp["apps/web — TanStack Start"]
        Vite[Vite Dev Server]
        API[API Routes]
        ChatRoute[/api/chat]
        HandleChatTurn[handleChatTurn]
        HealthRoute[/api/health]
        ModelsRoute[/api/chat/models]
        ResourcesRoute[/api/chat/resources]
        SessionRoute[/api/chat/session]
        WorkspaceRoutes[/api/workspace/*]
        PiServer[Pi Server Module]
        SandboxContext[resolveUserSandboxContext]
        PlanMode[Plan Mode Extension]
        WorkspaceServer[Workspace Server]
        ResourceCatalog[Workspace Resource Catalog]
        CircuitBreaker[Circuit Breaker]
        Logger[Pino Logger]
        Sanitizer[PII Sanitizer]
    end

    subgraph AgentWorkspace["agent-workspace"]
        Memory[Project Memory]
        Plans[Plans and Backlog]
        Skills[Skills and Evals]
        PiResources[Installed Pi Resources]
        Artifacts[Artifacts and Scratch]
    end

    subgraph ProjectPi[".pi"]
        PiConfig[settings.json]
        PiExtensions[Built-in Pi Extensions]
        PiSkills[Committed Pi Skills]
    end

    subgraph Protocol["packages/pi-protocol — Wire format"]
        ChatTypes[ChatMessage and ChatStreamEvent]
        ZodSchemas[Zod schemas and model patterns]
        ProviderIds[Provider credential IDs]
        OpenUIPrompt[buildOpenUIPrompt]
    end

    subgraph UI["packages/hax-design — Shared UI"]
        FleetPi[fleet-pi shell and panels]
        AgentElements[agent-elements]
        OpenUIRenderer[openui renderer]
        Shadcn[shadcn/base-nova primitives]
        Styles[Tailwind CSS v4]
    end

    subgraph External["External Services"]
        GoogleGemini[Google Gemini via Pi google provider]
        Daytona[Daytona per-user sandboxes]
    end

    React --> AgentChat
    AgentChat --> InputBar
    AgentChat --> MessageList
    AgentChat --> RightPanels
    React --> Vite
    Vite --> API
    API --> ChatRoute
    API --> HealthRoute
    API --> ModelsRoute
    API --> ResourcesRoute
    API --> SessionRoute
    API --> WorkspaceRoutes
    ChatRoute --> HandleChatTurn
    HandleChatTurn --> PiServer
    ChatRoute --> Sanitizer
    ChatRoute --> Logger
    PiServer --> CircuitBreaker
    CircuitBreaker --> GoogleGemini
    PiServer --> SandboxContext
    SandboxContext --> Daytona
    PiServer --> PlanMode
    PiServer --> PiConfig
    PiServer --> PiExtensions
    PiServer --> PiSkills
    ResourcesRoute --> ResourceCatalog
    WorkspaceRoutes --> SandboxContext
    WorkspaceRoutes --> WorkspaceServer
    ResourceCatalog --> PiResources
    WorkspaceServer --> Memory
    WorkspaceServer --> Plans
    WorkspaceServer --> Skills
    WorkspaceServer --> Artifacts
    AgentChat --> FleetPi
    FleetPi --> AgentElements
    AgentElements --> Shadcn
    AgentElements --> Styles
    AgentElements --> ChatTypes
    PiServer --> ChatTypes
    HandleChatTurn --> ChatTypes
    OpenUIRenderer --> OpenUIPrompt
`

writeFileSync(join(docsDir, "architecture.mmd"), mermaid)
console.log("docs/architecture.mmd written")

const architectureMd = `# Fleet Pi Architecture

Generated overview of the current runtime boundaries.

Start with [docs/README.md](README.md) and [docs/quickstart.md](quickstart.md)
if you are new to Fleet Pi. This file is generated reference material.

\`\`\`mermaid
${mermaid}
\`\`\`
`

writeFileSync(join(docsDir, "architecture.md"), architectureMd)
console.log("docs/architecture.md written")

// ─── 4. Generate project-structure.md ───
let structMd = `# Fleet Pi Project Structure\n\n`
structMd += `Auto-generated overview of the monorepo workspace.\n\n`
structMd += `Start with [docs/README.md](README.md) and [docs/quickstart.md](quickstart.md) if you are new to Fleet Pi. This file is generated reference material.\n\n`
structMd += `## Workspace Layout\n\n`
structMd += "\`\`\`text\n"
structMd += `fleet-pi/\n`
structMd += `├── .codex/                   # Codex local environment and bootstrap scripts\n`
structMd += `├── .pi/                      # Committed Pi config, skills, and built-in extensions\n`
structMd += `├── agent-workspace/          # Durable agent memory, plans, skills, artifacts, and installs\n`
structMd += `├── apps/web/                 # TanStack Start application\n`
structMd += `│   ├── src/routes/           # File-based API and page routes\n`
structMd += `│   ├── src/lib/pi/           # Pi runtime (handleChatTurn, server-runtime, plan-mode)\n`
structMd += `│   ├── src/lib/daytona/      # resolveUserSandboxContext and sandbox adapters\n`
structMd += `│   ├── src/lib/workspace/    # agent-workspace tree and file helpers\n`
structMd += `│   ├── src/lib/pii/          # PII sanitization module\n`
structMd += `│   ├── src/lib/logger.ts     # Pino logger with redaction\n`
structMd += `│   └── (routes compose hax-design only — no app-local components)\n`
structMd += `├── packages/hax-design/      # Shared React UI (fleet-pi, agent-elements, openui)\n`
structMd += `│   └── src/components/\n`
structMd += `│       ├── fleet-pi/         # Product shell, panels, Settings\n`
structMd += `│       └── agent-elements/   # Reusable chat and tool UI\n`
structMd += `├── packages/pi-protocol/     # Wire-format types, Zod, provider IDs, OpenUI prompt\n`
structMd += `├── docs/                     # Generated and hand-written documentation\n`
structMd += `├── scripts/                  # Build and utility scripts\n`
structMd += `└── .github/workflows/        # CI/CD automation\n`
structMd += "\`\`\`\n\n"

structMd += `## Key Dependencies\n\n`
structMd += `| Package | Purpose |\n`
structMd += `|---------|---------|\n`
structMd += `| @tanstack/react-start | Full-stack React framework |\n`
structMd += `| @earendil-works/pi-coding-agent | Pi coding-agent runtime |\n`
structMd += `| @earendil-works/pi-ai | Pi AI primitives |\n`
structMd += `| @workspace/pi-protocol | Chat wire types, Zod schemas, provider IDs, OpenUI prompt |\n`
structMd += `| @workspace/hax-design | Fleet Pi UI shell, agent-elements, openui renderer |\n`
structMd += `| Google Gemini (Pi google provider) | Primary LLM provider (default: gemini-3.5-flash) |\n`
structMd += `| pino + pino-pretty | Structured logging |\n`
structMd += `| opossum | Circuit breaker pattern |\n`
structMd += `| zod + @asteasolutions/zod-to-openapi | Schema validation & OpenAPI generation |\n`
structMd += `| vitest + @playwright/test | Testing frameworks |\n`
structMd += `| husky + lint-staged | Pre-commit hooks |\n`
structMd += `\n`

structMd += `## Data Flow\n\n`
structMd += `1. The **Browser** sends a user message to \`/api/chat\` via NDJSON stream.\n`
structMd += `2. The **Server Route** sanitizes input (PII), logs with correlation IDs, and delegates to \`handleChatTurn\`.\n`
structMd += `3. The **Pi Server Module** invokes the configured Pi provider (default Google Gemini) through a circuit breaker; optional Daytona sandboxes mount per-user workspace volumes.\n`
structMd += `4. Streaming events (\`start\`, \`delta\`, \`tool\`, \`done\`, \`error\`) flow back to the client.\n`
structMd += `5. The **Client** hydrates messages from the Pi session file on reload and opens supporting resources/workspace panels on demand.\n`
structMd += `6. Supporting endpoints expose models, resources, workspace files, sessions, and health checks.\n`
structMd += `7. Durable agent context lives in \`agent-workspace/\`, including project memory, plans, artifacts, and workspace-installed Pi resources.\n`

writeFileSync(join(docsDir, "project-structure.md"), structMd)
console.log("docs/project-structure.md written")

console.log("\nDoc generation complete. Artifacts:")
console.log(`  - ${relative(repoRoot, join(docsDir, "api.md"))}`)
console.log(`  - ${relative(repoRoot, join(docsDir, "architecture.mmd"))}`)
console.log(`  - ${relative(repoRoot, join(docsDir, "architecture.md"))}`)
console.log(`  - ${relative(repoRoot, join(docsDir, "project-structure.md"))}`)

// ─── helpers ───

function formatSchema(schema, indentLevel = 0) {
  const indent = "  ".repeat(indentLevel)
  if (!schema) return ""

  if (schema.type === "object" && schema.properties) {
    let out = `${indent}\`\`\`json\n`
    out += `${indent}{\n`
    const entries = Object.entries(schema.properties)
    for (const [index, [key, prop]] of entries.entries()) {
      const req = (schema.required ?? []).includes(key) ? " (required)" : ""
      const typeStr = prop.type ? ` <${prop.type}>` : ""
      const desc = prop.description ? ` — ${prop.description}` : ""
      const comma = index < entries.length - 1 ? "," : ""
      out += `${indent}  "${key}":${typeStr}${req}${desc}${comma}\n`
    }
    out += `${indent}}\n`
    out += `${indent}\`\`\`\n`
    return out
  }

  if (schema.type === "array" && schema.items) {
    let out = `${indent}Array of:\n`
    out += formatSchema(schema.items, indentLevel + 1)
    return out
  }

  if (schema.anyOf) {
    let out = `${indent}One of:\n`
    for (const sub of schema.anyOf) {
      out += formatSchema(sub, indentLevel + 1)
    }
    return out
  }

  if (schema.enum) {
    return `${indent}Enum: ${schema.enum.map((e) => `"${e}"`).join(", ")}\n`
  }

  if (schema.type) {
    return `${indent}Type: \`${schema.type}\`\n`
  }

  return ""
}
