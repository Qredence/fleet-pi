import { describe, expect, it, vi } from "vitest"

import daytonaSandboxExtension from "../../../../../.pi/extensions/daytona-sandbox"

interface RegisteredTool {
  name: string
  execute: (
    toolCallId: string,
    params: { path: string; sandboxId: string },
    signal: AbortSignal | undefined,
    onUpdate: (update: unknown) => void,
    ctx: unknown
  ) => Promise<{
    content: Array<{ text: string; type: "text" }>
    details?: unknown
    isError?: boolean
  }>
}

const {
  mockCreateDaytonaClient,
  mockDownloadFile,
  mockGetCachedUserSandbox,
  mockGetUserSandbox,
  mockResolveDaytonaToolUser,
} = vi.hoisted(() => ({
  mockCreateDaytonaClient: vi.fn(),
  mockDownloadFile: vi.fn(),
  mockGetCachedUserSandbox: vi.fn(),
  mockGetUserSandbox: vi.fn(),
  mockResolveDaytonaToolUser: vi.fn(),
}))

vi.mock("@/lib/daytona/client", () => ({
  createDaytonaClient: mockCreateDaytonaClient,
  createSandbox: vi.fn(),
  executeCommand: vi.fn(),
  runCode: vi.fn(),
  uploadFile: vi.fn(),
  downloadFile: mockDownloadFile,
  listFiles: vi.fn(),
  stopSandbox: vi.fn(),
  startSandbox: vi.fn(),
  deleteSandbox: vi.fn(),
  getSandboxStatus: vi.fn(),
  createSnapshot: vi.fn(),
  deleteSnapshot: vi.fn(),
  createVolumeMount: vi.fn(),
  deleteVolume: vi.fn(),
  getOrCreateVolume: vi.fn(),
  listVolumes: vi.fn(),
}))

vi.mock("@/lib/daytona/user-sandbox", () => ({
  getCachedUserSandbox: mockGetCachedUserSandbox,
  getSessionVolumeName: (userId: string) => `fleet-pi-sessions-${userId}`,
  getUserSandbox: mockGetUserSandbox,
  getVolumeName: (userId: string) => `fleet-pi-ws-${userId}`,
}))

vi.mock("@/lib/daytona/tool-context", () => ({
  resolveDaytonaToolUser: mockResolveDaytonaToolUser,
}))

const client = { get: vi.fn() }

describe("daytona sandbox extension", () => {
  it("truncates downloaded file content in chat output and details", async () => {
    const sandbox = { id: "sandbox-1", name: "fleet-pi-user-user-1" }
    mockCreateDaytonaClient.mockReturnValue(client)
    mockDownloadFile.mockResolvedValue(Buffer.alloc(70 * 1024, "a"))
    mockResolveDaytonaToolUser.mockReturnValue("user-1")
    mockGetCachedUserSandbox.mockReturnValue({
      sandbox,
      sandboxId: "sandbox-1",
      volumeId: "vol-1",
      volumeName: "fleet-pi-ws-user-1",
      userId: "user-1",
    })

    const tool = registerTool("daytona_download_file")
    const result = await tool.execute(
      "call-1",
      { path: "/tmp/large.txt", sandboxId: "sandbox-1" },
      undefined,
      vi.fn(),
      makeToolContext()
    )

    expect(mockDownloadFile).toHaveBeenCalledWith(sandbox, "/tmp/large.txt")
    expect(result.content[0]?.text).toContain("truncated after 65536 bytes")
    expect(result.content[0]?.text.length).toBeLessThan(67_000)
    expect(result.details).toMatchObject({
      path: "/tmp/large.txt",
      previewBytes: 65_536,
      size: 71_680,
      truncated: true,
    })
    expect((result.details as { content?: string }).content).toBeUndefined()
  })

  it("rejects sandbox access outside the authenticated user's sandbox", async () => {
    const sandbox = { id: "sandbox-1", name: "fleet-pi-user-user-1" }
    mockResolveDaytonaToolUser.mockReturnValue("user-1")
    mockGetCachedUserSandbox.mockReturnValue({
      sandbox,
      sandboxId: "sandbox-1",
      volumeId: "vol-1",
      volumeName: "fleet-pi-ws-user-1",
      userId: "user-1",
    })

    const tool = registerTool("daytona_download_file")

    await expect(
      tool.execute(
        "call-1",
        { path: "/tmp/large.txt", sandboxId: "sandbox-2" },
        undefined,
        vi.fn(),
        makeToolContext()
      )
    ).rejects.toThrow("limited to your Fleet Pi sandbox")
  })
})

function registerTool(name: string) {
  let registered: RegisteredTool | undefined

  daytonaSandboxExtension({
    registerTool: (tool: RegisteredTool) => {
      if (tool.name === name) {
        registered = tool
      }
    },
  } as never)

  if (!registered) {
    throw new Error(`${name} tool was not registered`)
  }

  return registered
}

function makeToolContext() {
  return {
    sessionManager: {
      getSessionId: () => "session-1",
      getSessionFile: () => "/tmp/session.jsonl",
    },
  } as never
}
