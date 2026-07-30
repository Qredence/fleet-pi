import { writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from "@asteasolutions/zod-to-openapi"
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
  scope: z.literal("pi-mirror"),
  message: z.string(),
  erasedSessions: z.number(),
  erasedProviders: z.number(),
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
      description: "New session metadata",
      content: {
        "application/json": {
          schema: ChatSessionMetadataSchema,
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
          schema: z.object({
            path: z.string(),
            content: z.string(),
            mimeType: z.string().optional(),
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
  path: "/api/sandbox/preview",
  description: "Preview URL for a Daytona sandbox port",
  responses: {
    200: {
      description: "Preview link",
      content: {
        "application/json": {
          schema: z.object({ url: z.string().url().optional() }),
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
          schema: z.object({ ok: z.boolean() }),
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

const outPath = join(process.cwd(), "openapi.json")
writeFileSync(outPath, JSON.stringify(doc, null, 2))
console.log(`openapi.json written to ${outPath}`)
