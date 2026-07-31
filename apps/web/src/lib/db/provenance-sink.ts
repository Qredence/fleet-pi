import {
  appendPiRunEvent,
  finalizePiRun,
  insertPiRunStart,
  replacePiFileMutations,
  upsertPiToolExecution,
} from "./pi-session-mirror"
import {
  appendRunEvent,
  finalizeRun,
  insertRunStart,
  replaceRunMutations,
  upsertToolCall,
} from "./workspace-provenance"
import type { PostgresQueryClient } from "./pi-session-mirror"
import type {
  ProvenanceMutationKind,
  WorkspaceProvenanceConnection,
} from "./workspace-provenance"
import type {
  ChatMode,
  ChatPlanAction,
  ChatStreamEvent,
} from "@workspace/pi-protocol/chat-protocol"

/**
 * Shared input-type family for run provenance persistence. Both provenance
 * stores (SQLite projection and Postgres `pi_*` mirror) adapt internally from
 * these shapes; store-only fields (the Postgres queue's `cwd`/`userId`) are
 * owned by the sink constructor, not by these inputs.
 */
export type ProvenanceRunStartInput = {
  runId: string
  assistantMessageId: string
  sessionId: string
  sessionFile?: string
  mode?: ChatMode
  planAction?: ChatPlanAction
  startedAt: string
}

export type ProvenanceRunEventInput = {
  runId: string
  sequence: number
  eventType: ChatStreamEvent["type"]
  summary?: string | null
  payload: unknown
  recordedAt: string
}

export type ProvenanceToolExecutionInput = {
  /** Only the Postgres mirror stores session ids on tool executions. */
  sessionId: string
  runId: string
  toolCallId: string
  toolName: string
  state: string
  isError: boolean
  input: unknown
  output: unknown
  claimedPaths: Array<string>
  firstSequence: number
  lastSequence: number
}

export type ProvenanceFileMutation = {
  canonicalPath: string
  kind: ProvenanceMutationKind
  toolCallId?: string
  eventSequence?: number
  beforeDigest?: string
  afterDigest?: string
  beforeSize?: number
  afterSize?: number
  summary?: string
}

export type ProvenanceFileMutationsInput = {
  runId: string
  recordedAt: string
  mutations: Array<ProvenanceFileMutation>
}

export type ProvenanceFinalizeRunInput = {
  runId: string
  status: "completed" | "errored" | "aborted"
  assistantPreview?: string | null
  errorMessage?: string | null
  completedAt: string
}

/**
 * One persistence path for run provenance. Write methods are synchronous from
 * the caller's perspective: the Postgres mirror sink enqueues async work under
 * its operation queue's existing non-fatal error swallowing.
 */
export interface ProvenanceSink {
  insertRunStart: (input: ProvenanceRunStartInput) => void
  appendRunEvent: (input: ProvenanceRunEventInput) => void
  upsertToolExecution: (input: ProvenanceToolExecutionInput) => void
  replaceFileMutations: (input: ProvenanceFileMutationsInput) => void
  finalizeRun: (input: ProvenanceFinalizeRunInput) => void
  close: () => void | Promise<void>
}

/**
 * Structural shape of the queue produced by
 * `createChatPostgresOperationQueue`; mirrored here so the sink depends on the
 * contract, not the factory.
 */
export type ChatPostgresOperationQueue = {
  enabled: boolean
  enqueue: (
    operation: (client: PostgresQueryClient) => Promise<void>,
    userId?: string
  ) => Promise<void> | undefined
  close: () => Promise<void>
}

/** Local durability sink: writes into the workspace SQLite projection. */
export class SqliteProvenanceSink implements ProvenanceSink {
  constructor(private readonly connection: WorkspaceProvenanceConnection) {}

  insertRunStart(input: ProvenanceRunStartInput) {
    insertRunStart(this.connection.db, input)
  }

  appendRunEvent(input: ProvenanceRunEventInput) {
    appendRunEvent(this.connection.db, input)
  }

  upsertToolExecution(input: ProvenanceToolExecutionInput) {
    upsertToolCall(this.connection.db, input)
  }

  replaceFileMutations(input: ProvenanceFileMutationsInput) {
    replaceRunMutations(this.connection.db, input)
  }

  finalizeRun(input: ProvenanceFinalizeRunInput) {
    finalizeRun(this.connection.db, input)
  }

  close() {
    this.connection.close()
  }
}

/**
 * Remote mirror sink: enqueues mirroring operations onto the chat Postgres
 * operation queue. Failures stay non-fatal per the queue's own swallow-and-log
 * semantics; ownership guards (`assertMirrorOwnerForPersistence`) remain
 * inside the mirror functions it calls.
 */
export class PostgresMirrorSink implements ProvenanceSink {
  constructor(
    private readonly queue: ChatPostgresOperationQueue,
    private readonly options: { cwd: string; userId?: string }
  ) {}

  insertRunStart(input: ProvenanceRunStartInput) {
    const runStart = { ...input }
    this.queue.enqueue(
      (client) =>
        insertPiRunStart(client, {
          ...runStart,
          cwd: this.options.cwd,
          userId: this.options.userId,
        }),
      this.options.userId
    )
  }

  appendRunEvent(input: ProvenanceRunEventInput) {
    this.queue.enqueue(
      (client) => appendPiRunEvent(client, input),
      this.options.userId
    )
  }

  upsertToolExecution(input: ProvenanceToolExecutionInput) {
    this.queue.enqueue(
      (client) => upsertPiToolExecution(client, input),
      this.options.userId
    )
  }

  replaceFileMutations(input: ProvenanceFileMutationsInput) {
    this.queue.enqueue(
      (client) => replacePiFileMutations(client, input),
      this.options.userId
    )
  }

  finalizeRun(input: ProvenanceFinalizeRunInput) {
    this.queue.enqueue(
      (client) => finalizePiRun(client, input),
      this.options.userId
    )
  }

  close() {
    return this.queue.close()
  }
}

/**
 * Ordered fan-out over multiple provenance sinks. An error from one sink
 * propagates to the caller without invoking the remaining sinks, preserving
 * today's semantics of the interleaved SQLite/Postgres call pairs (SQLite
 * first, Postgres last, mirror failures already non-fatal by construction).
 */
export class CompositeProvenanceSink implements ProvenanceSink {
  constructor(private readonly sinks: ReadonlyArray<ProvenanceSink>) {}

  insertRunStart(input: ProvenanceRunStartInput) {
    for (const sink of this.sinks) {
      sink.insertRunStart(input)
    }
  }

  appendRunEvent(input: ProvenanceRunEventInput) {
    for (const sink of this.sinks) {
      sink.appendRunEvent(input)
    }
  }

  upsertToolExecution(input: ProvenanceToolExecutionInput) {
    for (const sink of this.sinks) {
      sink.upsertToolExecution(input)
    }
  }

  replaceFileMutations(input: ProvenanceFileMutationsInput) {
    for (const sink of this.sinks) {
      sink.replaceFileMutations(input)
    }
  }

  finalizeRun(input: ProvenanceFinalizeRunInput) {
    for (const sink of this.sinks) {
      sink.finalizeRun(input)
    }
  }

  async close() {
    for (const sink of this.sinks) {
      await sink.close()
    }
  }
}
