import { getOpenApiMetadata } from "@asteasolutions/zod-to-openapi"
import { describe, expect, it } from "vitest"

import { WorkspaceFileResponseSchema } from "../chat-protocol.zod"

describe("WorkspaceFileResponseSchema", () => {
  it("parses a valid payload", () => {
    const payload = {
      path: "agent-workspace/system/tool-policy.md",
      name: "tool-policy.md",
      content: "# Tool Policy\n",
      mediaType: "text/markdown",
      size: 14,
      status: "ok",
    }

    const result = WorkspaceFileResponseSchema.safeParse(payload)

    expect(result.success).toBe(true)
    expect(result.data).toEqual(payload)
  })

  it("parses a minimal payload without size or status", () => {
    const result = WorkspaceFileResponseSchema.safeParse({
      path: "agent-workspace/notes.txt",
      name: "notes.txt",
      content: "hello",
      mediaType: "text/plain",
    })

    expect(result.success).toBe(true)
  })

  it("parses binary and too-large payloads", () => {
    for (const [mediaType, status] of [
      ["application/octet-stream", "unsupported"],
      ["text/plain", "too-large"],
    ] as const) {
      const result = WorkspaceFileResponseSchema.safeParse({
        path: "agent-workspace/blob.bin",
        name: "blob.bin",
        content: "",
        mediaType,
        size: 512,
        status,
      })
      expect(result.success).toBe(true)
    }
  })

  it("rejects an invalid mediaType", () => {
    const result = WorkspaceFileResponseSchema.safeParse({
      path: "agent-workspace/notes.txt",
      name: "notes.txt",
      content: "hello",
      mediaType: "text/html",
    })

    expect(result.success).toBe(false)
  })

  it("rejects an invalid status", () => {
    const result = WorkspaceFileResponseSchema.safeParse({
      path: "agent-workspace/notes.txt",
      name: "notes.txt",
      content: "hello",
      mediaType: "text/plain",
      status: "missing",
    })

    expect(result.success).toBe(false)
  })

  it("rejects a payload missing required fields", () => {
    const result = WorkspaceFileResponseSchema.safeParse({
      path: "agent-workspace/notes.txt",
      content: "hello",
      mediaType: "text/plain",
    })

    expect(result.success).toBe(false)
  })

  it("carries openapi description metadata", () => {
    expect(getOpenApiMetadata(WorkspaceFileResponseSchema).description).toBe(
      "Workspace file preview response"
    )
  })
})
