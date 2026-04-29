import { writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from "@asteasolutions/zod-to-openapi"
import { z } from "zod"
import {
  ChatModelsResponseSchema,
  ChatQuestionAnswerRequestSchema,
  ChatQuestionAnswerResponseSchema,
  ChatRequestSchema,
  ChatResourcesResponseSchema,
  ChatSessionMetadataSchema,
  ChatSessionResponseSchema,
  ChatSessionsResponseSchema,
  ChatStreamEventSchema,
  ErrorResponseSchema,
  HealthResponseSchema,
} from "../src/lib/pi/chat-protocol.zod"

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
