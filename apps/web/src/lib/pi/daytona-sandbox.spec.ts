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

const { mockCreateDaytonaClient, mockDownloadFile } = vi.hoisted(() => ({
  mockCreateDaytonaClient: vi.fn(),
  mockDownloadFile: vi.fn(),
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

describe("daytona sandbox extension", () => {
  it("truncates downloaded file content in chat output and details", async () => {
    const sandbox = {}
    const client = { get: vi.fn(() => Promise.resolve(sandbox)) }
    mockCreateDaytonaClient.mockReturnValue(client)
    mockDownloadFile.mockResolvedValue(Buffer.alloc(70 * 1024, "a"))

    const tool = registerTool("daytona_download_file")
    const result = await tool.execute(
      "call-1",
      { path: "/tmp/large.txt", sandboxId: "sandbox-1" },
      undefined,
      vi.fn(),
      {}
    )

    expect(client.get).toHaveBeenCalledWith("sandbox-1")
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
