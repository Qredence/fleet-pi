import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from "@asteasolutions/zod-to-openapi"
import { format, resolveConfig } from "prettier"
import { z } from "zod"
import {
  ChatCommandsResponseSchema,
  ChatModelsDiscoverRequestSchema,
  ChatModelsDiscoverResponseSchema,
  ChatModelsResponseSchema,
  ChatProviderRemoveRequestSchema,
  ChatProviderRemoveResponseSchema,
  ChatProviderUpdateRequestSchema,
  ChatProviderUpdateResponseSchema,
  ChatProvidersResponseSchema,
  ChatQuestionAnswerRequestSchema,
  ChatQuestionAnswerResponseSchema,
  ChatRequestSchema,
  ChatResourcesResponseSchema,
  ChatSessionMetadataSchema,
  ChatSessionResponseSchema,
  ChatSessionsResponseSchema,
  ChatSettingsResponseSchema,
  ChatSettingsUpdateRequestSchema,
  ChatStreamEventSchema,
  ErrorResponseSchema,
  HealthResponseSchema,
  WorkspaceFileResponseSchema,
} from "@workspace/pi-protocol/chat-protocol.zod"

const registry = new OpenAPIRegistry()

registry.registerPath({
  method: "post",
  path: "/api/chat",
  description: "Send a chat message and receive a streaming response",
  request: {
    body: {
      content: {
        "application/json": {
          schema: ChatRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "NDJSON stream of chat events",
      content: {
        "application/x-ndjson": {
          schema: ChatStreamEventSchema,
        },
      },
    },
    400: {
      description: "Bad request",
      content: {
        "text/plain": {
          schema: { type: "string" },
        },
      },
    },
  },
})

registry.registerPath({
  method: "get",
  path: "/api/chat/models",
  description: "List available chat models",
  responses: {
    200: {
      description: "List of models",
      content: {
        "application/json": {
          schema: ChatModelsResponseSchema,
        },
      },
    },
    500: {
      description: "Server error",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

registry.registerPath({
  method: "get",
  path: "/api/chat/resources",
  description: "List available chat resources (skills, prompts, extensions)",
  responses: {
    200: {
      description: "List of resources",
      content: {
        "application/json": {
          schema: ChatResourcesResponseSchema,
        },
      },
    },
    500: {
      description: "Server error",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

registry.registerPath({
  method: "get",
  path: "/api/chat/session",
  description: "Hydrate a chat session by query parameters",
  request: {
    query: ChatSessionMetadataSchema,
  },
  responses: {
    200: {
      description: "Session data",
      content: {
        "application/json": {
          schema: ChatSessionResponseSchema,
        },
      },
    },
    500: {
      description: "Server error",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

const ChatSessionDeleteResponseSchema = z.object({
  ok: z.literal(true),
  sessionId: z.string().optional(),
  sessionFile: z.string().optional(),
})

registry.registerPath({
  method: "delete",
  path: "/api/chat/session",
  description: "Delete an owned Pi session mirror row and ephemeral JSONL",
  request: {
    query: ChatSessionMetadataSchema,
  },
  responses: {
    200: {
      description: "Session deleted",
      content: {
        "application/json": {
          schema: ChatSessionDeleteResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description: "Forbidden: session belongs to another user",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: "Session not found or not owned",
      content: {
        "application/json": {
          schema: z.object({
            ok: z.literal(false),
            reason: z.string(),
          }),
        },
      },
    },
    501: {
      description: "Session mirror is disabled",
      content: {
        "application/json": {
          schema: z.object({
            ok: z.literal(false),
            reason: z.string(),
          }),
        },
      },
    },
    503: {
      description: "Session mirror is temporarily unavailable",
      content: {
        "application/json": {
          schema: z.object({
            ok: z.literal(false),
            reason: z.string(),
          }),
        },
      },
    },
    500: {
      description: "Delete failed",
      content: {
        "application/json": {
          schema: z.object({
            ok: z.literal(false),
            reason: z.string(),
          }),
        },
      },
    },
  },
})

const ChatAccountDeleteResponseSchema = z.object({
  ok: z.literal(true),
  scope: z.enum(["pi-mirror", "pi-mirror+hosted"]),
  message: z.string(),
  erasedSessions: z.number(),
  erasedProviders: z.number(),
  erasedHostedTranscripts: z.boolean().optional(),
})

registry.registerPath({
  method: "delete",
  path: "/api/chat/account",
  description:
    "Erase mirrored Pi sessions and BYOK provider credentials for the signed-in user",
  responses: {
    200: {
      description: "Mirrored Pi data erased",
      content: {
        "application/json": {
          schema: ChatAccountDeleteResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Failed to erase mirrored Pi data",
      content: {
        "application/json": {
          schema: z.object({
            ok: z.literal(false),
            reason: z.string(),
            message: z.string(),
          }),
        },
      },
    },
  },
})

registry.registerPath({
  method: "get",
  path: "/api/chat/sessions",
  description: "List all chat sessions",
  responses: {
    200: {
      description: "List of sessions",
      content: {
        "application/json": {
          schema: ChatSessionsResponseSchema,
        },
      },
    },
    500: {
      description: "Server error",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

registry.registerPath({
  method: "post",
  path: "/api/chat/new",
  description: "Create a new chat session",
  responses: {
    200: {
      description: "New session metadata and empty messages list",
      content: {
        "application/json": {
          schema: ChatSessionResponseSchema,
        },
      },
    },
    500: {
      description: "Server error",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

registry.registerPath({
  method: "post",
  path: "/api/chat/fork",
  description: "Fork an existing hosted Durable Object conversation",
  request: {
    body: {
      content: {
        "application/json": {
          schema: ChatSessionMetadataSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Forked conversation identifiers",
      content: {
        "application/json": {
          schema: z.object({
            sessionId: z.string(),
            conversationId: z.string(),
          }),
        },
      },
    },
    400: {
      description: "Only a hosted conversation can be forked",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: "Session not found",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    409: {
      description: "An agent turn is already in progress",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

registry.registerPath({
  method: "post",
  path: "/api/chat/resume",
  description: "Resume an existing chat session",
  request: {
    body: {
      content: {
        "application/json": {
          schema: ChatSessionMetadataSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Session data",
      content: {
        "application/json": {
          schema: ChatSessionResponseSchema,
        },
      },
    },
    500: {
      description: "Server error",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

registry.registerPath({
  method: "post",
  path: "/api/chat/abort",
  description: "Abort the active chat session",
  request: {
    body: {
      content: {
        "application/json": {
          schema: ChatSessionMetadataSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Abort result",
      content: {
        "application/json": {
          schema: z.object({ aborted: z.boolean() }),
        },
      },
    },
    500: {
      description: "Server error",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

registry.registerPath({
  method: "post",
  path: "/api/chat/question",
  description: "Answer a question prompt from the assistant",
  request: {
    body: {
      content: {
        "application/json": {
          schema: ChatQuestionAnswerRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Answer processed",
      content: {
        "application/json": {
          schema: ChatQuestionAnswerResponseSchema,
        },
      },
    },
    400: {
      description: "Bad request",
      content: {
        "text/plain": {
          schema: { type: "string" },
        },
      },
    },
    404: {
      description: "Not found",
      content: {
        "application/json": {
          schema: ChatQuestionAnswerResponseSchema,
        },
      },
    },
  },
})

registry.registerPath({
  method: "get",
  path: "/api/chat/settings",
  description:
    "Load Pi project settings (overrides merged with Fleet base defaults)",
  responses: {
    200: {
      description: "Settings snapshot",
      content: {
        "application/json": {
          schema: ChatSettingsResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

registry.registerPath({
  method: "patch",
  path: "/api/chat/settings",
  description:
    "Persist Pi project settings overrides and hot-reload active runtimes",
  request: {
    body: {
      content: {
        "application/json": {
          schema: ChatSettingsUpdateRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Updated settings",
      content: {
        "application/json": {
          schema: ChatSettingsResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

registry.registerPath({
  method: "get",
  path: "/api/chat/providers",
  description: "List provider credential configuration status",
  responses: {
    200: {
      description: "Provider catalog",
      content: {
        "application/json": {
          schema: ChatProvidersResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

registry.registerPath({
  method: "post",
  path: "/api/chat/providers",
  description: "Save encrypted BYOK provider credentials",
  request: {
    body: {
      content: {
        "application/json": {
          schema: ChatProviderUpdateRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Provider saved",
      content: {
        "application/json": {
          schema: ChatProviderUpdateResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

registry.registerPath({
  method: "delete",
  path: "/api/chat/providers",
  description: "Remove BYOK provider credentials",
  request: {
    body: {
      content: {
        "application/json": {
          schema: ChatProviderRemoveRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Provider removed",
      content: {
        "application/json": {
          schema: ChatProviderRemoveResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

registry.registerPath({
  method: "get",
  path: "/api/chat/commands",
  description: "List slash commands for the InputBar",
  responses: {
    200: {
      description: "Slash commands",
      content: {
        "application/json": {
          schema: ChatCommandsResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

registry.registerPath({
  method: "post",
  path: "/api/chat/models/discover",
  description: "Discover remote models from configured providers",
  request: {
    body: {
      content: {
        "application/json": {
          schema: ChatModelsDiscoverRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Discovered models",
      content: {
        "application/json": {
          schema: ChatModelsDiscoverResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

registry.registerPath({
  method: "get",
  path: "/api/workspace/tree",
  description: "List agent-workspace filesystem tree",
  responses: {
    200: {
      description: "Workspace tree",
      content: {
        "application/json": {
          schema: z.object({
            root: z.string(),
            nodes: z.array(z.record(z.string(), z.unknown())),
          }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

registry.registerPath({
  method: "get",
  path: "/api/chat/runs",
  description: "List chat runs for a session",
  responses: {
    200: {
      description: "Run list",
      content: {
        "application/json": {
          schema: z.object({
            runs: z.array(z.record(z.string(), z.unknown())),
          }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
})

registry.registerPath({
  method: "get",
  path: "/api/chat/run",
  description: "Fetch a single chat run",
  responses: {
    200: {
      description: "Run detail",
      content: {
        "application/json": {
          schema: z.record(z.string(), z.unknown()),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
})

registry.registerPath({
  method: "get",
  path: "/api/chat/provenance",
  description: "File mutation provenance for workspace paths",
  responses: {
    200: {
      description: "Provenance records",
      content: {
        "application/json": {
          schema: z.object({
            records: z.array(z.record(z.string(), z.unknown())),
          }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
})

registry.registerPath({
  method: "get",
  path: "/api/workspace/file",
  description: "Read a file inside agent-workspace",
  responses: {
    200: {
      description: "File preview",
      content: {
        "application/json": {
          schema: WorkspaceFileResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
})

registry.registerPath({
  method: "get",
  path: "/api/workspace/health",
  description: "Workspace bootstrap health",
  responses: {
    200: {
      description: "Health status",
      content: {
        "application/json": {
          schema: z.record(z.string(), z.unknown()),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
})

registry.registerPath({
  method: "get",
  path: "/api/workspace/items",
  description: "List indexed workspace projection items",
  responses: {
    200: {
      description: "Workspace items list",
      content: {
        "application/json": {
          schema: z.object({
            ok: z.literal(true),
            total: z.number(),
            items: z.array(z.record(z.string(), z.unknown())),
          }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
})

registry.registerPath({
  method: "get",
  path: "/api/workspace/item",
  description: "Fetch a single indexed workspace item by id",
  request: {
    query: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      description: "Workspace item detail",
      content: {
        "application/json": {
          schema: z.record(z.string(), z.unknown()),
        },
      },
    },
    400: {
      description: "Missing workspace item id",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Workspace item not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
})

registry.registerPath({
  method: "get",
  path: "/api/workspace/search",
  description: "Search indexed workspace items and semantic records",
  request: {
    query: z.object({
      q: z.string(),
    }),
  },
  responses: {
    200: {
      description: "Search results",
      content: {
        "application/json": {
          schema: z.object({
            ok: z.literal(true),
            query: z.string(),
            total: z.number(),
            hits: z.array(z.record(z.string(), z.unknown())),
          }),
        },
      },
    },
    400: {
      description: "Missing workspace search query",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
})

registry.registerPath({
  method: "get",
  path: "/api/workspace/reindex",
  description: "Issue a CSRF token for POST /api/workspace/reindex",
  responses: {
    200: {
      description: "CSRF token issued",
      content: {
        "application/json": {
          schema: z.object({ csrfToken: z.string() }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
})

registry.registerPath({
  method: "post",
  path: "/api/workspace/reindex",
  description: "Reindex canonical agent-workspace files into the projection",
  responses: {
    200: {
      description: "Reindex outcome",
      content: {
        "application/json": {
          schema: z.record(z.string(), z.unknown()),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "Forbidden or invalid CSRF token",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    429: {
      description: "Rate limit exceeded",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
})

registry.registerPath({
  method: "get",
  path: "/api/sandbox/settings",
  description: "Read Daytona sandbox configuration and readiness status",
  responses: {
    200: {
      description: "Sandbox status",
      content: {
        "application/json": {
          schema: z.object({
            daytonaApiKeyConfigured: z.boolean(),
            daytonaTargetConfigured: z.boolean(),
            daytonaTarget: z.string(),
            sandboxReady: z.boolean().optional(),
            volumeName: z.string().optional(),
            csrfToken: z.string().optional(),
          }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
})

registry.registerPath({
  method: "post",
  path: "/api/sandbox/settings",
  description: "Update local Daytona sandbox environment configuration",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            daytonaApiKey: z.string().optional(),
            daytonaTarget: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Sandbox configuration saved",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            daytonaApiKeyConfigured: z.boolean(),
            daytonaTargetConfigured: z.boolean(),
            daytonaTarget: z.string(),
          }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "Invalid CSRF protection",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
})

registry.registerPath({
  method: "get",
  path: "/api/sandbox/preview",
  description: "Preview URL for a Daytona sandbox port",
  responses: {
    200: {
      description: "Preview link",
      content: {
        "application/json": {
          schema: z.object({
            url: z.string().url().optional(),
            token: z.string().optional(),
            port: z.number().optional(),
          }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
})

registry.registerPath({
  method: "post",
  path: "/api/webhooks/daytona",
  description: "Daytona webhook receiver",
  responses: {
    200: {
      description: "Acknowledged",
      content: {
        "application/json": {
          schema: z.object({ received: z.boolean() }),
        },
      },
    },
    401: {
      description: "Invalid webhook signature",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    503: {
      description: "Webhook secret is not configured on hosted deployment",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
})

registry.registerPath({
  method: "get",
  path: "/api/auth/session",
  description: "Fetch the active authentication session",
  responses: {
    200: {
      description: "Session state",
      content: {
        "application/json": {
          schema: z.record(z.string(), z.unknown()).nullable(),
        },
      },
    },
  },
})

registry.registerPath({
  method: "get",
  path: "/api/health",
  description: "Health check endpoint",
  responses: {
    200: {
      description: "Service is healthy",
      content: {
        "application/json": {
          schema: HealthResponseSchema,
        },
      },
    },
  },
})

const generator = new OpenApiGeneratorV31(registry.definitions)

const doc = generator.generateDocument({
  openapi: "3.1.0",
  info: {
    title: "Fleet Pi Chat API",
    version: "1.0.0",
    description: "OpenAPI specification for Fleet Pi chat protocol endpoints",
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Local development server",
    },
  ],
})

const outPath = join(import.meta.dirname, "..", "openapi.json")
// Format with the repo's Prettier config so regeneration is diff-stable
// against the (lint-staged formatted) committed document.
const prettierConfig = await resolveConfig(outPath)
const formatted = await format(JSON.stringify(doc, null, 2), {
  ...prettierConfig,
  parser: "json",
  filepath: outPath,
})

if (process.argv.includes("--check")) {
  let committed: string
  try {
    committed = readFileSync(outPath, "utf8")
  } catch {
    console.error(`openapi.json is missing at ${outPath}`)
    process.exit(1)
  }

  if (committed === formatted) {
    console.log("openapi.json is up to date")
    process.exit(0)
  }

  const expected = formatted.split("\n")
  const actual = committed.split("\n")
  const lines = Math.max(expected.length, actual.length)
  let shown = 0

  console.error("openapi.json is out of date. Run `pnpm generate:openapi`.")
  for (let index = 0; index < lines && shown < 60; index++) {
    if (expected[index] === actual[index]) continue
    console.error(`line ${index + 1}:`)
    if (index < actual.length) console.error(`- ${actual[index]}`)
    if (index < expected.length) console.error(`+ ${expected[index]}`)
    shown++
  }
  if (shown === 60) console.error("… diff truncated")
  process.exit(1)
}

writeFileSync(outPath, formatted)
console.log(`openapi.json written to ${outPath}`)
