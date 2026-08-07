import { afterEach, describe, expect, it, vi } from "vitest"
import { ChatRequestError } from "../pi/chat-fetch"
import { loadWorkspaceFile } from "./client"
import type { WorkspaceFileResponse } from "@workspace/pi-protocol/chat-protocol"

describe("loadWorkspaceFile", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns a validated WorkspaceFileResponse", async () => {
    const payload: WorkspaceFileResponse = {
      path: "agent-workspace/system/tool-policy.md",
      name: "tool-policy.md",
      content: "# Tool Policy\n",
      mediaType: "text/markdown",
      size: 14,
      status: "ok",
    }
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    )

    const result = await loadWorkspaceFile(
      "agent-workspace/system/tool-policy.md"
    )

    const typed: WorkspaceFileResponse = result
    expect(typed).toEqual(payload)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "/api/workspace/file?path=agent-workspace%2Fsystem%2Ftool-policy.md"
      ),
      expect.anything()
    )
  })

  it("rejects responses that do not match the schema", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            path: "agent-workspace/notes.txt",
            name: "notes.txt",
            content: "hello",
            mediaType: "text/html",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
    )

    await expect(
      loadWorkspaceFile("agent-workspace/notes.txt")
    ).rejects.toThrow(/did not match the expected contract/)
  })

  it("surfaces server error messages as ChatRequestError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ message: "Daytona credential required." }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
    )

    const promise = loadWorkspaceFile("agent-workspace/notes.txt")
    await expect(promise).rejects.toBeInstanceOf(ChatRequestError)
    await expect(promise).rejects.toMatchObject({
      status: 403,
      message: "Daytona credential required.",
    })
  })
})
