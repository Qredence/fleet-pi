import { openDurableObjectSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/cloudflare"
import { DurableObject } from "cloudflare:workers"
import { createDurableModels } from "./durable-model"
import {
  createDurableViewDiff,
  eventsFromConversationView,
  messagesFromEntries,
} from "./durable-events"
import { durableLoopSettingsKey } from "./durable-loop-settings"
import { durableSessionId } from "./durable-session"
import { openDaytonaSandboxPort } from "./durable-sandbox-port"
import {
  DurableConversationMissing,
  createScriptedPort,
  createSpikeTrace,
  openSpikeHarness,
  spikeModels,
  waitForCount,
} from "./spike-harness"
import type {
  ChatMode,
  ChatStreamEvent,
  ChatThinkingLevel,
  ChatWorkspaceStatus,
} from "@workspace/pi-protocol/chat-protocol"
import type { ChatToolPart } from "@workspace/pi-protocol/chat-types"
import type { DurableObjectState } from "cloudflare:workers"
import type { DurableAgentModelConfig } from "./durable-model"
import type { DurableLoopSettings } from "./durable-loop-settings"
import type { DurableSandboxConnection } from "./durable-sandbox-port"
import type { SpikeSandboxPort } from "./spike-env"
import type {
  OpenSpikeHarness,
  SpikeHarnessOptions,
  SpikeToolMode,
  SpikeTrace,
} from "./spike-harness"

export { userPiDurableName, userPiDurableStub } from "./durable-binding"

export type UserPiDurableStorageOwner = {
  objectId: string
  userId: string | undefined
}

export type UserPiDurableEcho = {
  rootId: string
  transcript: string
}

export type UserPiDurableStub = {
  readonly id: { toString: () => string }
  storageOwner: () => Promise<UserPiDurableStorageOwner>
  rootConversation: () => Promise<{ rootId: string }>
  scriptedBashEcho: () => Promise<UserPiDurableEcho>
  restart: () => Promise<{ rootId: string; transcript: string }>
  beginHangingRead: () => Promise<{ reads: number }>
  beginHangingBash: () => Promise<{ bashes: number }>
  replayRead: () => Promise<{ reads: number; rootId: string }>
  replayBash: () => Promise<{ bashes: number; transcript: string }>
  modelOnlyReply: (
    prompt: string
  ) => Promise<{ tools: Array<string>; transcript: string }>
}

type PiDurableStorage = Awaited<
  ReturnType<typeof openDurableObjectSqliteStorage>
>

type AgentTurnBody = {
  prompt: string
  create: boolean
  conversationId?: string
  model: DurableAgentModelConfig
  sandbox?: DurableSandboxConnection
  workspace?: ChatWorkspaceStatus
  whenBusy?: "steer" | "followUp"
  mode?: ChatMode
  loop?: DurableLoopSettings
}

const DELETED_CONVERSATIONS_KEY = "fleet-pi:deleted-conversations"

type ActiveAgentTurn = {
  abortController: AbortController
}

/** One SQLite Durable Object per user id. */
export class UserPiDurable extends DurableObject {
  #storage: PiDurableStorage | undefined
  #harness: OpenSpikeHarness | undefined
  #trace: SpikeTrace = createSpikeTrace()
  #port: SpikeSandboxPort = createScriptedPort(this.#trace)
  #mode: SpikeToolMode = "sandbox"
  #sandboxConnectionKey: string | undefined
  #harnessModelKey: string | undefined
  #loopKey = ""
  #queue: { steering: Array<string>; followUp: Array<string> } = {
    steering: [],
    followUp: [],
  }
  #activeTurn: ActiveAgentTurn | undefined

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env)
    void ctx.blockConcurrencyWhile(() => this.#open("sandbox"))
  }

  storageOwner(): Promise<UserPiDurableStorageOwner> {
    if (this.#storage === undefined) {
      return Promise.reject(new Error("Pi Durable storage is not open"))
    }
    return Promise.resolve({
      objectId: this.ctx.id.toString(),
      userId: this.ctx.id.name,
    })
  }

  async rootConversation() {
    const harness = await this.#requireHarness()
    return { rootId: await harness.rootId() }
  }

  async scriptedBashEcho(): Promise<UserPiDurableEcho> {
    const harness = await this.#requireHarness()
    return harness.runEcho()
  }

  async restart() {
    const harness = await this.#reopen()
    return {
      rootId: await harness.rootId(),
      transcript: await harness.transcript(),
    }
  }

  async beginHangingRead() {
    this.#trace.hang = true
    const harness = await this.#requireHarness()
    await harness.beginHanging("read")
    await waitForCount(() => this.#trace.reads, 1)
    return { reads: this.#trace.reads }
  }

  async beginHangingBash() {
    this.#trace.hang = true
    const harness = await this.#requireHarness()
    await harness.beginHanging("bash")
    await waitForCount(() => this.#trace.bashes, 1)
    return { bashes: this.#trace.bashes }
  }

  async replayRead() {
    const harness = await this.#reopen()
    harness.resume()
    await waitForCount(() => this.#trace.reads, 2)
    return { reads: this.#trace.reads, rootId: await harness.rootId() }
  }

  async replayBash() {
    const harness = await this.#reopen()
    harness.resume()
    const transcript = await harness.transcript()
    const started = Date.now()
    let latest = transcript
    while (!latest.includes("interrupted") && Date.now() - started < 4000) {
      await new Promise((resolve) => setTimeout(resolve, 20))
      latest = await harness.transcript()
    }
    return { bashes: this.#trace.bashes, transcript: latest }
  }

  async modelOnlyReply(prompt: string) {
    this.#mode = "model-only"
    const harness = await this.#reopen()
    const transcript = await harness.modelReply(prompt)
    return { tools: harness.toolNames, transcript }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === "POST" && url.pathname === "/agent") {
      return this.#agentTurn(request)
    }
    if (request.method === "POST" && url.pathname === "/agent/abort") {
      return this.#abortAgentTurn()
    }
    if (request.method === "GET" && url.pathname === "/sessions") {
      return this.#listSessions()
    }
    if (request.method === "GET" && url.pathname === "/session") {
      return this.#readSession(url.searchParams.get("id"))
    }
    if (request.method === "DELETE" && url.pathname === "/session") {
      return this.#deleteSession(url.searchParams.get("id"))
    }
    if (request.method === "POST" && url.pathname === "/fork") {
      return this.#forkSession(request)
    }
    return new Response("Not found", { status: 404 })
  }

  async #forkSession(request: Request): Promise<Response> {
    const body = (await request.json()) as {
      conversationId?: string
      entryId?: string
    }
    if (!body.conversationId || !body.entryId) {
      return Response.json(
        { message: "conversationId and entryId are required" },
        { status: 400 }
      )
    }
    const harness = await this.#reopen()
    const conversationId = await harness.forkConversation(
      body.conversationId,
      body.entryId
    )
    return Response.json({
      sessionId: durableSessionId(conversationId),
      conversationId,
    })
  }

  #abortAgentTurn(): Response {
    if (!this.#activeTurn) {
      return Response.json({ aborted: false })
    }
    this.#activeTurn.abortController.abort()
    return Response.json({ aborted: true })
  }

  async #agentTurn(request: Request): Promise<Response> {
    const body = (await request.json()) as Partial<AgentTurnBody>
    if (
      this.#activeTurn &&
      this.#harness &&
      body.prompt &&
      (body.whenBusy === "steer" || body.whenBusy === "followUp")
    ) {
      try {
        await this.#harness.submitBusy({
          prompt: body.prompt,
          whenBusy: body.whenBusy,
        })
      } catch {
        return Response.json(
          { message: "An agent turn is already in progress." },
          { status: 409 }
        )
      }
      const next = {
        steering: [...this.#queue.steering],
        followUp: [...this.#queue.followUp],
      }
      next[body.whenBusy === "steer" ? "steering" : "followUp"].push(
        body.prompt
      )
      this.#queue = next
      return new Response(`${JSON.stringify({ type: "queue", ...next })}\n`, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
        },
      })
    }
    if (this.#activeTurn) {
      return Response.json(
        { message: "An agent turn is already in progress." },
        { status: 409 }
      )
    }
    const abortController = new AbortController()
    this.#activeTurn = { abortController }
    this.#queue = { steering: [], followUp: [] }
    const model = body.model
    const prompt = body.prompt
    if (!model?.apiKey || !model.modelId || !prompt) {
      this.#activeTurn = undefined
      return Response.json(
        { message: "Choose a model in Settings." },
        { status: 400 }
      )
    }
    const turnMode: SpikeToolMode = body.sandbox ? "sandbox" : "model-only"
    let portChanged = false
    if (body.sandbox) {
      const connectionKey = sandboxConnectionKey(body.sandbox)
      if (connectionKey !== this.#sandboxConnectionKey) {
        this.#port = await openDaytonaSandboxPort(body.sandbox)
        this.#sandboxConnectionKey = connectionKey
        portChanged = true
      }
    } else {
      this.#sandboxConnectionKey = undefined
      if (this.#mode === "sandbox") {
        portChanged = true
      }
    }
    this.#mode = turnMode
    const modelRef = { provider: model.provider, modelId: model.modelId }
    const models = modelsForAgentTurn(model)
    let harness: OpenSpikeHarness
    try {
      harness = await this.#ensureHarness(
        turnMode,
        {
          models,
          model: modelRef,
          loop: body.loop,
        },
        portChanged
      )
    } catch (error) {
      this.#activeTurn = undefined
      throw error
    }
    const onClientAbort = () => abortController.abort()
    if (request.signal.aborted) {
      abortController.abort()
    } else {
      request.signal.addEventListener("abort", onClientAbort, { once: true })
    }
    const encoder = new TextEncoder()
    const readable = new ReadableStream<Uint8Array>({
      start: async (controller) => {
        const send = (event: ChatStreamEvent) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
        }
        const messageId = crypto.randomUUID()
        const runId = crypto.randomUUID()
        const diff = createDurableViewDiff()
        let baselined = false
        let started = false
        let streamedText = ""
        let sessionId = body.conversationId
          ? durableSessionId(body.conversationId)
          : "durable:pending"
        const streamedTools = new Map<string, ChatToolPart>()
        const signal = abortController.signal
        try {
          const result = await harness.runAgentTurn({
            prompt,
            conversationId: body.conversationId,
            create: body.create === true,
            whenBusy: body.whenBusy,
            chatMode: body.mode,
            model: {
              provider: model.provider,
              modelId: model.modelId,
            },
            signal,
            onView: (view) => {
              sessionId = durableSessionId(String(view.conversation.id))
              if (!started) {
                started = true
                send({
                  type: "start",
                  id: messageId,
                  runId,
                  sessionId,
                  workspace: body.sandbox
                    ? { toolsAvailable: true }
                    : (body.workspace ?? {
                        toolsAvailable: false,
                        reason: "daytona_credential_required",
                      }),
                  ...thinkingLevelEvent(view),
                })
              }
              const events = eventsFromConversationView(view, diff)
              if (!baselined) {
                baselined = true
                return
              }
              for (const event of events) {
                if (event.type === "delta") streamedText += event.text
                if (
                  event.type === "tool" &&
                  typeof event.part.toolCallId === "string"
                ) {
                  streamedTools.set(event.part.toolCallId, event.part)
                }
                send(event)
              }
            },
          })
          send({
            type: "done",
            runId,
            sessionId: durableSessionId(result.conversationId),
            message: {
              id: messageId,
              role: "assistant",
              parts: [
                ...(streamedText
                  ? [{ type: "text" as const, text: streamedText }]
                  : []),
                ...streamedTools.values(),
              ],
            },
          })
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            send({
              type: "done",
              runId,
              sessionId,
              stopReason: "aborted",
              message: {
                id: messageId,
                role: "assistant",
                parts: [
                  ...(streamedText
                    ? [{ type: "text" as const, text: streamedText }]
                    : []),
                  ...streamedTools.values(),
                ],
              },
            })
            return
          }
          send({
            type: "error",
            message:
              error instanceof Error ? error.message : "Agent turn failed",
          })
        } finally {
          request.signal.removeEventListener("abort", onClientAbort)
          controller.close()
          this.#activeTurn = undefined
        }
      },
    })
    return new Response(readable, {
      headers: {
        "Cache-Control": "no-cache",
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    })
  }

  async #listSessions(): Promise<Response> {
    const harness = await this.#requireHarness()
    const deleted = await this.#readDeletedConversations()
    const sessions = (await harness.listConversations()).filter(
      (session) => !deleted.has(session.id)
    )
    return Response.json({ sessions })
  }

  async #deleteSession(conversationId: string | null): Promise<Response> {
    if (!conversationId) {
      return Response.json({ message: "Missing conversation" }, { status: 400 })
    }
    const harness = await this.#requireHarness()
    const existing = await harness.readConversation(conversationId)
    const deleted = await this.#readDeletedConversations()
    if (!existing && deleted.has(conversationId)) {
      return Response.json({ deleted: true })
    }
    if (!existing) {
      return Response.json({ message: "Session not found" }, { status: 404 })
    }
    deleted.add(conversationId)
    await durableObjectKv(this.ctx.storage).put(DELETED_CONVERSATIONS_KEY, [
      ...deleted,
    ])
    return Response.json({ deleted: true })
  }

  async #readSession(conversationId: string | null): Promise<Response> {
    if (!conversationId) {
      return Response.json({ message: "Missing conversation" }, { status: 400 })
    }
    if ((await this.#readDeletedConversations()).has(conversationId)) {
      return Response.json({ message: "Session not found" }, { status: 404 })
    }
    const harness = await this.#requireHarness()
    try {
      const view = await harness.readConversation(conversationId)
      if (!view) {
        return Response.json({ message: "Session not found" }, { status: 404 })
      }
      return Response.json({
        id: conversationId,
        messages: messagesFromEntries(view.entries),
      })
    } catch (error) {
      if (error instanceof DurableConversationMissing) {
        return Response.json({ message: "Session not found" }, { status: 404 })
      }
      throw error
    }
  }

  async #open(
    mode: SpikeToolMode,
    options?: SpikeHarnessOptions
  ): Promise<OpenSpikeHarness> {
    this.#mode = mode
    this.#harnessModelKey = harnessModelKey(options?.model)
    this.#loopKey = durableLoopSettingsKey(options?.loop)
    const storage = await openDurableObjectSqliteStorage(this.ctx.storage)
    this.#storage = storage
    this.#harness = await openSpikeHarness(storage, mode, this.#port, options)
    return this.#harness
  }

  async #ensureHarness(
    mode: SpikeToolMode,
    options: SpikeHarnessOptions,
    portChanged: boolean
  ): Promise<OpenSpikeHarness> {
    const modelKey = harnessModelKey(options.model)
    const loopKey = durableLoopSettingsKey(options.loop)
    if (
      !portChanged &&
      this.#harness !== undefined &&
      this.#mode === mode &&
      this.#harnessModelKey === modelKey &&
      this.#loopKey === loopKey
    ) {
      return this.#harness
    }
    return this.#open(mode, options)
  }

  async #reopen() {
    await this.#open(this.#mode)
    return this.#requireHarness()
  }

  #requireHarness() {
    if (this.#harness === undefined) {
      return Promise.reject(new Error("Pi Durable harness is not open"))
    }
    return Promise.resolve(this.#harness)
  }

  async #readDeletedConversations(): Promise<Set<string>> {
    const stored = await durableObjectKv(this.ctx.storage).get<Array<string>>(
      DELETED_CONVERSATIONS_KEY
    )
    return new Set(stored ?? [])
  }
}

const THINKING_LEVELS = new Set<ChatThinkingLevel>([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
])

function thinkingLevelEvent(view: {
  docs?: Readonly<Record<string, unknown>>
}): { thinkingLevel?: ChatThinkingLevel } {
  const agent = view.docs?.["pi.agent"]
  if (!agent || typeof agent !== "object" || Array.isArray(agent)) return {}
  const level = (agent as { thinkingLevel?: unknown }).thinkingLevel
  if (
    typeof level !== "string" ||
    !THINKING_LEVELS.has(level as ChatThinkingLevel)
  ) {
    return {}
  }
  return { thinkingLevel: level as ChatThinkingLevel }
}

function modelsForAgentTurn(model: DurableAgentModelConfig) {
  if (model.provider === "spike" && model.modelId === "spike") {
    return spikeModels
  }
  return createDurableModels(model)
}

function harnessModelKey(model: SpikeHarnessOptions["model"]) {
  if (!model) return ""
  return `${model.provider}\0${model.modelId}`
}

function sandboxConnectionKey(connection: DurableSandboxConnection) {
  return [
    connection.sandboxId,
    connection.apiUrl ?? "",
    connection.target ?? "",
  ].join("\0")
}

type DurableObjectKv = {
  get: <T>(key: string) => Promise<T | undefined>
  put: (key: string, value: unknown) => Promise<void>
}

function durableObjectKv(
  storage: DurableObjectState["storage"]
): DurableObjectKv {
  return storage as unknown as DurableObjectKv
}
