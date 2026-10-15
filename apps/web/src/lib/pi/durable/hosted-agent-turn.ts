import { getVolumeName } from "../../daytona/user-sandbox"
import { readBoundWorkerEnv } from "../../runtime/request-scope"
import {
  conversationIdFromDurableSession,
  durableSessionId,
  isDurableSessionId,
} from "./durable-session"
import { resolveDurableAgentModel } from "./durable-model-resolve"
import { durableLoopSettingsFromProject } from "./durable-loop-settings"
import { readHostedSandboxStatus } from "./durable-sandbox"
import { userPiDurableName } from "./durable-binding"
import type { ChatMessage } from "@workspace/pi-protocol/chat-types"
import type {
  ChatMode,
  ChatModelSelection,
  ChatSessionInfo,
  ChatSessionResponse,
  ChatWorkspaceStatus,
} from "@workspace/pi-protocol/chat-protocol"
import { loadUserProjectSettings } from "@/lib/db/user-settings"

type DurableNamespace = {
  getByName: (name: string) => {
    fetch: (input: Request) => Promise<Response>
  }
}

export async function streamHostedAgentTurn(input: {
  userId: string
  prompt: string
  sessionId?: string
  model?: ChatModelSelection
  mode?: ChatMode
  whenBusy?: "steer" | "followUp"
  signal?: AbortSignal
}): Promise<Response> {
  const namespace = readDurableNamespace()
  if (!namespace) {
    return Response.json(
      { message: "Hosted agent runtime is unavailable." },
      { status: 503 }
    )
  }
  const model = await resolveDurableAgentModel(input.userId, input.model)
  if (!model) {
    return Response.json(
      { message: "Choose a model in Settings." },
      { status: 400 }
    )
  }
  const sandboxStatus = await readHostedSandboxStatus(input.userId)
  const project = await loadUserProjectSettings(input.userId)
  const loop = durableLoopSettingsFromProject(project)
  const extras = hostedSessionExtras(project)
  const workspace = hostedWorkspaceStatus(sandboxStatus)
  const create = !isDurableSessionId(input.sessionId)
  const conversationId =
    input.sessionId && isDurableSessionId(input.sessionId)
      ? conversationIdFromDurableSession(input.sessionId)
      : undefined
  const stub = namespace.getByName(userPiDurableName(input.userId))
  // BYOK model and sandbox credentials cross the Worker→DO trust zone in this JSON body.
  // Long-term, resolve credentials inside the DO from Neon instead of forwarding plaintext keys.
  return stub.fetch(
    new Request("https://user-pi-durable/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: input.signal,
      body: JSON.stringify({
        prompt: input.prompt,
        create,
        conversationId,
        model,
        workspace,
        ...(input.mode ? { mode: input.mode } : {}),
        ...(input.whenBusy ? { whenBusy: input.whenBusy } : {}),
        ...(Object.keys(loop).length > 0 ? { loop } : {}),
        ...(extras.extensions.length > 0
          ? { extensions: extras.extensions }
          : {}),
        ...(extras.codemode ? { codemode: true } : {}),
        ...(extras.mcpServers.length > 0
          ? { mcpServers: extras.mcpServers }
          : {}),
        ...(sandboxStatus.sandboxReady &&
        sandboxStatus.apiKey &&
        sandboxStatus.sandboxId
          ? {
              sandbox: {
                apiKey: sandboxStatus.apiKey,
                sandboxId: sandboxStatus.sandboxId,
                apiUrl: sandboxStatus.apiUrl,
                target: sandboxStatus.target,
              },
            }
          : {}),
      }),
    })
  )
}

export async function deleteHostedDurableSession(
  userId: string,
  sessionId: string
): Promise<{ ok: true } | { ok: false; reason: "not-found" | "unavailable" }> {
  if (!isDurableSessionId(sessionId)) {
    return { ok: false, reason: "not-found" }
  }
  const namespace = readDurableNamespace()
  if (!namespace) {
    return { ok: false, reason: "unavailable" }
  }
  const conversationId = conversationIdFromDurableSession(sessionId)
  const stub = namespace.getByName(userPiDurableName(userId))
  const response = await stub.fetch(
    new Request(
      `https://user-pi-durable/session?id=${encodeURIComponent(conversationId)}`,
      { method: "DELETE" }
    )
  )
  if (response.status === 404) {
    return { ok: false, reason: "not-found" }
  }
  if (!response.ok) {
    return { ok: false, reason: "unavailable" }
  }
  return { ok: true }
}

function hostedSessionExtras(stored: Record<string, unknown> | null) {
  const extensions = Array.isArray(stored?.extensions)
    ? stored.extensions.filter(
        (item): item is string => typeof item === "string"
      )
    : []
  const codemodeRecord =
    stored?.codemode &&
    typeof stored.codemode === "object" &&
    !Array.isArray(stored.codemode)
      ? (stored.codemode as { enabled?: unknown })
      : undefined
  const mcpServers = Array.isArray(stored?.mcpServers)
    ? stored.mcpServers.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return []
        const record = item as {
          name?: unknown
          url?: unknown
          headers?: unknown
        }
        if (typeof record.name !== "string" || typeof record.url !== "string") {
          return []
        }
        const headers =
          record.headers &&
          typeof record.headers === "object" &&
          !Array.isArray(record.headers)
            ? Object.fromEntries(
                Object.entries(record.headers).filter(
                  (entry): entry is [string, string] =>
                    typeof entry[1] === "string"
                )
              )
            : undefined
        return [
          {
            name: record.name,
            url: record.url,
            ...(headers ? { headers } : {}),
          },
        ]
      })
    : []
  return {
    extensions,
    codemode: codemodeRecord?.enabled === true,
    mcpServers,
  }
}

function hostedWorkspaceStatus(
  status: Awaited<ReturnType<typeof readHostedSandboxStatus>>
): ChatWorkspaceStatus {
  if (status.sandboxReady) {
    return { toolsAvailable: true }
  }
  if (!status.keyPresent) {
    return { toolsAvailable: false, reason: "daytona_credential_required" }
  }
  return { toolsAvailable: false, reason: "daytona_sandbox_not_ready" }
}

export async function listHostedDurableSessions(
  userId: string
): Promise<Array<ChatSessionInfo>> {
  const namespace = readDurableNamespace()
  if (!namespace) return []
  const stub = namespace.getByName(userPiDurableName(userId))
  const response = await stub.fetch(
    new Request("https://user-pi-durable/sessions")
  )
  if (!response.ok) return []
  const body = (await response.json()) as {
    sessions?: Array<{
      id: string
      firstMessage: string
      messageCount: number
    }>
  }
  const now = new Date().toISOString()
  return (body.sessions ?? []).map((session) => ({
    path: "",
    id: durableSessionId(session.id),
    cwd: getVolumeName(userId),
    created: now,
    modified: now,
    messageCount: session.messageCount,
    firstMessage: session.firstMessage,
  }))
}

export async function readHostedDurableSession(
  userId: string,
  sessionId: string
): Promise<ChatSessionResponse | undefined> {
  if (!isDurableSessionId(sessionId)) return undefined
  const namespace = readDurableNamespace()
  if (!namespace) return undefined
  const conversationId = conversationIdFromDurableSession(sessionId)
  const stub = namespace.getByName(userPiDurableName(userId))
  const response = await stub.fetch(
    new Request(
      `https://user-pi-durable/session?id=${encodeURIComponent(conversationId)}`
    )
  )
  if (response.status === 404) return undefined
  if (!response.ok) {
    throw new Error("Hosted session could not be read")
  }
  const body = (await response.json()) as { messages?: Array<ChatMessage> }
  return {
    session: {
      sessionId,
    },
    messages: body.messages ?? [],
  }
}

export async function forkHostedConversation(
  userId: string,
  sessionId: string
): Promise<Response> {
  if (!isDurableSessionId(sessionId)) {
    return Response.json(
      { message: "Only a hosted conversation can be forked." },
      { status: 400 }
    )
  }
  const namespace = readDurableNamespace()
  if (!namespace) {
    return Response.json(
      { message: "Hosted agent runtime is unavailable." },
      { status: 503 }
    )
  }
  const stub = namespace.getByName(userPiDurableName(userId))
  return stub.fetch(
    new Request("https://user-pi-durable/fork", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: conversationIdFromDurableSession(sessionId),
      }),
    })
  )
}

export async function abortHostedAgentTurn(userId: string): Promise<Response> {
  const namespace = readDurableNamespace()
  if (!namespace) {
    return Response.json(
      { message: "Hosted agent runtime is unavailable." },
      { status: 503 }
    )
  }
  const stub = namespace.getByName(userPiDurableName(userId))
  return stub.fetch(
    new Request("https://user-pi-durable/agent/abort", { method: "POST" })
  )
}

/**
 * Erase the user's hosted transcripts. Returns `false` when no Durable Object
 * binding exists (local runtimes keep transcripts in JSONL instead).
 */
export async function eraseHostedDurableData(userId: string): Promise<boolean> {
  const namespace = readDurableNamespace()
  if (!namespace) return false
  const stub = namespace.getByName(userPiDurableName(userId))
  const response = await stub.fetch(
    new Request("https://user-pi-durable/data", { method: "DELETE" })
  )
  if (!response.ok) {
    throw new Error("Hosted transcripts could not be erased")
  }
  return true
}

export function mergeDurableSessions(
  existing: Array<ChatSessionInfo>,
  durable: Array<ChatSessionInfo>
): Array<ChatSessionInfo> {
  const byId = new Map(existing.map((session) => [session.id, session]))
  for (const session of durable) {
    if (!byId.has(session.id)) byId.set(session.id, session)
  }
  return [...byId.values()]
}

function readDurableNamespace(): DurableNamespace | undefined {
  const env = readBoundWorkerEnv()
  if (!env || !("USER_PI_DURABLE" in env)) return undefined
  const binding = env.USER_PI_DURABLE
  if (!binding || typeof binding !== "object" || !("getByName" in binding)) {
    return undefined
  }
  return binding as DurableNamespace
}
