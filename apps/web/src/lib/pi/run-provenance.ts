import { createHash } from "node:crypto"
import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readSync,
  readdirSync,
} from "node:fs"
import { join, relative } from "node:path"
import {
  appendRunEvent,
  finalizeRun,
  insertRunStart,
  normalizeCanonicalPath,
  normalizeSessionFilePath,
  openWorkspaceProvenance,
  replaceRunMutations,
  upsertToolCall,
} from "../db/workspace-provenance"
import type { AppRuntimeContext } from "../app-runtime"
import type { ChatMode, ChatPlanAction, ChatStreamEvent } from "./chat-protocol"
import type {
  ProvenanceMutationKind,
  WorkspaceProvenanceConnection,
} from "../db/workspace-provenance"
import type {
  ChatMessage,
  ChatToolPart,
} from "@workspace/ui/components/agent-elements/chat-types"

type RecorderOptions = {
  mode?: ChatMode
  planAction?: ChatPlanAction
}

type SnapshotEntry = {
  digest: string
  size: number
}

type ActiveRunState = {
  runId: string
  sessionId: string
  sessionFile?: string
  sequence: number
  toolCalls: Array<TrackedToolCall>
  beforeSnapshot?: Map<string, SnapshotEntry>
}

type TrackedToolCall = {
  toolCallId: string
  toolName: string
  state: string
  claimedPaths: Array<string>
  firstSequence: number
  lastSequence: number
  isError: boolean
  isPotentialMutation: boolean
}

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".turbo",
  ".tanstack",
  ".vinxi",
  ".vite",
  ".factory",
  ".fleet",
  "node_modules",
  "dist",
  "build",
  "coverage",
])

const IGNORED_PATH_PREFIXES = [
  "agent-workspace/indexes/",
  "apps/web/.tanstack/",
  "apps/web/.vinxi/",
]

const POTENTIALLY_MUTATING_TOOLS = new Set([
  "bash",
  "edit",
  "resource_install",
  "write",
  "workspace_edit",
  "workspace_write",
])

export type RunProvenanceRecorder = {
  record: (event: ChatStreamEvent) => void
  close: () => void
}

export function createRunProvenanceRecorder(
  context: AppRuntimeContext,
  options: RecorderOptions = {}
): RunProvenanceRecorder {
  let connection: WorkspaceProvenanceConnection | undefined
  let activeRun: ActiveRunState | undefined

  try {
    connection = openWorkspaceProvenance(context)
  } catch {
    return {
      record: () => undefined,
      close: () => undefined,
    }
  }

  const record = (event: ChatStreamEvent) => {
    const activeConnection = connection
    if (!activeConnection) return

    try {
      if (event.type === "start") {
        if (activeRun) {
          finalizeActiveRun(
            "aborted",
            undefined,
            "Run interrupted by a new turn."
          )
        }

        activeRun = {
          runId: event.runId,
          sessionId: event.sessionId,
          sessionFile: normalizeSessionFilePath(context, event.sessionFile),
          sequence: 0,
          toolCalls: [],
        }
        insertRunStart(activeConnection.db, {
          runId: activeRun.runId,
          assistantMessageId: activeRun.runId,
          sessionId: activeRun.sessionId,
          sessionFile: activeRun.sessionFile,
          mode: options.mode,
          planAction: options.planAction,
          startedAt: timestamp(),
        })
      }

      if (!activeRun) {
        return
      }

      activeRun.sequence += 1
      appendRunEvent(activeConnection.db, {
        runId: activeRun.runId,
        sequence: activeRun.sequence,
        eventType: event.type,
        summary: summarizeStreamEvent(event),
        payload: event,
        recordedAt: timestamp(),
      })

      if (event.type === "tool") {
        recordToolEvent(event.part)
      }

      if (event.type === "done") {
        finalizeActiveRun("completed", event.message)
      }

      if (event.type === "error") {
        finalizeActiveRun("errored", undefined, event.message)
      }
    } catch {
      // Provenance must stay non-fatal to chat streaming.
    }
  }

  const close = () => {
    try {
      if (activeRun) {
        finalizeActiveRun("aborted", undefined, "Run recorder closed early.")
      }
    } finally {
      connection?.close()
      connection = undefined
    }
  }

  return { record, close }

  function recordToolEvent(part: ChatToolPart) {
    const activeConnection = connection
    if (!activeConnection || !activeRun || !part.toolCallId) return

    const toolName = part.type.startsWith("tool-")
      ? part.type.slice("tool-".length)
      : part.type
    const lowerToolName = toolName.toLowerCase()
    const claimedPaths = extractClaimedPaths(context, part)
    const isPotentialMutation = isPotentiallyMutatingTool(lowerToolName)

    if (isPotentialMutation && !activeRun.beforeSnapshot) {
      activeRun.beforeSnapshot = captureProjectSnapshot(context.projectRoot)
    }

    const existing = activeRun.toolCalls.find(
      (toolCall) => toolCall.toolCallId === part.toolCallId
    )
    const nextToolCall: TrackedToolCall = existing
      ? {
          ...existing,
          claimedPaths: [
            ...new Set([...existing.claimedPaths, ...claimedPaths]),
          ],
          isError:
            existing.isError ||
            part.state === "output-error" ||
            hasOutputError(part.output),
          isPotentialMutation:
            existing.isPotentialMutation || isPotentialMutation,
          lastSequence: activeRun.sequence,
          state: part.state ?? existing.state,
          toolName,
        }
      : {
          toolCallId: part.toolCallId,
          toolName,
          state: part.state ?? "unknown",
          claimedPaths,
          firstSequence: activeRun.sequence,
          lastSequence: activeRun.sequence,
          isError: part.state === "output-error" || hasOutputError(part.output),
          isPotentialMutation,
        }

    if (existing) {
      const index = activeRun.toolCalls.indexOf(existing)
      activeRun.toolCalls[index] = nextToolCall
    } else {
      activeRun.toolCalls.push(nextToolCall)
    }

    upsertToolCall(activeConnection.db, {
      runId: activeRun.runId,
      toolCallId: nextToolCall.toolCallId,
      toolName: nextToolCall.toolName,
      state: nextToolCall.state,
      isError: nextToolCall.isError,
      input: asRecord(part.input),
      output: asRecordOrNull(part.output),
      claimedPaths: nextToolCall.claimedPaths,
      firstSequence: nextToolCall.firstSequence,
      lastSequence: nextToolCall.lastSequence,
    })
  }

  function finalizeActiveRun(
    status: "completed" | "errored" | "aborted",
    message?: ChatMessage,
    errorMessage?: string
  ) {
    const activeConnection = connection
    if (!activeConnection || !activeRun) return

    const runToFinalize = activeRun
    activeRun = undefined

    const mutations = runToFinalize.beforeSnapshot
      ? diffProjectSnapshots(
          runToFinalize.beforeSnapshot,
          captureProjectSnapshot(context.projectRoot),
          runToFinalize.toolCalls
        )
      : []

    replaceRunMutations(activeConnection.db, {
      runId: runToFinalize.runId,
      recordedAt: timestamp(),
      mutations,
    })
    finalizeRun(activeConnection.db, {
      runId: runToFinalize.runId,
      status,
      assistantPreview: message ? summarizeAssistantMessage(message) : null,
      errorMessage: errorMessage ?? null,
      completedAt: timestamp(),
    })
  }
}

function summarizeStreamEvent(event: ChatStreamEvent) {
  switch (event.type) {
    case "start":
      return `Started run ${event.runId}`
    case "delta":
      return event.text.slice(0, 120)
    case "thinking":
      return event.text.slice(0, 120)
    case "tool":
      return `${event.part.type} (${event.part.state ?? "unknown"})`
    case "plan":
      return event.message ?? `${event.completed}/${event.total} plan steps`
    case "state":
      return event.state.name
    case "queue":
      return `Queued steering ${event.steering.length}, follow-up ${event.followUp.length}`
    case "compaction":
      return `${event.phase}:${event.reason}`
    case "retry":
      return `${event.phase}:${event.attempt}`
    case "done":
      return summarizeAssistantMessage(event.message)
    case "error":
      return event.message
    default:
      return null
  }
}

function summarizeAssistantMessage(message: ChatMessage) {
  const text = message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .filter(Boolean)
    .join(" ")
    .trim()

  if (text.length > 0) {
    return text.slice(0, 280)
  }

  const firstTool = message.parts.find((part) => part.type.startsWith("tool-"))
  return firstTool ? firstTool.type : "Assistant turn completed"
}

function extractClaimedPaths(
  context: AppRuntimeContext,
  part: ChatToolPart
): Array<string> {
  const claimedPaths = new Set<string>()
  const input = asRecord(part.input)
  const output = asRecordOrNull(part.output)

  addPathCandidate(
    claimedPaths,
    context,
    typeof input.file_path === "string" ? input.file_path : undefined
  )
  addPathCandidate(
    claimedPaths,
    context,
    typeof input.path === "string" ? input.path : undefined
  )

  const details = output ? asRecord(output.details) : {}
  addPathCandidate(
    claimedPaths,
    context,
    typeof details.installedPath === "string"
      ? details.installedPath
      : undefined
  )

  if (details.settingsUpdated === true) {
    claimedPaths.add(".pi/settings.json")
  }

  return [...claimedPaths].sort()
}

function addPathCandidate(
  claimedPaths: Set<string>,
  context: AppRuntimeContext,
  candidate: string | undefined
) {
  const normalized = normalizeCanonicalPath(context, candidate)
  if (normalized) {
    claimedPaths.add(normalized)
  }
}

function diffProjectSnapshots(
  before: Map<string, SnapshotEntry>,
  after: Map<string, SnapshotEntry>,
  toolCalls: Array<TrackedToolCall>
) {
  const allPaths = [...new Set([...before.keys(), ...after.keys()])].sort()

  return allPaths.flatMap((canonicalPath) => {
    const beforeEntry = before.get(canonicalPath)
    const afterEntry = after.get(canonicalPath)

    if (beforeEntry && afterEntry && beforeEntry.digest === afterEntry.digest) {
      return []
    }

    const kind: ProvenanceMutationKind =
      !beforeEntry && afterEntry
        ? "created"
        : beforeEntry && !afterEntry
          ? "deleted"
          : "updated"
    const toolCall = resolveToolCallAttribution(toolCalls, canonicalPath)

    return [
      {
        canonicalPath,
        kind,
        toolCallId: toolCall?.toolCallId,
        eventSequence: toolCall?.lastSequence,
        beforeDigest: beforeEntry?.digest,
        afterDigest: afterEntry?.digest,
        beforeSize: beforeEntry?.size,
        afterSize: afterEntry?.size,
        summary: summarizeMutation(
          kind,
          canonicalPath,
          beforeEntry,
          afterEntry
        ),
      },
    ]
  })
}

function resolveToolCallAttribution(
  toolCalls: Array<TrackedToolCall>,
  canonicalPath: string
) {
  const directMatch = [...toolCalls]
    .reverse()
    .find((toolCall) =>
      toolCall.claimedPaths.some(
        (claimedPath) =>
          canonicalPath === claimedPath ||
          canonicalPath.startsWith(`${claimedPath}/`)
      )
    )
  if (directMatch) return directMatch

  const mutatingToolCalls = toolCalls.filter(
    (toolCall) => toolCall.isPotentialMutation
  )
  if (mutatingToolCalls.length === 1) {
    return mutatingToolCalls[0]
  }

  return [...mutatingToolCalls]
    .reverse()
    .find((toolCall) => toolCall.toolName.toLowerCase() === "bash")
}

function summarizeMutation(
  kind: ProvenanceMutationKind,
  canonicalPath: string,
  beforeEntry?: SnapshotEntry,
  afterEntry?: SnapshotEntry
) {
  switch (kind) {
    case "created":
      return `Created ${canonicalPath} (${afterEntry?.size ?? 0} bytes)`
    case "deleted":
      return `Deleted ${canonicalPath} (${beforeEntry?.size ?? 0} bytes)`
    default:
      return `Updated ${canonicalPath} (${beforeEntry?.size ?? 0} → ${afterEntry?.size ?? 0} bytes)`
  }
}

function isPotentiallyMutatingTool(toolName: string) {
  return (
    POTENTIALLY_MUTATING_TOOLS.has(toolName) ||
    toolName.includes("write") ||
    toolName.includes("edit") ||
    toolName.includes("install")
  )
}

const MAX_FILE_SIZE_FOR_HASH = 4 * 1024 * 1024 // 4 MiB

function captureProjectSnapshot(projectRoot: string) {
  const snapshot = new Map<string, SnapshotEntry>()
  walkProjectFiles(projectRoot, projectRoot, snapshot)
  return snapshot
}

function walkProjectFiles(
  projectRoot: string,
  directory: string,
  snapshot: Map<string, SnapshotEntry>
) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort(
    (a, b) => a.name.localeCompare(b.name)
  )) {
    if (IGNORED_DIRECTORIES.has(entry.name)) {
      continue
    }

    const absolutePath = join(directory, entry.name)
    const repoRelativePath = relative(projectRoot, absolutePath).replace(
      /\\/g,
      "/"
    )

    if (
      repoRelativePath.length === 0 ||
      IGNORED_PATH_PREFIXES.some((prefix) =>
        repoRelativePath.startsWith(prefix)
      )
    ) {
      continue
    }

    if (entry.isSymbolicLink()) {
      continue
    }

    if (entry.isDirectory()) {
      walkProjectFiles(projectRoot, absolutePath, snapshot)
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    let fd: number | undefined
    try {
      fd = openSync(absolutePath, constants.O_RDONLY)
      const fileStat = fstatSync(fd)
      if (fileStat.size > MAX_FILE_SIZE_FOR_HASH) {
        continue
      }
      const content = Buffer.allocUnsafe(fileStat.size)
      readSync(fd, content, 0, fileStat.size, 0)
      snapshot.set(repoRelativePath, {
        digest: createHash("sha256").update(content).digest("hex"),
        size: fileStat.size,
      })
    } catch {
      // File may have been removed or changed between listing and reading; skip it
    } finally {
      if (fd !== undefined) closeSync(fd)
    }
  }
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asRecordOrNull(value: unknown) {
  const record = asRecord(value)
  return Object.keys(record).length > 0 ? record : null
}

function hasOutputError(value: unknown) {
  const record = asRecord(value)
  return record.isError === true
}

function timestamp() {
  return new Date().toISOString()
}
