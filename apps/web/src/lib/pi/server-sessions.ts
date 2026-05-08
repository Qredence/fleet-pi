import { existsSync } from "node:fs"
import { isAbsolute, relative, resolve } from "node:path"
import { SessionManager } from "@mariozechner/pi-coding-agent"
import { sessionEntriesToChatMessages } from "./server-utils"
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

  if (!sessionFile) {
    const sessionManager = SessionManager.create(
      context.projectRoot,
      sessionDir
    )
    return {
      session: toSessionMetadata(sessionManager),
      messages: [],
      sessionReset: Boolean(metadata.sessionFile || metadata.sessionId),
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
    messages: sessionEntriesToChatMessages(sessionManager.getBranch()),
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
  const createFreshSession = (sessionReset: boolean) => ({
    sessionManager: SessionManager.create(repoRoot, sessionDir),
    sessionReset,
  })

  if (!sessionFile) {
    return createFreshSession(
      Boolean(metadata.sessionFile || metadata.sessionId)
    )
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
  if (fromFile && isUsableSessionFile(fromFile, sessionDir)) {
    return resolve(fromFile)
  }

  if (!metadata.sessionId) return undefined

  const sessions = await SessionManager.list(repoRoot, sessionDir)
  const match = sessions.find((session) => session.id === metadata.sessionId)
  if (!match || !isUsableSessionFile(match.path, sessionDir)) {
    return undefined
  }

  return match.path
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
