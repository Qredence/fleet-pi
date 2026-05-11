import {
  appendTextPart,
  finalizeThinkingToolParts,
  toChatMessage,
  upsertThinkingPart,
  upsertToolPart,
} from "./chat-message-helpers"
import { finalizePlanTurn } from "./plan-mode"
import { createPlanEvent } from "./plan-state"
import {
  findLatestUnmappedAssistantMessageId,
  persistChatMessageIdMapping,
  toToolPart,
} from "./server-utils"
import type {
  AgentSessionEvent,
  AgentSessionRuntime,
} from "@earendil-works/pi-coding-agent"
import type { ChatMessagePart } from "@workspace/ui/components/agent-elements/chat-types"
import type { ChatRequest, ChatStreamEvent } from "./chat-protocol"
import type { PlanModeState } from "./plan-state"

export type ChatRuntimeSession = AgentSessionRuntime["session"]

type BufferedTurnEvent = Extract<
  ChatStreamEvent,
  { type: "state" | "queue" | "compaction" | "retry" }
>

export type TurnStartContext = {
  diagnostics: Array<string>
  firstStartPending: boolean
  pendingEvents: Array<BufferedTurnEvent>
  send: (event: ChatStreamEvent) => void
  session: ChatRuntimeSession
  sessionReset: boolean
}

export type AssistantTurnState = {
  assistantId: string
  hadError: boolean
  parts: Array<ChatMessagePart>
  runId: string
  thinkingText: string
  toolInputs: Map<string, Record<string, unknown>>
}

export function handleSessionEvent(
  event: AgentSessionEvent,
  activeTurn: AssistantTurnState | undefined,
  startContext: TurnStartContext
) {
  const send = startContext.send

  if (
    event.type === "message_update" &&
    event.assistantMessageEvent.type === "text_delta"
  ) {
    if (!activeTurn) {
      activeTurn = beginAssistantTurn(startContext)
    }
    const nextParts = appendTextPart(
      activeTurn.parts,
      event.assistantMessageEvent.delta
    )
    send({ type: "delta", text: event.assistantMessageEvent.delta })
    return {
      ...activeTurn,
      parts: nextParts,
    }
  }

  if (
    event.type === "message_update" &&
    event.assistantMessageEvent.type === "thinking_delta"
  ) {
    if (!activeTurn) {
      activeTurn = beginAssistantTurn(startContext)
    }
    const nextThinkingText = `${activeTurn.thinkingText}${event.assistantMessageEvent.delta}`
    const nextParts = upsertThinkingPart(
      activeTurn.parts,
      activeTurn.assistantId,
      nextThinkingText
    )
    send({ type: "thinking", text: nextThinkingText })
    return {
      ...activeTurn,
      parts: nextParts,
      thinkingText: nextThinkingText,
    }
  }

  if (
    event.type === "tool_execution_start" ||
    event.type === "tool_execution_update" ||
    event.type === "tool_execution_end"
  ) {
    if (!activeTurn) {
      activeTurn = beginAssistantTurn(startContext)
    }
    const part = toToolPart(event, activeTurn.toolInputs.get(event.toolCallId))
    if (event.type !== "tool_execution_end") {
      activeTurn.toolInputs.set(
        event.toolCallId,
        part.input as Record<string, unknown>
      )
    }
    const nextParts = upsertToolPart(activeTurn.parts, part)
    send({ type: "tool", part })
    return {
      ...activeTurn,
      parts: nextParts,
    }
  }

  if (event.type === "queue_update") {
    emitBufferedTurnEvent(
      {
        type: "queue",
        steering: [...event.steering],
        followUp: [...event.followUp],
      },
      activeTurn,
      startContext
    )
    return activeTurn
  }

  if (event.type === "compaction_start") {
    emitBufferedTurnEvent(
      {
        type: "compaction",
        phase: "start",
        reason: event.reason,
      },
      activeTurn,
      startContext
    )
    return activeTurn
  }

  if (event.type === "compaction_end") {
    emitBufferedTurnEvent(
      {
        type: "compaction",
        phase: "end",
        reason: event.reason,
        aborted: event.aborted,
        willRetry: event.willRetry,
        errorMessage: event.errorMessage,
      },
      activeTurn,
      startContext
    )
    return activeTurn
  }

  if (event.type === "auto_retry_start") {
    emitBufferedTurnEvent(
      {
        type: "retry",
        phase: "start",
        attempt: event.attempt,
        maxAttempts: event.maxAttempts,
        delayMs: event.delayMs,
        errorMessage: event.errorMessage,
      },
      activeTurn,
      startContext
    )
    return activeTurn
  }

  if (event.type === "auto_retry_end") {
    emitBufferedTurnEvent(
      {
        type: "retry",
        phase: "end",
        success: event.success,
        attempt: event.attempt,
        finalError: event.finalError,
      },
      activeTurn,
      startContext
    )
    return activeTurn
  }

  if (isStateEvent(event)) {
    emitBufferedTurnEvent(
      {
        type: "state",
        state: { name: event.type },
      },
      activeTurn,
      startContext
    )
  }

  if (event.type === "message_end" && isAssistantErrorMessage(event.message)) {
    if (!activeTurn) {
      activeTurn = beginAssistantTurn(startContext)
    }
    send({
      type: "error",
      message: event.message.errorMessage,
      runId: activeTurn.runId,
    })
    return {
      ...activeTurn,
      hadError: true,
    }
  }

  return activeTurn
}

export function shouldEmitInitialPlanEvent(state: PlanModeState) {
  return state.executing || state.pendingDecision || state.todos.length > 0
}

export function createTurnStartContext({
  diagnostics,
  send,
  session,
  sessionReset,
}: Omit<TurnStartContext, "firstStartPending" | "pendingEvents">) {
  return {
    diagnostics,
    firstStartPending: true,
    pendingEvents: [],
    send,
    session,
    sessionReset,
  }
}

export function finalizeAssistantTurn({
  activeTurn,
  body,
  runtime,
  send,
  session,
  sessionReset,
}: {
  activeTurn: AssistantTurnState
  body: ChatRequest
  runtime: AgentSessionRuntime
  send: (event: ChatStreamEvent) => void
  session: ChatRuntimeSession
  sessionReset: boolean
}) {
  if (!hasTurnContent(activeTurn)) {
    return undefined
  }

  persistAssistantTurnMessageId(runtime, activeTurn.assistantId)

  let parts = activeTurn.parts
  const assistantText = textFromParts(parts)
  const planTurn = finalizePlanTurn({
    runtime,
    assistantId: activeTurn.assistantId,
    assistantText,
    mode: body.mode,
    planAction: body.planAction,
  })

  if (planTurn?.planPart) {
    parts = upsertToolPart(parts, planTurn.planPart)
    send({ type: "tool", part: planTurn.planPart })
  }
  if (planTurn) {
    send(createPlanEvent(planTurn.state))
  }

  send({
    type: "done",
    runId: activeTurn.runId,
    message: toChatMessage(
      activeTurn.assistantId,
      "assistant",
      finalizeThinkingToolParts(parts)
    ),
    sessionFile: session.sessionFile,
    sessionId: session.sessionId,
    sessionReset,
  })

  return undefined
}

export function completeAssistantTurn({
  activeTurn,
  body,
  runtime,
  send,
  session,
  sessionReset,
}: {
  activeTurn: AssistantTurnState | undefined
  body: ChatRequest
  runtime: AgentSessionRuntime
  send: (event: ChatStreamEvent) => void
  session: ChatRuntimeSession
  sessionReset: boolean
}) {
  if (!activeTurn || !hasTurnContent(activeTurn)) {
    return undefined
  }

  return finalizeAssistantTurn({
    activeTurn,
    body,
    runtime,
    send,
    session,
    sessionReset,
  })
}

export function hasTurnContent(activeTurn: AssistantTurnState) {
  return activeTurn.parts.length > 0 || activeTurn.thinkingText.length > 0
}

export function beginAssistantTurn(startContext: TurnStartContext) {
  const activeTurn = createAssistantTurnState()
  startContext.send(
    createStartEvent(activeTurn.assistantId, startContext.session, {
      diagnostics: startContext.firstStartPending
        ? startContext.diagnostics
        : undefined,
      sessionReset: startContext.firstStartPending
        ? startContext.sessionReset
        : undefined,
    })
  )
  startContext.firstStartPending = false
  flushPendingTurnEvents(startContext)
  return activeTurn
}

function persistAssistantTurnMessageId(
  runtime: AgentSessionRuntime,
  chatMessageId: string
) {
  const sessionMessageId = findLatestUnmappedAssistantMessageId(
    runtime.session.sessionManager.getBranch()
  )
  if (!sessionMessageId) return

  persistChatMessageIdMapping(
    runtime.session.sessionManager,
    sessionMessageId,
    chatMessageId
  )
}

function emitBufferedTurnEvent(
  event: BufferedTurnEvent,
  activeTurn: AssistantTurnState | undefined,
  startContext: TurnStartContext
) {
  if (activeTurn) {
    startContext.send(event)
    return
  }

  startContext.pendingEvents.push(event)
}

function flushPendingTurnEvents(startContext: TurnStartContext) {
  if (startContext.pendingEvents.length === 0) return

  for (const event of startContext.pendingEvents) {
    startContext.send(event)
  }
  startContext.pendingEvents = []
}

function textFromParts(parts: Array<ChatMessagePart>) {
  return parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .filter(Boolean)
    .join("\n")
}

function createAssistantTurnState(): AssistantTurnState {
  const assistantId = crypto.randomUUID()

  return {
    assistantId,
    hadError: false,
    parts: [],
    runId: assistantId,
    thinkingText: "",
    toolInputs: new Map<string, Record<string, unknown>>(),
  }
}

function createStartEvent(
  assistantId: string,
  session: ChatRuntimeSession,
  options?: {
    diagnostics?: Array<string>
    sessionReset?: boolean
  }
): ChatStreamEvent {
  return {
    type: "start",
    id: assistantId,
    runId: assistantId,
    sessionFile: session.sessionFile,
    sessionId: session.sessionId,
    sessionReset: options?.sessionReset,
    diagnostics: options?.diagnostics,
  }
}

function isAssistantErrorMessage(
  message: unknown
): message is { role: "assistant"; stopReason: "error"; errorMessage: string } {
  return (
    message !== null &&
    typeof message === "object" &&
    "role" in message &&
    message.role === "assistant" &&
    "stopReason" in message &&
    message.stopReason === "error" &&
    "errorMessage" in message &&
    typeof message.errorMessage === "string"
  )
}

function isStateEvent(event: AgentSessionEvent): event is Extract<
  AgentSessionEvent,
  {
    type:
      | "agent_start"
      | "agent_end"
      | "turn_start"
      | "turn_end"
      | "message_start"
      | "message_end"
  }
> {
  return (
    event.type === "agent_start" ||
    event.type === "agent_end" ||
    event.type === "turn_start" ||
    event.type === "turn_end" ||
    event.type === "message_start" ||
    event.type === "message_end"
  )
}
