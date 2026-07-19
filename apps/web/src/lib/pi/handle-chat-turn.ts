import type { RunProvenanceRecorder } from "@/lib/pi/run-provenance"
import type {
  AssistantTurnState,
  TurnStartContext,
} from "@/lib/pi/server-chat-stream"
import type { AppRuntimeContext } from "@/lib/app-runtime"
import type {
  ChatRequest,
  ChatStreamEvent,
} from "@workspace/pi-protocol/chat-protocol"
import { syncPiSessionMirrorSafely } from "@/lib/db/pi-session-mirror"
import { scheduleSessionBlobPersist } from "@/lib/pi/server-sessions"
import { createPlanEvent, getPlanState } from "@/lib/pi/plan-mode"
import {
  createPiRuntime,
  getErrorMessage,
  retainPiRuntime,
} from "@/lib/pi/server"
import {
  beginAssistantTurn,
  completeAssistantTurn,
  createTurnStartContext,
  finalizeAssistantTurn,
  handleSessionEvent,
  shouldEmitInitialPlanEvent,
} from "@/lib/pi/server-chat-stream"
import { resolveAppRuntimeContext } from "@/lib/app-runtime"
import { sanitizePii } from "@/lib/pii/sanitizer"

export type HandleChatTurnParams = {
  body: ChatRequest
  signal: AbortSignal
  recorder: RunProvenanceRecorder
  runtimeContext?: AppRuntimeContext
  prompt?: string
}

export async function* handleChatTurn(
  params: HandleChatTurnParams
): AsyncGenerator<ChatStreamEvent> {
  const runtimeContext = params.runtimeContext ?? resolveAppRuntimeContext()
  const rawPrompt =
    params.prompt ??
    (typeof params.body.message === "string" ? params.body.message.trim() : "")
  const prompt = sanitizePii(rawPrompt)

  if (!prompt) {
    throw new Error("Missing message")
  }

  const pending: Array<ChatStreamEvent> = []
  let notify: (() => void) | undefined
  const turnState = { finished: false }

  const send = (event: ChatStreamEvent) => {
    params.recorder.record(event)
    pending.push(event)
    notify?.()
    notify = undefined
  }

  const turnPromise = runChatTurn({
    body: params.body,
    prompt,
    runtimeContext,
    send,
    signal: params.signal,
  }).finally(() => {
    turnState.finished = true
    notify?.()
  })

  while (!turnState.finished || pending.length > 0) {
    while (pending.length > 0) {
      yield pending.shift()!
    }
    if (!turnState.finished) {
      await new Promise<void>((resolve) => {
        notify = resolve
      })
    }
  }

  await turnPromise
}

type RunChatTurnParams = {
  body: ChatRequest
  prompt: string
  runtimeContext: AppRuntimeContext
  send: (event: ChatStreamEvent) => void
  signal: AbortSignal
}

async function runChatTurn({
  body,
  prompt,
  runtimeContext,
  send,
  signal,
}: RunChatTurnParams) {
  let unsubscribe: (() => void) | undefined
  let releaseRuntime: (() => void) | undefined
  let activeTurn: AssistantTurnState | undefined
  let turnStartContext: TurnStartContext | undefined
  let queuedPromptCount = 0

  try {
    const result = await createPiRuntime(runtimeContext, body, body.model)
    const currentSession = result.runtime.session
    releaseRuntime = retainPiRuntime(result.runtime, body.userId)

    const abort = () => void currentSession.abort()
    signal.addEventListener("abort", abort, { once: true })

    const initialPlanState = getPlanState(result.runtime)
    if (shouldEmitInitialPlanEvent(initialPlanState)) {
      send(createPlanEvent(initialPlanState))
    }

    turnStartContext = createTurnStartContext({
      diagnostics: result.diagnostics,
      send,
      session: currentSession,
      sessionReset: result.sessionReset,
    })

    unsubscribe = currentSession.subscribe((event) => {
      const nextTurn = handleSessionEvent(event, activeTurn, turnStartContext!)
      activeTurn = nextTurn

      if (event.type === "queue_update") {
        const nextQueuedPromptCount =
          event.steering.length + event.followUp.length

        if (
          nextQueuedPromptCount < queuedPromptCount &&
          activeTurn &&
          !activeTurn.hadError
        ) {
          activeTurn = finalizeAssistantTurn({
            activeTurn,
            body,
            runtime: result.runtime,
            send,
            session: currentSession,
            sessionReset: result.sessionReset,
          })
        }

        queuedPromptCount = nextQueuedPromptCount
      }
    })

    await currentSession.prompt(prompt, {
      expandPromptTemplates: true,
    })
    await currentSession.waitForIdle()
    signal.removeEventListener("abort", abort)

    activeTurn = completeAssistantTurn({
      activeTurn,
      body,
      runtime: result.runtime,
      send,
      session: currentSession,
      sessionReset: result.sessionReset,
    })

    void syncPiSessionMirrorSafely(result.runtime.session.sessionManager, {
      userId: body.userId,
    })
    scheduleSessionBlobPersist({
      userId: body.userId,
      sessionManager: result.runtime.session.sessionManager,
    })
  } catch (error) {
    if (!signal.aborted) {
      if (turnStartContext?.firstStartPending) {
        const errorTurn = beginAssistantTurn(turnStartContext)
        send({
          type: "error",
          message: getErrorMessage(error),
          runId: errorTurn.runId,
        })
      } else {
        send({ type: "error", message: getErrorMessage(error) })
      }
    }
  } finally {
    unsubscribe?.()
    releaseRuntime?.()
  }
}
