import { fetchJson, metadataUrl, readChatStream } from "./chat-fetch"
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
    return fetchJson<ChatQuestionAnswerResponse>("/api/chat/question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })
  },

  async createSession() {
    return fetchJson<ChatSessionResponse>("/api/chat/new", {
      method: "POST",
    })
  },

  async getModels() {
    return fetchJson<ChatModelsResponse>("/api/chat/models")
  },

  async getResources() {
    return fetchJson<ChatResourcesResponse>("/api/chat/resources")
  },

  async getWorkspaceTree() {
    return fetchJson<WorkspaceTreeResponse>("/api/workspace/tree")
  },

  async listSessions() {
    const result = await fetchJson<{ sessions: Array<ChatSessionInfo> }>(
      "/api/chat/sessions"
    )
    return result.sessions
  },

  async loadSession(metadata) {
    return fetchJson<ChatSessionResponse>(
      `/api/chat/session?${metadataUrl(metadata)}`
    )
  },

  async resumeSession(metadata) {
    return fetchJson<ChatSessionResponse>("/api/chat/resume", {
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
