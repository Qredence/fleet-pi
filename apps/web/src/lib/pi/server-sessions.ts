import { existsSync } from "node:fs"
import { isAbsolute, relative, resolve } from "node:path"
import { SessionManager } from "@earendil-works/pi-coding-agent"
import { createPlanToolPart, restorePlanState } from "./plan-state"
import {
  applyChatMessageIdMap,
  restoreChatMessageIdMap,
  sessionEntriesToChatMessages,
} from "./server-utils"
import {
  createSessionServices,
  getSessionDir,
  safeRealpath,
} from "./server-shared"
import type {
  ChatSessionInfo,
  ChatSessionMetadata,
  ChatSessionResponse,
} from "./chat-protocol"
import type { AppRuntimeContext } from "@/lib/app-runtime"

export type SessionManagerResult = {
  sessionManager: SessionManager
  sessionReset: boolean
}

export async function createNewChatSession(
  context: AppRuntimeContext
): Promise<ChatSessionResponse> {
  const services = await createSessionServices(context)
  const sessionManager = SessionManager.create(
    context.projectRoot,
    getSessionDir(context.projectRoot, services)
  )

  return {
    session: toSessionMetadata(sessionManager),
    messages: [],
  }
}

export async function hydrateChatSession(
  context: AppRuntimeContext,
  metadata: ChatSessionMetadata
): Promise<ChatSessionResponse> {
  const services = await createSessionServices(context)
  const sessionDir = getSessionDir(context.projectRoot, services)
  const sessionFile = await resolveSessionFile(
    metadata,
    context.projectRoot,
    sessionDir
  )
  const sessionReset = didRequestedSessionReset(metadata, sessionFile)

  if (!sessionFile) {
    const sessionManager = SessionManager.create(
      context.projectRoot,
      sessionDir
    )
    return {
      session: toSessionMetadata(sessionManager),
      messages: [],
      sessionReset,
    }
  }

  const sessionManager = openSessionManager(
    sessionFile,
    sessionDir,
    context.projectRoot
  )
  if (!sessionManager) {
    const fresh = SessionManager.create(context.projectRoot, sessionDir)
    return {
      session: toSessionMetadata(fresh),
      messages: [],
      sessionReset: true,
    }
  }

  return {
    session: toSessionMetadata(sessionManager),
    messages: attachPersistedPlanPart(
      hydrateSessionMessages(sessionManager),
      restorePersistedPlanState(sessionManager)
    ),
  }
}

export async function listChatSessions(
  context: AppRuntimeContext
): Promise<Array<ChatSessionInfo>> {
  const services = await createSessionServices(context)
  const sessions = await SessionManager.list(
    context.projectRoot,
    getSessionDir(context.projectRoot, services)
  )

  return sessions.map((session) => ({
    path: session.path,
    id: session.id,
    cwd: session.cwd,
    name: session.name,
    created: session.created.toISOString(),
    modified: session.modified.toISOString(),
    messageCount: session.messageCount,
    firstMessage: session.firstMessage,
  }))
}

export async function createSessionManager(
  metadata: ChatSessionMetadata,
  repoRoot: string,
  sessionDir: string
): Promise<SessionManagerResult> {
  const sessionFile = await resolveSessionFile(metadata, repoRoot, sessionDir)
  const sessionReset = didRequestedSessionReset(metadata, sessionFile)
  const createFreshSession = (nextSessionReset: boolean) => ({
    sessionManager: SessionManager.create(repoRoot, sessionDir),
    sessionReset: nextSessionReset,
  })

  if (!sessionFile) {
    return createFreshSession(sessionReset)
  }

  const opened = openSessionManager(sessionFile, sessionDir, repoRoot)
  if (!opened) return createFreshSession(true)

  return { sessionManager: opened, sessionReset: false }
}

export async function resolveSessionFile(
  metadata: ChatSessionMetadata,
  repoRoot: string,
  sessionDir: string
) {
  const fromFile = metadata.sessionFile
  if (fromFile) {
    return isUsableSessionFile(fromFile, sessionDir)
      ? resolve(fromFile)
      : undefined
  }

  if (!metadata.sessionId) return undefined

  const sessions = await SessionManager.list(repoRoot, sessionDir)
  const match = sessions.find((session) => session.id === metadata.sessionId)
  if (!match || !isUsableSessionFile(match.path, sessionDir)) {
    return undefined
  }

  return match.path
}

function didRequestedSessionReset(
  metadata: ChatSessionMetadata,
  sessionFile: string | undefined
) {
  if (metadata.sessionFile) {
    return !sessionFile
  }

  if (metadata.sessionId) {
    return !sessionFile
  }

  return false
}

export function isUsableSessionFile(sessionFile: string, sessionDir: string) {
  const resolvedSessionFile = resolve(sessionFile)
  if (!existsSync(resolvedSessionFile)) return false

  const realSessionDir = safeRealpath(sessionDir)
  const realSessionFile = safeRealpath(resolvedSessionFile)
  if (!realSessionDir || !realSessionFile) return false

  return isPathInside(realSessionDir, realSessionFile)
}

export function openSessionManager(
  sessionFile: string,
  sessionDir: string,
  repoRoot: string
) {
  try {
    return SessionManager.open(sessionFile, sessionDir, repoRoot)
  } catch {
    return undefined
  }
}

export function toSessionMetadata(
  sessionManager: SessionManager
): ChatSessionMetadata {
  return {
    sessionFile: sessionManager.getSessionFile(),
    sessionId: sessionManager.getSessionId(),
  }
}

function isPathInside(parent: string, child: string) {
  const path = relative(parent, child)
  return path === "" || (!path.startsWith("..") && !isAbsolute(path))
}

function hydrateSessionMessages(sessionManager: SessionManager) {
  const entries = sessionManager.getBranch()
  return applyChatMessageIdMap(
    sessionEntriesToChatMessages(entries),
    restoreChatMessageIdMap(entries)
  )
}

function restorePersistedPlanState(sessionManager: SessionManager) {
  const entry = sessionManager
    .getEntries()
    .filter((item) => {
      return (
        item.type === "custom" &&
        "customType" in item &&
        item.customType === "plan-mode"
      )
    })
    .pop() as { data?: unknown } | undefined

  return restorePlanState(entry?.data)
}

function attachPersistedPlanPart(
  messages: ChatSessionResponse["messages"],
  planState: ReturnType<typeof restorePlanState>
) {
  if (messages.length === 0 || planState.todos.length === 0) return messages

  const lastAssistantIndex = [...messages]
    .map((message, index) => ({ index, role: message.role, id: message.id }))
    .reverse()
    .find((message) => message.role === "assistant")?.index

  if (typeof lastAssistantIndex !== "number") return messages

  const target = messages[lastAssistantIndex]
  const planPart = createPlanToolPart(target.id, planState)
  if (!planPart) return messages

  const nextMessages = [...messages]
  nextMessages[lastAssistantIndex] = {
    ...target,
    parts: [
      ...target.parts.filter((part) => part.type !== "tool-PlanWrite"),
      planPart,
    ],
  }
  return nextMessages
}
