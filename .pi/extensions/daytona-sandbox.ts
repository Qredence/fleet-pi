/**
 * Fleet Pi Daytona adapter — tools run in the user's BYOK sandbox with durable
 * volume at /home/daytona/agent-workspace. Stock npm:@daytona/pi is for CLI only
 * (excluded from the web resource loader).
 *
 * Activation: only attach when `getCachedUserSandbox` is warm (eager warm-up in
 * server-runtime / workspace APIs after isDaytonaEnabled + BYOK key). Never
 * provision a sandbox from this extension without that gate.
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
import { getSandboxStatus } from "../../apps/web/src/lib/daytona/client"
import {
  createSandboxOperations,
  type ToolOperations,
} from "../../apps/web/src/lib/daytona/sandbox-operations"
import { SANDBOX_WORKSPACE_ROOT } from "../../apps/web/src/lib/daytona/sandbox-prepare"
import { resolveDaytonaToolUser } from "../../apps/web/src/lib/daytona/tool-context"
import {
  getCachedUserSandbox,
  type UserSandboxHandle,
} from "../../apps/web/src/lib/daytona/user-sandbox"
import type { Sandbox } from "@daytona/sdk"

interface ActiveSandbox {
  sandbox: Sandbox
  cwd: string
  handle: UserSandboxHandle
  ops: ToolOperations
}

const SANDBOX_UNAVAILABLE_MESSAGE =
  "Daytona sandbox is unavailable — the tool was NOT run on your host."

export default function daytonaSandboxExtension(pi: ExtensionAPI) {
  let active: ActiveSandbox | null = null
  // Set when this session was tracked for Daytona (warm-up gated). Tools must
  // fail closed instead of falling back to the host when attach misses.
  let daytonaSessionExpected = false

  registerSandboxTools(
    pi,
    () => active,
    () => daytonaSessionExpected
  )

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
      return
    }

    daytonaSessionExpected = true

    // Only attach a sandbox already warmed by gated server-runtime / workspace
    // paths. Do not call getUserSandbox here — that would bypass BYOK checks.
    const handle = getCachedUserSandbox(userId)
    if (!handle) {
      active = null
      return
    }

    active = {
      sandbox: handle.sandbox,
      cwd: SANDBOX_WORKSPACE_ROOT,
      handle,
      ops: createSandboxOperations(handle.sandbox, SANDBOX_WORKSPACE_ROOT),
    }
    ctx.ui.setStatus(
      "daytona",
      `☁ daytona · ${shortId(handle.sandboxId)} · ${SANDBOX_WORKSPACE_ROOT}`
    )
  })

  pi.on("before_agent_start", (event) => {
    if (!active) return
    const cwdLine = `Current working directory: ${active.cwd} (Daytona sandbox ${shortId(active.sandbox.id)})`
    const systemPrompt = event.systemPrompt.replace(
      /Current working directory: .*/g,
      cwdLine
    )
    return { systemPrompt }
  })

  pi.on("session_shutdown", () => {
    active = null
    daytonaSessionExpected = false
  })
}

function registerSandboxTools(
  pi: ExtensionAPI,
  getActive: () => ActiveSandbox | null,
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
   * Like stock `@daytona/pi`: sandbox active → remote; Daytona expected but
   * missing → throw (never host); otherwise dormant → local Pi tools.
   */
  function requireSandbox(): ActiveSandbox | null {
    const current = getActive()
    if (current) return current
    if (isDaytonaSessionExpected()) {
      throw new Error(SANDBOX_UNAVAILABLE_MESSAGE)
    }
    return null
  }

  function sandboxTool<T extends { execute: (...args: never[]) => unknown }>(
    local: T,
    makeRemote: (cwd: string, ops: ToolOperations) => T
  ): T {
    return {
      ...local,
      execute: (...args: Parameters<T["execute"]>) => {
        const current = requireSandbox()
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

  pi.on("user_bash", () => {
    const current = getActive()
    if (current) return { operations: current.ops.bash }
    if (isDaytonaSessionExpected()) {
      return {
        result: {
          output: SANDBOX_UNAVAILABLE_MESSAGE,
          exitCode: 1,
          cancelled: false,
          truncated: false,
        },
      }
    }
    return
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
