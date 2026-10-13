/**
 * Fleet Pi Daytona adapter — tools run in the user's BYOK sandbox with durable
 * volume at /home/daytona/agent-workspace. Stock npm:@daytona/pi is for CLI only
 * (excluded from the web resource loader).
 *
 * Activation: bash, read, write, and edit await the shared sandbox warm-up.
 * That helper attaches a cached sandbox, joins an in-flight start, or starts
 * one when the user has a Daytona key. It does not fall back to the host.
 */
import {
  createBashTool,
  createEditTool,
  createFindTool,
  createGrepTool,
  createLsTool,
  createReadTool,
  createWriteTool,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent"
import { Type } from "typebox"
import { applySandboxCwdToPrompt } from "./lib/sandbox-prompt-cwd"
import { getSandboxStatus } from "../../apps/web/src/lib/daytona/client"
import {
  createSandboxOperations,
  type Sandbox,
  type ToolOperations,
} from "../../apps/web/src/lib/daytona/sandbox-operations"
import {
  resolveReadySandbox,
  SANDBOX_WARMING_MESSAGE,
} from "../../apps/web/src/lib/daytona/resolve-ready-sandbox"
import { SANDBOX_WORKSPACE_ROOT } from "../../apps/web/src/lib/daytona/sandbox-prepare"
import { resolveDaytonaToolUser } from "../../apps/web/src/lib/daytona/tool-context"
import {
  getCachedUserSandbox,
  type UserSandboxHandle,
} from "../../apps/web/src/lib/daytona/user-sandbox"

interface ActiveSandbox {
  sandbox: Sandbox
  cwd: string
  handle: UserSandboxHandle
  ops: ToolOperations
}

type SandboxAttach =
  | { status: "active"; active: ActiveSandbox }
  | { status: "warming" }
  | { status: "missing" }

const SANDBOX_UNAVAILABLE_MESSAGE =
  "Daytona sandbox is unavailable — the tool was NOT run on your host."

export default function daytonaSandboxExtension(pi: ExtensionAPI) {
  let active: ActiveSandbox | null = null
  // Set when this session was tracked for Daytona (warm-up gated). Tools must
  // fail closed instead of falling back to the host when attach misses.
  let daytonaSessionExpected = false
  let expectedUserId: string | null = null

  function tryAttachFromCache(userId: string): ActiveSandbox | null {
    // Only attach a sandbox already warmed by gated server-runtime / workspace
    // paths. Do not call getUserSandbox here — that would bypass BYOK checks.
    const handle = getCachedUserSandbox(userId)
    if (!handle) return null

    active = {
      sandbox: handle.sandbox,
      cwd: SANDBOX_WORKSPACE_ROOT,
      handle,
      ops: createSandboxOperations(handle.sandbox, SANDBOX_WORKSPACE_ROOT),
    }
    return active
  }

  /** Attach a cached sandbox, or wait for the shared warm-up helper. */
  async function ensureActive(): Promise<SandboxAttach> {
    if (active) return { status: "active", active }
    if (!expectedUserId) return { status: "missing" }

    const ready = await resolveReadySandbox(expectedUserId)
    switch (ready.status) {
      case "ready":
        active = {
          sandbox: ready.handle.sandbox,
          cwd: SANDBOX_WORKSPACE_ROOT,
          handle: ready.handle,
          ops: createSandboxOperations(
            ready.handle.sandbox,
            SANDBOX_WORKSPACE_ROOT
          ),
        }
        return { status: "active", active }
      case "warming":
        return { status: "warming" }
      case "missing":
        return { status: "missing" }
      default: {
        const _exhaustive: never = ready
        return _exhaustive
      }
    }
  }

  registerSandboxTools(pi, ensureActive, () => daytonaSessionExpected)

  pi.registerTool({
    name: "daytona_get_status",
    label: "Daytona Get Status",
    description:
      "Get the status of the authenticated user's Fleet Pi Daytona sandbox.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const handle = requireCachedHandle(ctx)
      const status = await getSandboxStatus(handle.sandbox)

      return {
        content: [
          {
            type: "text",
            text: [
              `Sandbox status:`,
              `- ID: ${status.id}`,
              `- Name: ${status.name}`,
              `- State: ${status.state}`,
              `- Workspace: ${SANDBOX_WORKSPACE_ROOT}`,
            ].join("\n"),
          },
        ],
        details: { ...status, workspaceRoot: SANDBOX_WORKSPACE_ROOT },
      }
    },
  })

  pi.registerTool({
    name: "preview_url",
    label: "Preview URL",
    description:
      "Get the public preview URL for a port served inside the Daytona sandbox. " +
      "Use this after starting a server (e.g. a dev server on port 3000) to give the user a link.",
    promptSnippet:
      "Get a browser-openable preview URL for a port served in the sandbox",
    parameters: Type.Object({
      port: Type.Integer({
        minimum: 1,
        maximum: 65535,
        description: "The port the server listens on inside the sandbox",
      }),
    }),
    async execute(_id, { port }, _signal, _onUpdate, ctx) {
      const handle = requireCachedHandle(ctx)
      const link = await handle.sandbox.getPreviewLink(port)
      // Never put preview tokens in model-visible tool text (transcript / mirror).
      const text = handle.sandbox.public
        ? `Preview URL for port ${port}: ${link.url}`
        : `Preview URL for port ${port}: ${link.url}\n` +
          `This sandbox is private. Open it via authenticated GET /api/sandbox/preview?port=${port} — do not paste preview tokens into chat.`
      return { content: [{ type: "text", text }], details: undefined }
    },
  })

  pi.on("session_start", async (_event, ctx) => {
    const userId = resolveDaytonaToolUser(
      ctx.sessionManager.getSessionId(),
      ctx.sessionManager.getSessionFile()
    )
    if (!userId) {
      active = null
      daytonaSessionExpected = false
      expectedUserId = null
      return
    }

    daytonaSessionExpected = true
    expectedUserId = userId

    const attached = tryAttachFromCache(userId)
    if (!attached) {
      active = null
      return
    }

    ctx.ui.setStatus(
      "daytona",
      `☁ daytona · ${shortId(attached.handle.sandboxId)} · ${SANDBOX_WORKSPACE_ROOT}`
    )
  })

  pi.on("before_agent_start", async (event) => {
    const attached = await ensureActive()
    if (attached.status !== "active") return
    return applySandboxCwdToPrompt(
      event,
      attached.active.cwd,
      shortId(attached.active.sandbox.id)
    )
  })

  pi.on("session_shutdown", () => {
    active = null
    daytonaSessionExpected = false
    expectedUserId = null
  })
}

function registerSandboxTools(
  pi: ExtensionAPI,
  getActive: () => Promise<SandboxAttach>,
  isDaytonaSessionExpected: () => boolean
) {
  const localCwd = process.cwd()
  const localBash = createBashTool(localCwd)
  const localRead = createReadTool(localCwd)
  const localWrite = createWriteTool(localCwd)
  const localEdit = createEditTool(localCwd)
  const localLs = createLsTool(localCwd)
  const localFind = createFindTool(localCwd)
  const localGrep = createGrepTool(localCwd)

  /**
   * Sandbox active → remote. Daytona expected but still warming or missing →
   * throw (never the host). Otherwise dormant → local Pi tools.
   */
  async function requireSandbox(): Promise<ActiveSandbox | null> {
    const attached = await getActive()
    switch (attached.status) {
      case "active":
        return attached.active
      case "warming":
        if (isDaytonaSessionExpected()) {
          throw new Error(SANDBOX_WARMING_MESSAGE)
        }
        return null
      case "missing":
        if (isDaytonaSessionExpected()) {
          throw new Error(SANDBOX_UNAVAILABLE_MESSAGE)
        }
        return null
      default: {
        const _exhaustive: never = attached
        return _exhaustive
      }
    }
  }

  function sandboxTool<T extends { execute: (...args: never[]) => unknown }>(
    local: T,
    makeRemote: (cwd: string, ops: ToolOperations) => T
  ): T {
    return {
      ...local,
      execute: async (...args: Parameters<T["execute"]>) => {
        const current = await requireSandbox()
        const tool = current ? makeRemote(current.cwd, current.ops) : local
        return tool.execute(...args)
      },
    } as T
  }

  pi.registerTool(
    sandboxTool(localBash, (cwd, ops) =>
      createBashTool(cwd, { operations: ops.bash })
    )
  )
  pi.registerTool(
    sandboxTool(localRead, (cwd, ops) =>
      createReadTool(cwd, { operations: ops.read })
    )
  )
  pi.registerTool(
    sandboxTool(localWrite, (cwd, ops) =>
      createWriteTool(cwd, { operations: ops.write })
    )
  )
  pi.registerTool(
    sandboxTool(localEdit, (cwd, ops) =>
      createEditTool(cwd, { operations: ops.edit })
    )
  )
  pi.registerTool(
    sandboxTool(localLs, (cwd, ops) =>
      createLsTool(cwd, { operations: ops.ls })
    )
  )
  pi.registerTool(
    sandboxTool(localFind, (cwd, ops) =>
      createFindTool(cwd, { operations: ops.find })
    )
  )
  pi.registerTool(
    sandboxTool(localGrep, (cwd, ops) =>
      createGrepTool(cwd, { operations: ops.grep })
    )
  )

  pi.on("user_bash", async () => {
    const attached = await getActive()
    switch (attached.status) {
      case "active":
        return { operations: attached.active.ops.bash }
      case "warming":
      case "missing":
        if (!isDaytonaSessionExpected()) return
        return {
          result: {
            output:
              attached.status === "warming"
                ? SANDBOX_WARMING_MESSAGE
                : SANDBOX_UNAVAILABLE_MESSAGE,
            exitCode: 1,
            cancelled: false,
            truncated: false,
          },
        }
      default: {
        const _exhaustive: never = attached
        return _exhaustive
      }
    }
  })
}

function requireCachedHandle(ctx: ExtensionContext): UserSandboxHandle {
  const userId = resolveDaytonaToolUser(
    ctx.sessionManager.getSessionId(),
    ctx.sessionManager.getSessionFile()
  )
  if (!userId) {
    throw new Error("Daytona tools require an authenticated Fleet Pi session.")
  }
  const handle = getCachedUserSandbox(userId)
  if (!handle) {
    throw new Error(
      "No active Daytona sandbox. Save a Daytona API key in Settings (Providers) and retry."
    )
  }
  return handle
}

function shortId(id: string): string {
  return id.slice(0, 8)
}
