import { describe, expect, it, vi } from "vitest"

import daytonaSandboxExtension from "../../../../../.pi/extensions/daytona-sandbox"

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
  mockGetSandboxStatus,
  mockResolveDaytonaToolUser,
} = vi.hoisted(() => ({
  mockGetCachedUserSandbox: vi.fn(),
  mockGetSandboxStatus: vi.fn(),
  mockResolveDaytonaToolUser: vi.fn(),
}))

vi.mock("../../../../../apps/web/src/lib/daytona/client", () => ({
  getSandboxStatus: mockGetSandboxStatus,
}))

vi.mock("../../../../../apps/web/src/lib/daytona/user-sandbox", () => ({
  getCachedUserSandbox: mockGetCachedUserSandbox,
  getVolumeName: (userId: string) => `fleet-pi-ws-${userId}`,
}))

vi.mock("../../../../../apps/web/src/lib/daytona/tool-context", () => ({
  resolveDaytonaToolUser: mockResolveDaytonaToolUser,
}))

vi.mock("../../../../../apps/web/src/lib/daytona/sandbox-operations", () => ({
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

    expect(() =>
      bash.execute("call-1", { command: "pwd" }, undefined, vi.fn())
    ).toThrow("NOT run on your host")
  })

  it("lazily attaches after background warm-up fills the cache", async () => {
    mockResolveDaytonaToolUser.mockReturnValue("user-1")
    mockGetCachedUserSandbox.mockReturnValue(undefined)

    const { bash, sessionStart } = registerExtension()
    await sessionStart({}, makeSessionStartContext())

    expect(() =>
      bash.execute("call-1", { command: "pwd" }, undefined, vi.fn())
    ).toThrow("NOT run on your host")

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
