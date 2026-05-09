import type {
  ChatMessage,
  ChatToolPart,
} from "@workspace/ui/components/agent-elements/chat-types"

export type ChatMode = "agent" | "plan"

export type ChatPlanAction = "execute" | "refine"

export type ChatThinkingLevel =
  | "off"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"

export type ChatModelSelection =
  | string
  | {
      provider: string
      id: string
      thinkingLevel?: ChatThinkingLevel
    }

export type ChatSessionMetadata = {
  sessionFile?: string
  sessionId?: string
}

export type ChatRequest = ChatSessionMetadata & {
  message?: string
  model?: ChatModelSelection
  mode?: ChatMode
  planAction?: ChatPlanAction
  streamingBehavior?: "steer" | "followUp"
}

export type ChatQuestionAnswer = {
  kind: "single" | "multi" | "text" | "skip"
  questionId?: string
  selectedIds?: Array<string>
  text?: string
}

export type ChatQuestionAnswerRequest = ChatSessionMetadata & {
  toolCallId?: string
  answer: ChatQuestionAnswer
}

export type ChatQuestionAnswerResponse = {
  ok: boolean
  message?: string
  mode?: ChatMode
  planAction?: ChatPlanAction
}

type ChatStartEvent = {
  type: "start"
  id: string
  sessionFile?: string
  sessionId: string
  sessionReset?: boolean
  diagnostics?: Array<string>
}

export type ChatStreamEvent =
  | ChatStartEvent
  | { type: "delta"; text: string; messageId?: string }
  | { type: "tool"; part: ChatToolPart; messageId?: string }
  | {
      type: "plan"
      mode: ChatMode
      executing: boolean
      completed: number
      total: number
      message?: string
    }
  | { type: "state"; state: ChatStateEvent }
  | { type: "queue"; steering: Array<string>; followUp: Array<string> }
  | { type: "thinking"; text: string; messageId?: string }
  | { type: "compaction"; phase: "start"; reason: string }
  | {
      type: "compaction"
      phase: "end"
      reason: string
      aborted: boolean
      willRetry: boolean
      errorMessage?: string
    }
  | {
      type: "retry"
      phase: "start"
      attempt: number
      maxAttempts: number
      delayMs: number
      errorMessage: string
    }
  | {
      type: "retry"
      phase: "end"
      success: boolean
      attempt: number
      finalError?: string
    }
  | {
      type: "done"
      message: ChatMessage
      sessionFile?: string
      sessionId: string
      sessionReset?: boolean
    }
  | { type: "error"; message: string }

type ChatStateEvent = {
  name:
    | "agent_start"
    | "agent_end"
    | "turn_start"
    | "turn_end"
    | "message_start"
    | "message_end"
  message?: string
}

export type ChatModelInfo = {
  key: string
  provider: string
  id: string
  name: string
  version?: string
  reasoning: boolean
  input: Array<"text" | "image">
  contextWindow?: number
  maxTokens?: number
  available: boolean
  defaultThinkingLevel?: ChatThinkingLevel
}

export type ChatModelsResponse = {
  models: Array<ChatModelInfo>
  selectedModelKey?: string
  defaultProvider?: string
  defaultModel?: string
  defaultThinkingLevel?: ChatThinkingLevel
  diagnostics: Array<string>
}

export type ChatSessionResponse = {
  session: ChatSessionMetadata
  messages: Array<ChatMessage>
  sessionReset?: boolean
}

export type ChatSessionInfo = {
  path: string
  id: string
  cwd: string
  name?: string
  created: string
  modified: string
  messageCount: number
  firstMessage: string
}

export type ChatResourceInfo = {
  activationStatus?: "active" | "staged" | "reload-required"
  name: string
  description?: string
  installedInWorkspace?: boolean
  path?: string
  source?: string
  workspacePath?: string
  argumentHint?: string
}

export type ChatResourcesResponse = {
  packages: Array<ChatResourceInfo>
  skills: Array<ChatResourceInfo>
  prompts: Array<ChatResourceInfo>
  extensions: Array<ChatResourceInfo>
  themes: Array<ChatResourceInfo>
  agentsFiles: Array<ChatResourceInfo>
  diagnostics: Array<string>
}

export type WorkspaceTreeNode = {
  name: string
  path: string
  type: "directory" | "file"
  children?: Array<WorkspaceTreeNode>
}

export type WorkspaceTreeResponse = {
  root: string
  nodes: Array<WorkspaceTreeNode>
  diagnostics: Array<string>
}

export type WorkspaceFileResponse = {
  path: string
  name: string
  content: string
  mediaType: "text/markdown" | "text/plain" | "application/octet-stream"
  size?: number
  status?: "ok" | "too-large" | "unsupported"
}
