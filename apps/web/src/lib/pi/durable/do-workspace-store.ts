import {
  TEMPLATE_UPDATES_RELATIVE_PATH,
  TEMPLATE_VERSION_RELATIVE_PATH,
} from "../../workspace/workspace-contract"

import type {
  HostedCommandResult,
  HostedSandboxPort,
} from "./hosted-sandbox-env"

/**
 * Small agent-workspace kept in the user's Durable Object SQLite for users
 * without a Daytona key. Text files only, no shell. When a sandbox becomes
 * available, `syncToVolume` copies what the agent wrote onto the volume.
 */

/** Minimal `ctx.storage.sql` surface, so node tests can back it with node:sqlite. */
export type WorkspaceSql = {
  exec: (
    query: string,
    ...bindings: Array<ArrayBuffer | string | number | null>
  ) => {
    toArray: () => Array<Record<string, ArrayBuffer | string | number | null>>
  }
}

/**
 * Paths the agent may write, mirroring `templates/agent-workspace`'s mutation
 * tiers; the tiers still gate which of them need a rationale or confirmation.
 * Reads also cover seeded `.fleet/` state.
 */
export const DO_WORKSPACE_WRITABLE_FILES = ["AGENTS.md", "README.md"] as const
export const DO_WORKSPACE_WRITABLE_DIRECTORIES = [
  "artifacts/",
  "evals/",
  "instructions/",
  "memory/",
  "pi/prompts/",
  "pi/skills/",
  "plans/",
  "scratch/",
  "system/",
] as const

/** Store bookkeeping the Workspace panel must not rewrite. */
const DO_WORKSPACE_INTERNAL_PREFIXES = [".fleet/", "indexes/"] as const

const TEXT_EXTENSIONS = /\.(md|txt|json|ya?ml)$/i

export const DO_WORKSPACE_LIMITS = {
  fileBytes: 64 * 1024,
  totalBytes: 2 * 1024 * 1024,
  files: 500,
  directories: 500,
  pathBytes: 1024,
} as const

export const DO_WORKSPACE_EXEC_UNAVAILABLE =
  "Shell commands need a Daytona sandbox. Add a Daytona key in Settings to run them; file tools work in the built-in workspace."

const VOLUME_ROOT = "/home/daytona/agent-workspace"
const SUPERSEDED_META = "volume-canonical"
const SUPERSEDED_MESSAGE =
  "This workspace now lives in your Daytona sandbox. Add or refresh a Daytona key in Settings to edit it from chat."
const TEMPLATE_UPDATES_PREFIX = TEMPLATE_UPDATES_RELATIVE_PATH
const DO_IMPORT_PREFIX = ".fleet/do-import"

type Origin = "template" | "user" | "fleet"

export class DoWorkspaceError extends Error {
  readonly code: "ENOENT" | "EEXIST" | "EACCES" | "EFBIG" | "EINVAL"
  constructor(code: DoWorkspaceError["code"], message: string) {
    super(message)
    this.name = "DoWorkspaceError"
    this.code = code
  }
}

/**
 * Normalizes tool, volume, or `agent-workspace/` paths to a relative store
 * path. Throws on traversal or a path outside the workspace.
 */
export function normalizeStorePath(path: string): string {
  let value = path.replace(/\\/g, "/").trim()
  if (value === VOLUME_ROOT) return ""
  if (value.startsWith(`${VOLUME_ROOT}/`)) {
    value = value.slice(VOLUME_ROOT.length + 1)
  } else if (value.startsWith("/")) {
    throw new DoWorkspaceError(
      "EACCES",
      `Path is outside the workspace: ${path}`
    )
  }
  const segments = value.split("/").filter((part) => part && part !== ".")
  if (segments[0] === "agent-workspace") segments.shift()
  if (segments.some((part) => part === "..")) {
    throw new DoWorkspaceError(
      "EACCES",
      `Path is outside the workspace: ${path}`
    )
  }
  return segments.join("/")
}

export function isAgentWritablePath(path: string): boolean {
  if (!TEXT_EXTENSIONS.test(path)) return false
  if ((DO_WORKSPACE_WRITABLE_FILES as ReadonlyArray<string>).includes(path)) {
    return true
  }
  return DO_WORKSPACE_WRITABLE_DIRECTORIES.some((dir) => path.startsWith(dir))
}

/**
 * Text files the Workspace panel may write. Wider than the agent's allowlist
 * (the user owns the workspace) but never the store's own bookkeeping.
 */
export function isPanelWritablePath(path: string): boolean {
  if (!TEXT_EXTENSIONS.test(path)) return false
  return !DO_WORKSPACE_INTERNAL_PREFIXES.some((prefix) =>
    path.startsWith(prefix)
  )
}

export type DoWorkspaceEntry = {
  path: string
  content: string
  origin: Origin
  synced: boolean
  /** Content last copied to a volume, to tell our copy from a volume edit. */
  syncedContent: string | undefined
  updatedAt: number
}

export type DoWorkspaceSyncResult = {
  copied: Array<string>
  conflicts: Array<string>
  failed: Array<string>
}

export type DoWorkspaceStore = HostedSandboxPort & {
  list: NonNullable<HostedSandboxPort["list"]>
  /** Seeds missing files from the template; never overwrites. */
  seed: (template: TemplateBundle) => { version: number | undefined }
  templateVersion: () => number | undefined
  /** Workspace panel and bootstrap write; bookkeeping paths are refused. */
  writeSystem: (
    path: string,
    content: string,
    options?: { exclusive?: boolean }
  ) => void
  mkdir: (path: string) => void
  stat: (path: string) => { kind: "file"; size: number } | { kind: "dir" }
  entries: () => Array<DoWorkspaceEntry>
  /** True once a volume took over; the store stays readable but not writable. */
  isSuperseded: () => boolean
  /** Copies agent-written files onto a sandbox volume without overwriting. */
  syncToVolume: (volume: HostedSandboxPort) => Promise<DoWorkspaceSyncResult>
}

export type TemplateBundle = {
  version: number
  /** Relative path → content. */
  files: Record<string, string>
  /** Empty directories the template keeps with `.gitkeep`. */
  directories: Array<string>
}

export function createDoWorkspaceStore(sql: WorkspaceSql): DoWorkspaceStore {
  ensureSchema(sql)

  const getRow = (path: string) =>
    sql
      .exec(
        "SELECT content, origin, synced, updated_at FROM fleet_workspace_files WHERE path = ?",
        path
      )
      .toArray()
      .at(0)

  const getMeta = (key: string) => {
    const row = sql
      .exec("SELECT value FROM fleet_workspace_meta WHERE key = ?", key)
      .toArray()
      .at(0)
    return typeof row?.value === "string" ? row.value : undefined
  }

  const setMeta = (key: string, value: string) => {
    sql.exec(
      "INSERT INTO fleet_workspace_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      key,
      value
    )
  }

  const isSuperseded = () => getMeta(SUPERSEDED_META) === "1"

  const totals = () => {
    const row = sql
      .exec(
        "SELECT COUNT(*) AS files, COALESCE(SUM(LENGTH(CAST(content AS BLOB))), 0) AS bytes FROM fleet_workspace_files"
      )
      .toArray()
      .at(0)
    return { files: Number(row?.files ?? 0), bytes: Number(row?.bytes ?? 0) }
  }

  const put = (path: string, content: string, origin: Origin) => {
    if (!path) throw new DoWorkspaceError("EINVAL", "A file path is required.")
    const bytes = utf8Length(content)
    if (bytes > DO_WORKSPACE_LIMITS.fileBytes) {
      throw new DoWorkspaceError(
        "EFBIG",
        `${path} is larger than ${DO_WORKSPACE_LIMITS.fileBytes} bytes, the built-in workspace limit.`
      )
    }
    const existing = getRow(path)
    const current = totals()
    const previousBytes =
      typeof existing?.content === "string" ? utf8Length(existing.content) : 0
    if (!existing && current.files >= DO_WORKSPACE_LIMITS.files) {
      throw new DoWorkspaceError(
        "EFBIG",
        `The built-in workspace holds at most ${DO_WORKSPACE_LIMITS.files} files.`
      )
    }
    if (
      current.bytes - previousBytes + bytes >
      DO_WORKSPACE_LIMITS.totalBytes
    ) {
      throw new DoWorkspaceError(
        "EFBIG",
        "The built-in workspace is full. Add a Daytona key for a full sandbox."
      )
    }
    sql.exec(
      `INSERT INTO fleet_workspace_files (path, content, origin, synced, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(path) DO UPDATE SET content = excluded.content, origin = excluded.origin,
         synced = excluded.synced, updated_at = excluded.updated_at`,
      path,
      content,
      origin,
      origin === "user" ? 0 : 1,
      Date.now()
    )
  }

  const childrenOf = (dir: string) => {
    const prefix = dir ? `${dir}/` : ""
    const children = new Map<string, boolean>()
    const add = (path: string, isFile: boolean) => {
      if (!path.startsWith(prefix)) return
      const rest = path.slice(prefix.length)
      if (!rest) return
      const [name, ...more] = rest.split("/")
      const isDirectory = more.length > 0 || !isFile
      children.set(name, children.get(name) === true || isDirectory)
    }
    for (const row of sql
      .exec("SELECT path FROM fleet_workspace_files")
      .toArray()) {
      add(sqlText(row.path), true)
    }
    for (const row of sql
      .exec("SELECT path FROM fleet_workspace_dirs")
      .toArray()) {
      add(sqlText(row.path), false)
    }
    return children
  }

  const countDirectories = () =>
    Number(
      sql
        .exec("SELECT COUNT(*) AS dirs FROM fleet_workspace_dirs")
        .toArray()
        .at(0)?.dirs ?? 0
    )

  const isDirectory = (path: string) => {
    if (!path) return true
    const marker = sql
      .exec("SELECT 1 AS hit FROM fleet_workspace_dirs WHERE path = ?", path)
      .toArray()
    if (marker.length > 0) return true
    const prefix = `${path}/`
    return (
      sql
        .exec(
          "SELECT 1 AS hit FROM fleet_workspace_files WHERE substr(path, 1, ?) = ? LIMIT 1",
          prefix.length,
          prefix
        )
        .toArray().length > 0
    )
  }

  const readFile = (path: string) => {
    const row = getRow(path)
    if (typeof row?.content !== "string") {
      throw new DoWorkspaceError("ENOENT", `No such file: ${path}`)
    }
    return row.content
  }

  const store: DoWorkspaceStore = {
    read(path) {
      try {
        return Promise.resolve(readFile(normalizeStorePath(path)))
      } catch (error) {
        return Promise.reject(error)
      }
    },
    write(path, content) {
      try {
        const normalized = normalizeStorePath(path)
        if (isSuperseded())
          throw new DoWorkspaceError("EACCES", SUPERSEDED_MESSAGE)
        if (!isAgentWritablePath(normalized)) {
          throw new DoWorkspaceError(
            "EACCES",
            `The built-in workspace only stores text files under ${[...DO_WORKSPACE_WRITABLE_FILES, ...DO_WORKSPACE_WRITABLE_DIRECTORIES].join(", ")}. Add a Daytona key in Settings for a full sandbox.`
          )
        }
        put(normalized, content, "user")
        return Promise.resolve()
      } catch (error) {
        return Promise.reject(error)
      }
    },
    list(dir) {
      try {
        const children = childrenOf(normalizeStorePath(dir))
        return Promise.resolve(
          [...children]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([name, directory]) => ({ name, isDirectory: directory }))
        )
      } catch (error) {
        return Promise.reject(error)
      }
    },
    exec(): Promise<HostedCommandResult> {
      return Promise.resolve({
        exitCode: 1,
        output: DO_WORKSPACE_EXEC_UNAVAILABLE,
      })
    },
    seed(template) {
      const recorded = store.templateVersion()
      if (recorded !== undefined && recorded >= template.version) {
        return { version: recorded }
      }
      for (const dir of template.directories) store.mkdir(dir)
      for (const [rawPath, content] of Object.entries(template.files)) {
        const path = normalizeStorePath(rawPath)
        if (!path || path === "template.json") continue
        const existing = getRow(path)
        const pristine = sql
          .exec(
            "SELECT content FROM fleet_workspace_template WHERE path = ?",
            path
          )
          .toArray()
          .at(0)
        if (!existing) {
          put(path, content, "template")
        } else if (
          existing.content !== content &&
          pristine?.content !== content
        ) {
          // The template changed and the user's copy differs: stage it for review.
          put(
            `${TEMPLATE_UPDATES_PREFIX}/${template.version}/${path}`,
            content,
            "fleet"
          )
        }
        sql.exec(
          "INSERT INTO fleet_workspace_template (path, content) VALUES (?, ?) ON CONFLICT(path) DO UPDATE SET content = excluded.content",
          path,
          content
        )
      }
      setMeta("template-version", String(template.version))
      // Same bookkeeping file a volume has, so workspace health reads both alike.
      put(TEMPLATE_VERSION_RELATIVE_PATH, `${template.version}\n`, "fleet")
      return { version: template.version }
    },
    templateVersion() {
      const value = getMeta("template-version")
      if (value === undefined) return undefined
      const version = Number(value)
      return Number.isInteger(version) ? version : undefined
    },
    writeSystem(path, content, options) {
      const normalized = normalizeStorePath(path)
      if (!isPanelWritablePath(normalized)) {
        throw new DoWorkspaceError(
          "EACCES",
          `The workspace panel cannot write ${normalized}; it belongs to the workspace's own bookkeeping.`
        )
      }
      const existing = getRow(normalized)
      if (options?.exclusive && existing) {
        throw new DoWorkspaceError("EEXIST", `File exists: ${normalized}`)
      }
      if (existing && isSuperseded()) {
        throw new DoWorkspaceError("EACCES", SUPERSEDED_MESSAGE)
      }
      // Agent areas carry user content into a later volume; the rest does not.
      put(
        normalized,
        content,
        isAgentWritablePath(normalized) ? "user" : "fleet"
      )
    },
    mkdir(path) {
      const normalized = normalizeStorePath(path)
      if (!normalized) return
      if (utf8Length(normalized) > DO_WORKSPACE_LIMITS.pathBytes) {
        throw new DoWorkspaceError(
          "EINVAL",
          `Paths in the built-in workspace are limited to ${DO_WORKSPACE_LIMITS.pathBytes} bytes.`
        )
      }
      if (
        !isDirectory(normalized) &&
        countDirectories() >= DO_WORKSPACE_LIMITS.directories
      ) {
        throw new DoWorkspaceError(
          "EFBIG",
          `The built-in workspace holds at most ${DO_WORKSPACE_LIMITS.directories} directories.`
        )
      }
      sql.exec(
        "INSERT INTO fleet_workspace_dirs (path) VALUES (?) ON CONFLICT(path) DO NOTHING",
        normalized
      )
    },
    stat(path) {
      const normalized = normalizeStorePath(path)
      const row = getRow(normalized)
      if (typeof row?.content === "string") {
        return { kind: "file", size: utf8Length(row.content) }
      }
      if (isDirectory(normalized)) return { kind: "dir" }
      throw new DoWorkspaceError("ENOENT", `No such file: ${normalized}`)
    },
    isSuperseded,
    entries() {
      return sql
        .exec(
          "SELECT path, content, origin, synced, synced_content, updated_at FROM fleet_workspace_files ORDER BY path"
        )
        .toArray()
        .map((row) => ({
          path: sqlText(row.path),
          content: sqlText(row.content),
          origin: parseOrigin(row.origin),
          synced: Number(row.synced) === 1,
          syncedContent:
            typeof row.synced_content === "string"
              ? row.synced_content
              : undefined,
          updatedAt: Number(row.updated_at),
        }))
    },
    async syncToVolume(volume) {
      const result: DoWorkspaceSyncResult = {
        copied: [],
        conflicts: [],
        failed: [],
      }
      const pending = store
        .entries()
        .filter((entry) => entry.origin === "user" && !entry.synced)
      for (const entry of pending) {
        try {
          const existing = await readVolumeFile(volume, entry.path)
          if (existing === undefined || existing === entry.syncedContent) {
            await volume.write(entry.path, entry.content)
            result.copied.push(entry.path)
          } else if (existing !== entry.content) {
            const target = `${DO_IMPORT_PREFIX}/${entry.path}`
            await volume.write(target, entry.content)
            result.conflicts.push(target)
          }
          sql.exec(
            "UPDATE fleet_workspace_files SET synced = 1, synced_content = ? WHERE path = ? AND updated_at = ?",
            entry.content,
            entry.path,
            entry.updatedAt
          )
        } catch {
          result.failed.push(entry.path)
        }
      }
      if (result.copied.length > 0 || result.conflicts.length > 0) {
        // The volume is canonical from here: the store stops accepting writes.
        setMeta(SUPERSEDED_META, "1")
      }
      return result
    },
  }
  return store
}

/**
 * File text at `path`, `""` for an existing empty file, or undefined when the
 * volume has no file there. Ports read missing files as either an error or an
 * empty string, and a read can also fail transiently, so an error or an empty
 * read is only treated as "missing" when a listing confirms it. Anything else
 * throws, which keeps the entry pending instead of overwriting a file.
 */
async function readVolumeFile(volume: HostedSandboxPort, path: string) {
  let readError: unknown
  try {
    const text = await volume.read(path)
    if (text !== "") return text
  } catch (error) {
    readError = error ?? new Error(`Could not read ${path}`)
  }
  if (!(await volumeHasEntry(volume, path))) return undefined
  if (readError !== undefined) throw readError
  return ""
}

/**
 * Whether `path` exists on the volume. Throws when that cannot be confirmed
 * (no listing support, or a listing failure inside an existing directory).
 */
async function volumeHasEntry(
  volume: HostedSandboxPort,
  path: string
): Promise<boolean> {
  if (!path) return true
  if (!volume.list) {
    throw new Error(`Cannot confirm whether ${path} exists on the volume`)
  }
  const slash = path.lastIndexOf("/")
  const dir = slash === -1 ? "" : path.slice(0, slash)
  const name = slash === -1 ? path : path.slice(slash + 1)
  let entries: Array<{ name: string }>
  try {
    entries = await volume.list(dir)
  } catch (error) {
    // A missing parent proves the file is absent; otherwise we cannot tell.
    if (await volumeHasEntry(volume, dir)) throw error
    return false
  }
  return entries.some((entry) => entry.name === name)
}

function ensureSchema(sql: WorkspaceSql) {
  sql.exec(`CREATE TABLE IF NOT EXISTS fleet_workspace_files (
    path TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    origin TEXT NOT NULL,
    synced INTEGER NOT NULL DEFAULT 1,
    synced_content TEXT,
    updated_at INTEGER NOT NULL
  )`)
  sql.exec(
    "CREATE TABLE IF NOT EXISTS fleet_workspace_dirs (path TEXT PRIMARY KEY)"
  )
  sql.exec(
    "CREATE TABLE IF NOT EXISTS fleet_workspace_template (path TEXT PRIMARY KEY, content TEXT NOT NULL)"
  )
  sql.exec(
    "CREATE TABLE IF NOT EXISTS fleet_workspace_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
  )
}

function sqlText(value: ArrayBuffer | string | number | null | undefined) {
  return typeof value === "string" ? value : ""
}

function parseOrigin(value: unknown): Origin {
  return value === "template" || value === "user" ? value : "fleet"
}

function utf8Length(value: string) {
  return new TextEncoder().encode(value).length
}

/** Body of the Durable Object's `POST /workspace/fs`. */
export type WorkspaceFsRequest = {
  op: "stat" | "readdir" | "read" | "mkdir" | "write"
  path: string
  content?: string
  exclusive?: boolean
}

/**
 * Serves Workspace panel file operations from the store. Errors return
 * Node-style codes that `durable-workspace-fs.ts` turns back into errors.
 */
export async function handleWorkspaceFsRequest(
  store: DoWorkspaceStore,
  body: Partial<WorkspaceFsRequest>
): Promise<Response> {
  if (typeof body.path !== "string") {
    return Response.json({ code: "EINVAL" }, { status: 400 })
  }
  try {
    switch (body.op) {
      case "stat":
        return Response.json(store.stat(body.path))
      case "readdir":
        return Response.json(await store.list(body.path))
      case "read":
        return Response.json({ content: await store.read(body.path) })
      case "mkdir":
        store.mkdir(body.path)
        return Response.json({ ok: true })
      case "write":
        store.writeSystem(body.path, body.content ?? "", {
          exclusive: body.exclusive === true,
        })
        return Response.json({ ok: true })
      default:
        return Response.json({ code: "EINVAL" }, { status: 400 })
    }
  } catch (error) {
    const code = error instanceof DoWorkspaceError ? error.code : "EIO"
    const message = error instanceof Error ? error.message : String(error)
    return Response.json(
      { code, message },
      { status: code === "ENOENT" ? 404 : 400 }
    )
  }
}
