import { describe, expect, it, vi } from "vitest"

import daytonaSandboxExtension from "../../../../../../.pi/extensions/daytona-sandbox"
import { resolveHarnessWriteTarget } from "../../daytona/harness-write-target"

interface RegisteredTool {
  name: string
  execute: (
    toolCallId: string,
    params: Record<string, unknown>,
    signal: AbortSignal | undefined,
    onUpdate: (update: unknown) => void,
    ctx?: unknown
  ) => Promise<{
    content: Array<{ text: string; type: "text" }>
    details?: unknown
    isError?: boolean
  }>
}

const {
  mockGetCachedUserSandbox,
  mockGetInFlightUserSandbox,
  mockGetSandboxStatus,
  mockResolveDaytonaRuntimeApiKey,
  mockResolveDaytonaToolUser,
} = vi.hoisted(() => ({
  mockGetCachedUserSandbox: vi.fn(),
  mockGetInFlightUserSandbox: vi.fn(),
  mockGetSandboxStatus: vi.fn(),
  mockResolveDaytonaRuntimeApiKey: vi.fn(() => Promise.resolve(undefined)),
  mockResolveDaytonaToolUser: vi.fn(),
}))

vi.mock("@/lib/daytona/client", () => ({
  getSandboxStatus: mockGetSandboxStatus,
}))

vi.mock("@/lib/daytona/user-sandbox", () => ({
  getCachedUserSandbox: mockGetCachedUserSandbox,
  getInFlightUserSandbox: mockGetInFlightUserSandbox,
  getVolumeName: (userId: string) => `fleet-pi-ws-${userId}`,
}))

vi.mock("@/lib/pi/runtime/user-provider-secrets", () => ({
  resolveDaytonaRuntimeApiKey: mockResolveDaytonaRuntimeApiKey,
}))

vi.mock("@/lib/daytona/tool-context", () => ({
  resolveDaytonaToolUser: mockResolveDaytonaToolUser,
}))

vi.mock("@/lib/daytona/sandbox-operations", () => ({
  createSandboxOperations: vi.fn(() => ({
    bash: { exec: vi.fn().mockResolvedValue({ output: "", exitCode: 0 }) },
    read: {},
    write: {},
    edit: {},
    grep: {},
    find: {},
    ls: {},
  })),
}))

describe("daytona sandbox extension", () => {
  it("registers slim management tools only", () => {
    const names: Array<string> = []
    daytonaSandboxExtension({
      registerTool: (tool: { name?: string }) => {
        if (tool.name) names.push(tool.name)
      },
      on: vi.fn(),
    } as never)

    expect(names).toContain("daytona_get_status")
    expect(names).toContain("preview_url")
    expect(names).not.toContain("daytona_download_file")
    expect(names).not.toContain("daytona_create_sandbox")
    expect(names).not.toContain("daytona_delete_volume")
  })

  it("returns status for the authenticated user sandbox", async () => {
    const sandbox = {
      id: "sandbox-1",
      name: "fleet-pi-user-user-1",
      public: false,
      getPreviewLink: vi.fn(),
    }
    mockResolveDaytonaToolUser.mockReturnValue("user-1")
    mockGetCachedUserSandbox.mockReturnValue({
      sandbox,
      sandboxId: "sandbox-1",
      volumeId: "vol-1",
      volumeName: "fleet-pi-ws-user-1",
      userId: "user-1",
    })
    mockGetSandboxStatus.mockResolvedValue({
      id: "sandbox-1",
      name: "fleet-pi-user-user-1",
      state: "started",
    })

    const tool = registerTool("daytona_get_status")
    const result = await tool.execute(
      "call-1",
      {},
      undefined,
      vi.fn(),
      makeToolContext()
    )

    expect(result.content[0]?.text).toContain("State: started")
    expect(result.content[0]?.text).toContain("/home/daytona/agent-workspace")
  })

  it("requires a warmed sandbox cache for status", async () => {
    mockResolveDaytonaToolUser.mockReturnValue("user-1")
    mockGetCachedUserSandbox.mockReturnValue(undefined)
    const tool = registerTool("daytona_get_status")

    await expect(
      tool.execute("call-1", {}, undefined, vi.fn(), makeToolContext())
    ).rejects.toThrow("No active Daytona sandbox")
  })

  it("requires an authenticated session for status", async () => {
    mockResolveDaytonaToolUser.mockReturnValue(undefined)
    const tool = registerTool("daytona_get_status")

    await expect(
      tool.execute("call-1", {}, undefined, vi.fn(), makeToolContext())
    ).rejects.toThrow("authenticated Fleet Pi session")
  })

  it("fails closed when Daytona is expected but sandbox is missing", async () => {
    mockResolveDaytonaToolUser.mockReturnValue("user-1")
    mockGetCachedUserSandbox.mockReturnValue(undefined)

    const { bash, sessionStart } = registerExtension()
    await sessionStart({}, makeSessionStartContext())

    await expect(
      bash.execute("call-1", { command: "pwd" }, undefined, vi.fn())
    ).rejects.toThrow("NOT run on your host")
  })

  it("lazily attaches after background warm-up fills the cache", async () => {
    mockResolveDaytonaToolUser.mockReturnValue("user-1")
    mockGetCachedUserSandbox.mockReturnValue(undefined)

    const { bash, sessionStart } = registerExtension()
    await sessionStart({}, makeSessionStartContext())

    await expect(
      bash.execute("call-1", { command: "pwd" }, undefined, vi.fn())
    ).rejects.toThrow("NOT run on your host")

    const sandbox = {
      id: "sandbox-1",
      name: "fleet-pi-user-user-1",
      public: false,
      getPreviewLink: vi.fn(),
    }
    mockGetCachedUserSandbox.mockReturnValue({
      sandbox,
      sandboxId: "sandbox-1",
      volumeId: "vol-1",
      volumeName: "fleet-pi-ws-user-1",
      userId: "user-1",
    })

    await expect(
      bash.execute("call-2", { command: "pwd" }, undefined, vi.fn())
    ).resolves.not.toThrow()
  })

  it("omits preview tokens from private sandbox tool text", async () => {
    const sandbox = {
      id: "sandbox-1",
      name: "fleet-pi-user-user-1",
      public: false,
      getPreviewLink: vi.fn().mockResolvedValue({
        url: "https://preview.example/3000",
        token: "secret-preview-token",
      }),
    }
    mockResolveDaytonaToolUser.mockReturnValue("user-1")
    mockGetCachedUserSandbox.mockReturnValue({
      sandbox,
      sandboxId: "sandbox-1",
      volumeId: "vol-1",
      volumeName: "fleet-pi-ws-user-1",
      userId: "user-1",
    })

    const tool = registerTool("preview_url")
    const result = await tool.execute(
      "call-1",
      { port: 3000 },
      undefined,
      vi.fn(),
      makeToolContext()
    )

    expect(result.content[0]?.text).toContain("https://preview.example/3000")
    expect(result.content[0]?.text).toContain("/api/sandbox/preview?port=3000")
    expect(result.content[0]?.text).not.toContain("secret-preview-token")
  })

  it("attaches harness writes and bash to the same in-flight sandbox", async () => {
    mockResolveDaytonaToolUser.mockReturnValue("user-1")
    mockGetCachedUserSandbox.mockReturnValue(undefined)
    const sandbox = { id: "sandbox-inflight" }
    let resolveInFlight: (handle: {
      sandbox: { id: string }
      sandboxId: string
      volumeId: string
      volumeName: string
      userId: string
      daytonaSecretEnvVars: Array<string>
    }) => void = () => {}
    const inFlight = new Promise<{
      sandbox: { id: string }
      sandboxId: string
      volumeId: string
      volumeName: string
      userId: string
      daytonaSecretEnvVars: Array<string>
    }>((resolve) => {
      resolveInFlight = resolve
    })
    mockGetInFlightUserSandbox.mockReturnValue(inFlight)

    const { bash, sessionStart } = registerExtension()
    await sessionStart({}, makeSessionStartContext())

    const write = resolveHarnessWriteTarget({
      cwd: "/repo",
      sessionId: "session-1",
    })
    const bashResult = bash.execute(
      "call-1",
      { command: "pwd" },
      undefined,
      vi.fn()
    )
    resolveInFlight({
      sandbox,
      sandboxId: "sandbox-inflight",
      volumeId: "vol-1",
      volumeName: "fleet-pi-ws-user-1",
      userId: "user-1",
      daytonaSecretEnvVars: [],
    })

    await expect(write).resolves.toEqual({
      kind: "sandbox",
      sandbox,
    })
    await expect(bashResult).resolves.not.toThrow()
  })
})

function registerTool(name: string) {
  let registered: RegisteredTool | undefined

  daytonaSandboxExtension({
    registerTool: (tool: RegisteredTool & { name?: string }) => {
      if (tool.name === name) {
        registered = tool
      }
    },
    on: vi.fn(),
  } as never)

  if (!registered) {
    throw new Error(`${name} tool was not registered`)
  }

  return registered
}

function registerExtension() {
  let bash: RegisteredTool | undefined
  let sessionStart:
    | ((
        event: unknown,
        ctx: ReturnType<typeof makeSessionStartContext>
      ) => void | Promise<void>)
    | undefined

  daytonaSandboxExtension({
    registerTool: (tool: RegisteredTool & { name?: string }) => {
      if (tool.name === "bash") {
        bash = tool
      }
    },
    on: (event: string, handler: (event: unknown, ctx: unknown) => unknown) => {
      if (event === "session_start") {
        sessionStart = handler as typeof sessionStart
      }
    },
  } as never)

  if (!bash || !sessionStart) {
    throw new Error("bash tool or session_start was not registered")
  }

  return { bash, sessionStart }
}

function makeToolContext() {
  return {
    sessionManager: {
      getSessionId: () => "session-1",
      getSessionFile: () => "/tmp/session.jsonl",
    },
  } as never
}

function makeSessionStartContext() {
  return {
    sessionManager: {
      getSessionId: () => "session-1",
      getSessionFile: () => "/tmp/session.jsonl",
    },
    ui: {
      setStatus: vi.fn(),
    },
  } as never
}
