import { join } from "node:path"
import { createReadTool } from "@earendil-works/pi-coding-agent"
import { afterEach, describe, expect, it, vi } from "vitest"
import { downloadFile, listFiles } from "../client"
import {
  RESOURCE_CACHE_PREFIX,
  resourceCachePathToSandbox,
} from "../resource-cache-path"
import { createSandboxReadOperations } from "../sandbox-operations"
import type { Sandbox } from "@daytona/sdk"

vi.mock("../client", () => ({ downloadFile: vi.fn(), listFiles: vi.fn() }))
afterEach(() => vi.clearAllMocks())

describe("sandbox resource paths", () => {
  it("lets Pi's Read tool read an advertised cached skill from the bound volume", async () => {
    const root = "/home/daytona/agent-workspace"
    const cachePath = join(
      `${RESOURCE_CACHE_PREFIX}ABC123`,
      "pi/skills/test/SKILL.md"
    )
    const sandbox = { id: "current-user" } as Sandbox
    vi.mocked(listFiles).mockResolvedValue([
      { name: "SKILL.md", size: 5, isDir: false },
    ])
    vi.mocked(downloadFile).mockResolvedValue(Buffer.from("Skill"))
    const read = createReadTool(root, {
      operations: createSandboxReadOperations(sandbox, root),
    })
    const result = await read.execute("read", { path: cachePath })
    expect(result.content).toContainEqual(
      expect.objectContaining({ type: "text", text: "Skill" })
    )
    expect(downloadFile).toHaveBeenCalledWith(
      sandbox,
      `${root}/pi/skills/test/SKILL.md`
    )
  })

  it("keeps host paths outside the cache and traversal outside the sandbox blocked", () => {
    const operations = createSandboxReadOperations(
      {} as Sandbox,
      "/home/daytona/agent-workspace"
    )
    const unrelated = join(`${RESOURCE_CACHE_PREFIX}ABC123`, "secrets.txt")
    expect(resourceCachePathToSandbox(unrelated)).toBe(unrelated)
    expect(() => operations.readFile(unrelated)).toThrow("escapes workspace")
    expect(() =>
      operations.readFile(
        join(`${RESOURCE_CACHE_PREFIX}ABC123`, "pi/../../../secrets.txt")
      )
    ).toThrow("escapes workspace")
    expect(downloadFile).not.toHaveBeenCalled()
  })
})
