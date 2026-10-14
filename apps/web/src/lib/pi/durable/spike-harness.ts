import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context"
import {
  AssistantEntry,
  Harness,
  ToolTask,
  createRegistry,
  defineExtension,
  defineTool,
} from "@earendil-works/pi-durable"
import { Type } from "typebox"
import {
  agentWorkspaceBashBlock,
  agentWorkspaceMutationBlock,
} from "../command-policy"
import { classifyToolPath } from "../../../../../../.pi/extensions/lib/mutation-tier"
import { harnessSettingsFromLoop } from "./durable-loop-settings"
import { createSpikeExecutionEnv } from "./spike-env"
import type { ChatMode } from "@workspace/pi-protocol/chat-protocol"
import type { DurableLoopSettings } from "./durable-loop-settings"
import type {
  ConversationView,
  Storage,
  Submission,
  ToolExecutionApi,
  ToolExecutionResult,
} from "@earendil-works/pi-durable"
import type { Context } from "@earendil-works/chord"
import type { SpikeSandboxPort } from "./spike-env"

const context: Context = BACKGROUND_CONTEXT

export const SPIKE_MODEL_REPLY = "spike model reply"
export const SPIKE_ECHO_COMMAND = "echo fleet-pi-spike"
export const SPIKE_ECHO_TEXT = "fleet-pi-spike"

export type SpikeToolMode = "sandbox" | "model-only"

export type SpikeTrace = {
  reads: number
  writes: number
  bashes: number
  /** The first read or bash waits forever so a second harness can recover it. */
  hang: boolean
}

export function createSpikeTrace(): SpikeTrace {
  return { reads: 0, writes: 0, bashes: 0, hang: false }
}

type SpikeHarnessHandle = Awaited<ReturnType<typeof Harness.open>>

const spikeModel = {
  provider: "spike",
  id: "spike",
  api: "openai-completions",
  name: "spike",
}

/** Names any model other than the default so tests can see which one ran. */
function modelReplyMessage(modelId = "spike") {
  const text =
    modelId === "spike"
      ? SPIKE_MODEL_REPLY
      : `${SPIKE_MODEL_REPLY} from ${modelId}`
  return {
    role: "assistant" as const,
    content: [{ type: "text" as const, text }],
    stopReason: "stop" as const,
    api: "openai-completions" as const,
    provider: "spike",
    model: modelId,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    timestamp: Date.now(),
  }
}

export const spikeModels = {
  getModel(provider: string, modelId: string) {
    if (provider !== "spike") return undefined
    return { ...spikeModel, id: modelId, name: modelId }
  },
  streamSimple(model?: { id?: string }) {
    const message = modelReplyMessage(model?.id)
    return {
      *[Symbol.asyncIterator]() {
        yield { type: "text_delta", partial: message }
      },
      result: () => Promise.resolve(message),
    }
  },
  fetchDeferred() {
    return Promise.reject(new Error("Pi Durable spike has no deferred fetch"))
  },
  cancelDeferred() {
    return undefined
  },
}

function hangFirst(trace: SpikeTrace, count: number) {
  if (trace.hang && count === 1) return new Promise<void>(() => undefined)
  return Promise.resolve()
}

export function createScriptedPort(trace: SpikeTrace): SpikeSandboxPort {
  const files = new Map<string, string>([["notes.txt", "notes"]])
  return {
    async read(path) {
      trace.reads += 1
      await hangFirst(trace, trace.reads)
      return files.get(path) ?? ""
    },
    write(path, content) {
      const block = agentWorkspaceMutationBlock(path)
      if (block) return Promise.reject(new Error(block))
      trace.writes += 1
      files.set(path, content)
      return Promise.resolve()
    },
    async exec(command) {
      const block = agentWorkspaceBashBlock(command)
      if (block) return { exitCode: 1, output: block }
      trace.bashes += 1
      await hangFirst(trace, trace.bashes)
      const output = command.startsWith("echo ")
        ? `${command.slice("echo ".length)}\n`
        : ""
      return { exitCode: 0, output }
    },
  }
}

function blocked(text: string): ToolExecutionResult {
  return { output: [{ type: "text", text }], isError: true }
}

function requireEnv(api: ToolExecutionApi) {
  if (!api.env) throw new Error("Pi Durable spike tool has no execution env")
  return api.env
}

type ChatModeRef = { current: ChatMode }

function systemPath(path: string) {
  const classified = classifyToolPath(path)
  return (
    classified.scoped &&
    (classified.relativePath === "system" ||
      classified.relativePath.startsWith("system/"))
  )
}

function mutationGate(
  mode: ChatMode,
  path: string,
  confirm: boolean | undefined
) {
  if (mode === "harness" && systemPath(path)) {
    if (confirm === true) return undefined
    return "Confirmation required before a tool writes system/."
  }
  return agentWorkspaceMutationBlock(path)
}

function bashGate(
  mode: ChatMode,
  command: string,
  confirm: boolean | undefined
) {
  if (mode === "harness" && confirm === true) {
    const block = agentWorkspaceBashBlock(command)
    if (block?.includes("system/")) return undefined
    return block
  }
  if (mode === "harness" && /(?:^|[\s"'`])system\//.test(command)) {
    return "Confirmation required before a tool writes system/."
  }
  return agentWorkspaceBashBlock(command)
}

function sandboxTools(mode: ChatModeRef) {
  const read = defineTool({
    name: "read",
    description: "Read a file in the user sandbox.",
    replay: "safe",
    parameters: Type.Object({ path: Type.String() }),
    execute: async (args: { path: string }, api: ToolExecutionApi) => {
      const text = await requireEnv(api).readTextFile(args.path, context)
      if (!text.ok) throw new Error(text.error.message)
      return { output: [{ type: "text" as const, text: text.value }] }
    },
  })
  const search = defineTool({
    name: "search",
    description: "Search a file in the user sandbox.",
    replay: "safe",
    parameters: Type.Object({ path: Type.String() }),
    execute: async (args: { path: string }, api: ToolExecutionApi) => {
      const text = await requireEnv(api).readTextFile(args.path, context)
      if (!text.ok) throw new Error(text.error.message)
      return { output: [{ type: "text" as const, text: text.value }] }
    },
  })
  const write = defineTool({
    name: "write",
    description: "Write a file in the user sandbox.",
    parameters: Type.Object({
      path: Type.String(),
      content: Type.String(),
      confirm: Type.Optional(Type.Boolean()),
    }),
    execute: async (
      args: { path: string; content: string; confirm?: boolean },
      api: ToolExecutionApi
    ) => {
      const block = mutationGate(mode.current, args.path, args.confirm)
      if (block) return blocked(block)
      const written = await requireEnv(api).writeFile(
        args.path,
        args.content,
        context
      )
      if (!written.ok) throw new Error(written.error.message)
      return { output: [{ type: "text" as const, text: "wrote" }] }
    },
  })
  const edit = defineTool({
    name: "edit",
    description: "Edit a file in the user sandbox.",
    parameters: Type.Object({
      path: Type.String(),
      content: Type.String(),
      confirm: Type.Optional(Type.Boolean()),
    }),
    execute: async (
      args: { path: string; content: string; confirm?: boolean },
      api: ToolExecutionApi
    ) => {
      const block = mutationGate(mode.current, args.path, args.confirm)
      if (block) return blocked(block)
      const written = await requireEnv(api).writeFile(
        args.path,
        args.content,
        context
      )
      if (!written.ok) throw new Error(written.error.message)
      return { output: [{ type: "text" as const, text: "edited" }] }
    },
  })
  const bash = defineTool({
    name: "bash",
    description: "Run a command in the user sandbox.",
    parameters: Type.Object({
      command: Type.String(),
      confirm: Type.Optional(Type.Boolean()),
    }),
    execute: async (
      args: { command: string; confirm?: boolean },
      api: ToolExecutionApi
    ) => {
      const block = bashGate(mode.current, args.command, args.confirm)
      if (block) return blocked(block)
      let output = ""
      const result = await requireEnv(api).exec(
        args.command,
        {
          onOutput: (text) => {
            output += text
          },
        },
        context
      )
      if (!result.ok) throw new Error(result.error.message)
      return { output: [{ type: "text" as const, text: output }] }
    },
  })
  return [read, search, write, edit, bash]
}

function registryFor() {
  const registry = createRegistry()
  const chatMode: ChatModeRef = { current: "agent" }
  const tools = sandboxTools(chatMode)
  registry.install(defineExtension({ name: "spike-sandbox", tools }))
  return {
    registry,
    tools,
    chatMode,
    toolNames: tools.map((tool) => tool.name),
  }
}

export function toolsForChatMode<T extends { name: string }>(
  tools: Array<T>,
  mode: ChatMode,
  toolsAvailable: boolean
): Array<T> {
  if (!toolsAvailable) return []
  if (mode === "plan") {
    return tools.filter(
      (tool) => tool.name === "read" || tool.name === "search"
    )
  }
  return tools
}

async function assistantToolCall(
  harness: SpikeHarnessHandle,
  name: string,
  args: Record<string, string>,
  callId: string
) {
  const root = await harness.root(context)
  const entry = await root.commit(
    (tx) =>
      tx.appendEntry(AssistantEntry, root.id, {
        model: [
          {
            role: "assistant",
            content: [{ type: "toolCall", id: callId, name, arguments: args }],
            stopReason: "toolUse",
            api: "openai-completions",
            provider: "spike",
            model: "spike",
            usage: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 0,
              cost: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                total: 0,
              },
            },
            timestamp: Date.now(),
          },
        ],
      }),
    context
  )
  await root.commit(async (tx) => {
    await tx.createTask(
      ToolTask,
      { kind: "model", assistant: entry.id, callId },
      { ownership: { kind: "conversation" }, conversationId: root.id }
    )
  }, context)
  harness.resume()
}

async function readTranscript(harness: SpikeHarnessHandle): Promise<string> {
  const root = await harness.root(context)
  const page = await root.entries(
    { order: "ascending" },
    50,
    undefined,
    context
  )
  return JSON.stringify(page.items)
}

export type SpikeHarnessModel = { provider: string; modelId: string }

export type SpikeHarnessOptions = {
  models?: unknown
  model?: SpikeHarnessModel
  loop?: DurableLoopSettings
}

export type DurableConversationSummary = {
  id: string
  firstMessage: string
  messageCount: number
}

export class DurableConversationMissing extends Error {
  constructor(conversationId: string) {
    super(`Pi Durable conversation ${conversationId} was not found`)
    this.name = "DurableConversationMissing"
  }
}

export type OpenSpikeHarness = {
  toolNames: Array<string>
  rootId: () => Promise<string>
  resume: () => void
  transcript: () => Promise<string>
  runEcho: () => Promise<{ rootId: string; transcript: string }>
  runBlockedBash: (command: string) => Promise<string>
  beginHanging: (tool: "read" | "bash") => Promise<void>
  modelReply: (prompt: string) => Promise<string>
  appliedSettings: ReturnType<typeof harnessSettingsFromLoop>
  runAgentTurn: (input: {
    prompt: string
    conversationId?: string
    create: boolean
    model: SpikeHarnessModel
    chatMode?: ChatMode
    whenBusy?: "steer" | "followUp"
    onView: (view: ConversationView) => void
    signal?: AbortSignal
  }) => Promise<{ conversationId: string; thinkingLevel?: string }>
  submitBusy: (input: {
    prompt: string
    whenBusy: "steer" | "followUp"
  }) => Promise<void>
  forkConversation: (conversationId: string, entryId: string) => Promise<string>
  listConversations: () => Promise<Array<DurableConversationSummary>>
  readConversation: (
    conversationId: string
  ) => Promise<ConversationView | undefined>
}

export async function openSpikeHarness(
  storage: Storage,
  mode: SpikeToolMode,
  port: SpikeSandboxPort,
  options?: SpikeHarnessOptions
): Promise<OpenSpikeHarness> {
  const { registry, tools, chatMode } = registryFor()
  const offeredNames = toolsForChatMode(tools, "agent", mode === "sandbox").map(
    (tool) => tool.name
  )
  const agentModel = options?.model ?? { provider: "spike", modelId: "spike" }
  const appliedSettings = harnessSettingsFromLoop(options?.loop)
  const harness = await Harness.open(
    storage,
    {
      models: (options?.models ?? spikeModels) as never,
      registry,
      settings: appliedSettings,
      env: () => createSpikeExecutionEnv("spike-sandbox", port),
    },
    context
  )
  let liveConversation:
    Awaited<ReturnType<SpikeHarnessHandle["conversation"]>> | undefined
  const root = await harness.root(context, {
    agent: { model: agentModel },
  })
  return {
    toolNames: offeredNames,
    appliedSettings,
    resume: () => harness.resume(),
    rootId: () => Promise.resolve(String(root.id)),
    transcript: () => readTranscript(harness),
    async runEcho() {
      await assistantToolCall(
        harness,
        "bash",
        { command: SPIKE_ECHO_COMMAND },
        "echo-1"
      )
      const transcript = await waitForText(
        () => readTranscript(harness),
        SPIKE_ECHO_TEXT
      )
      return { rootId: String(root.id), transcript }
    },
    async runBlockedBash(command) {
      await assistantToolCall(harness, "bash", { command }, "block-1")
      return waitForText(() => readTranscript(harness), "protected")
    },
    async beginHanging(tool) {
      if (tool === "bash") {
        await assistantToolCall(
          harness,
          "bash",
          { command: "echo hang" },
          "bash-hang"
        )
        return
      }
      await assistantToolCall(
        harness,
        "read",
        { path: "notes.txt" },
        "read-hang"
      )
    },
    async modelReply(prompt) {
      const submission = await root.submit(
        { type: "input", content: prompt },
        context
      )
      await submission.wait(context)
      return waitForText(() => readTranscript(harness), SPIKE_MODEL_REPLY)
    },
    async runAgentTurn(input) {
      const conversation = input.create
        ? await harness.createConversation(
            {
              ownership: { kind: "ownerless" },
              agent: {
                model: input.model,
                ...(options?.loop?.thinkingLevel
                  ? { thinkingLevel: options.loop.thinkingLevel }
                  : {}),
              },
            },
            context
          )
        : await harness.conversation(
            asConversationId(input.conversationId),
            context
          )
      if (!conversation) {
        throw new DurableConversationMissing(input.conversationId ?? "")
      }
      liveConversation = conversation
      const chatModeValue = input.chatMode ?? "agent"
      chatMode.current = chatModeValue
      const selected = toolsForChatMode(
        tools,
        chatModeValue,
        mode === "sandbox"
      )
      offeredNames.splice(
        0,
        offeredNames.length,
        ...selected.map((tool) => tool.name)
      )
      // The harness registry only knows the model chosen for this turn, so a
      // resumed conversation must switch to it before the next request.
      await conversation.configure(
        { tools: selected, model: input.model },
        context
      )
      const view = await conversation.viewState(context)
      input.onView(view.value)
      const gate = { stopped: false }
      const pump = (async () => {
        while (!gate.stopped) {
          if (input.signal?.aborted) {
            throw new DOMException("Aborted", "AbortError")
          }
          await new Promise((resolve) => setTimeout(resolve, 40))
          input.onView(view.value)
        }
      })()
      try {
        const submission = await conversation.submit(
          {
            type: "input",
            content: input.prompt,
            ...(input.whenBusy ? { whenBusy: input.whenBusy } : {}),
          },
          context
        )
        await waitForAgentTurn(
          input.signal,
          async () => {
            await submission.wait(context)
          },
          () => abortAgentSubmission(submission)
        )
      } finally {
        gate.stopped = true
        liveConversation = undefined
        input.onView(view.value)
        await pump
      }
      const agent = await conversation.agent(context)
      return {
        conversationId: String(conversation.id),
        thinkingLevel: agent.thinkingLevel,
      }
    },
    async submitBusy(input) {
      const conversation = liveConversation
      if (!conversation) {
        throw new Error("No hosted turn is in progress")
      }
      await conversation.submit(
        { type: "input", content: input.prompt, whenBusy: input.whenBusy },
        context
      )
    },
    async forkConversation(conversationId, entryId) {
      const conversation = await harness.conversation(
        conversationId as never,
        context
      )
      if (!conversation) throw new DurableConversationMissing(conversationId)
      // No agent override: a fork inherits the parent's agent at the fork entry.
      const forked = await conversation.fork(
        entryId as never,
        { ownership: { kind: "ownerless" } },
        context
      )
      return String(forked.id)
    },
    async listConversations() {
      const page = await harness.commit(
        (tx) => tx.scanConversations({ order: "descending" }, 50),
        context
      )
      const summaries: Array<DurableConversationSummary> = []
      for (const record of page.items) {
        const conversation = await harness.conversation(record.id, context)
        if (!conversation) continue
        const entries = await conversation.entries(
          { order: "ascending" },
          20,
          undefined,
          context
        )
        const firstUser = entries.items.find((entry) =>
          entry.model?.some((message) => message.role === "user")
        )
        const firstText = firstUserText(firstUser?.model)
        summaries.push({
          id: String(record.id),
          firstMessage: firstText,
          messageCount: entries.items.length,
        })
      }
      return summaries
    },
    async readConversation(conversationId) {
      const conversation = await harness.conversation(
        asConversationId(conversationId),
        context
      )
      if (!conversation) return undefined
      return (await conversation.viewState(context)).value
    },
  }
}

function abortAgentSubmission(submission: Submission): Promise<void> {
  return submission.abort(context).then(() => undefined)
}

function waitForAgentTurn(
  signal: AbortSignal | undefined,
  run: () => Promise<void>,
  abortHook?: () => Promise<void>
): Promise<void> {
  if (!signal) {
    return run()
  }
  if (signal.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"))
  }
  return new Promise((resolve, reject) => {
    const onSignalAbort = () => {
      void (abortHook ? abortHook() : Promise.resolve()).finally(() => {
        reject(new DOMException("Aborted", "AbortError"))
      })
    }
    signal.addEventListener("abort", onSignalAbort, { once: true })
    run().then(
      (value) => {
        signal.removeEventListener("abort", onSignalAbort)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onSignalAbort)
        reject(error)
      }
    )
  })
}

function asConversationId(conversationId: string | undefined) {
  const id = Number(conversationId)
  if (!Number.isInteger(id) || id <= 0) {
    throw new DurableConversationMissing(conversationId ?? "")
  }
  return id as never
}

function firstUserText(
  model: ReadonlyArray<{ role?: string; content?: unknown }> | undefined
) {
  const user = model?.find((message) => message.role === "user")
  if (!user) return ""
  if (typeof user.content === "string") return user.content
  if (!Array.isArray(user.content)) return ""
  return user.content
    .map((part) => {
      if (!part || typeof part !== "object" || !("text" in part)) return ""
      return typeof part.text === "string" ? part.text : ""
    })
    .join("")
}

async function waitForText(
  read: () => Promise<string>,
  needle: string
): Promise<string> {
  const started = Date.now()
  let latest = ""
  while (Date.now() - started < 4000) {
    latest = await read()
    if (latest.includes(needle)) return latest
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error(`Timed out waiting for ${needle}. Last transcript: ${latest}`)
}

export async function waitForCount(
  read: () => number,
  target: number
): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < 4000) {
    if (read() >= target) return
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error(`Timed out waiting for count ${target}, saw ${read()}`)
}
