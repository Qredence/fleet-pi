import {
  ChatModelsResponseSchema,
  ChatProviderUpdateRequestSchema,
  ChatProviderUpdateResponseSchema,
  ChatProvidersResponseSchema,
  ChatQuestionAnswerResponseSchema,
  ChatResourcesResponseSchema,
  ChatSessionResponseSchema,
  ChatSessionsResponseSchema,
  ChatSettingsResponseSchema,
  ChatSettingsUpdateRequestSchema,
  WorkspaceTreeResponseSchema,
} from "@workspace/hax-design/lib/pi/chat-protocol.zod"
import {
  ChatRequestError,
  fetchJson,
  fetchValidatedJson,
  metadataUrl,
  readChatStream,
} from "./chat-fetch"
import type {
  ChatModelsResponse,
  ChatProviderInfo,
  ChatProviderUpdateRequest,
  ChatProviderUpdateResponse,
  ChatQuestionAnswerRequest,
  ChatQuestionAnswerResponse,
  ChatRequest,
  ChatResourcesResponse,
  ChatSessionInfo,
  ChatSessionMetadata,
  ChatSessionResponse,
  ChatSettingsResponse,
  ChatSettingsUpdateRequest,
  ChatStreamEvent,
  WorkspaceTreeResponse,
} from "@workspace/hax-design/lib/pi/chat-protocol"

export type ChatClient = {
  abortSession: (metadata: ChatSessionMetadata) => Promise<void>
  answerQuestion: (
    request: ChatQuestionAnswerRequest
  ) => Promise<ChatQuestionAnswerResponse>
  createSession: () => Promise<ChatSessionResponse>
  getModels: () => Promise<ChatModelsResponse>
  getResources: () => Promise<ChatResourcesResponse>
  getSettings: () => Promise<ChatSettingsResponse>
  getWorkspaceTree: () => Promise<WorkspaceTreeResponse>
  listSessions: () => Promise<Array<ChatSessionInfo>>
  loadSession: (metadata: ChatSessionMetadata) => Promise<ChatSessionResponse>
  resumeSession: (metadata: ChatSessionMetadata) => Promise<ChatSessionResponse>
  updateSettings: (
    request: ChatSettingsUpdateRequest
  ) => Promise<ChatSettingsResponse>
  streamMessage: (
    request: ChatRequest,
    onEvent: (event: ChatStreamEvent) => void,
    signal?: AbortSignal
  ) => Promise<void>
  getProviders: () => Promise<{ providers: Array<ChatProviderInfo> }>
  updateProvider: (
    request: ChatProviderUpdateRequest
  ) => Promise<ChatProviderUpdateResponse>
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

  async getSettings() {
    return fetchValidatedJson("/api/chat/settings", ChatSettingsResponseSchema)
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

  async updateSettings(request) {
    const body = ChatSettingsUpdateRequestSchema.parse(request)
    return fetchValidatedJson(
      "/api/chat/settings",
      ChatSettingsResponseSchema,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    )
  },

  async streamMessage(request, onEvent, signal) {
    const daytonaKey =
      typeof window !== "undefined"
        ? localStorage.getItem("daytonaApiKey")
        : null
    const headers = new Headers({ "Content-Type": "application/json" })
    if (daytonaKey) {
      headers.set("x-daytona-api-key", daytonaKey)
    }

    const response = await fetch("/api/chat", {
      method: "POST",
      headers,
      body: JSON.stringify(request),
      signal,
    })

    if (!response.ok) {
      const body = await response.text()
      throw new ChatRequestError(response.status, body)
    }

    await readChatStream(response, onEvent)
  },

  async getProviders() {
    return fetchValidatedJson(
      "/api/chat/providers",
      ChatProvidersResponseSchema
    )
  },

  async updateProvider(request) {
    const body = ChatProviderUpdateRequestSchema.parse(request)
    return fetchValidatedJson(
      "/api/chat/providers",
      ChatProviderUpdateResponseSchema,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    )
  },
}
