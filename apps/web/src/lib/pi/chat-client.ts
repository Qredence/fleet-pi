import {
  fetchJson,
  fetchValidatedJson,
  metadataUrl,
  readChatStream,
} from "./chat-fetch"
import {
  ChatModelsResponseSchema,
  ChatQuestionAnswerResponseSchema,
  ChatResourcesResponseSchema,
  ChatSessionResponseSchema,
  ChatSessionsResponseSchema,
  WorkspaceTreeResponseSchema,
} from "./chat-protocol.zod"
import type {
  ChatModelsResponse,
  ChatQuestionAnswerRequest,
  ChatQuestionAnswerResponse,
  ChatRequest,
  ChatResourcesResponse,
  ChatSessionInfo,
  ChatSessionMetadata,
  ChatSessionResponse,
  ChatStreamEvent,
  WorkspaceTreeResponse,
} from "./chat-protocol"

export type ChatClient = {
  abortSession: (metadata: ChatSessionMetadata) => Promise<void>
  answerQuestion: (
    request: ChatQuestionAnswerRequest
  ) => Promise<ChatQuestionAnswerResponse>
  createSession: () => Promise<ChatSessionResponse>
  getModels: () => Promise<ChatModelsResponse>
  getResources: () => Promise<ChatResourcesResponse>
  getWorkspaceTree: () => Promise<WorkspaceTreeResponse>
  listSessions: () => Promise<Array<ChatSessionInfo>>
  loadSession: (metadata: ChatSessionMetadata) => Promise<ChatSessionResponse>
  resumeSession: (metadata: ChatSessionMetadata) => Promise<ChatSessionResponse>
  streamMessage: (
    request: ChatRequest,
    onEvent: (event: ChatStreamEvent) => void,
    signal?: AbortSignal
  ) => Promise<void>
}

export const chatClient: ChatClient = {
  async abortSession(metadata) {
    await fetchJson("/api/chat/abort", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metadata),
    })
  },

  async answerQuestion(request) {
    return fetchValidatedJson(
      "/api/chat/question",
      ChatQuestionAnswerResponseSchema,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      }
    )
  },

  async createSession() {
    return fetchValidatedJson("/api/chat/new", ChatSessionResponseSchema, {
      method: "POST",
    })
  },

  async getModels() {
    return fetchValidatedJson("/api/chat/models", ChatModelsResponseSchema)
  },

  async getResources() {
    return fetchValidatedJson(
      "/api/chat/resources",
      ChatResourcesResponseSchema
    )
  },

  async getWorkspaceTree() {
    return fetchValidatedJson(
      "/api/workspace/tree",
      WorkspaceTreeResponseSchema
    )
  },

  async listSessions() {
    const result = await fetchValidatedJson(
      "/api/chat/sessions",
      ChatSessionsResponseSchema
    )
    return result.sessions
  },

  async loadSession(metadata) {
    return fetchValidatedJson(
      `/api/chat/session?${metadataUrl(metadata)}`,
      ChatSessionResponseSchema
    )
  },

  async resumeSession(metadata) {
    return fetchValidatedJson("/api/chat/resume", ChatSessionResponseSchema, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metadata),
    })
  },

  async streamMessage(request, onEvent, signal) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(body || `Chat request failed (${response.status})`)
    }

    await readChatStream(response, onEvent)
  },
}
