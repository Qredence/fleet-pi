import { afterEach, describe, expect, it, vi } from "vitest"

import webFetchExtension from "../../../../../.pi/extensions/web-fetch"

const { lookupMock } = vi.hoisted(() => ({
  lookupMock: vi.fn(),
}))

vi.mock("node:dns/promises", () => ({
  lookup: lookupMock,
}))

describe("web_fetch extension", () => {
  afterEach(() => {
    lookupMock.mockReset()
    vi.unstubAllGlobals()
  })

  it("rejects hostnames that resolve to private IP addresses", async () => {
    lookupMock.mockResolvedValue([{ address: "127.0.0.1", family: 4 }])
    const fetchMock =
      vi.fn<(input: string, init?: RequestInit) => Promise<Response>>()
    vi.stubGlobal("fetch", fetchMock)

    const tool = registerWebFetchTool()
    const result = await tool.execute(
      "call-1",
      { url: "https://example.com", maxBytes: 1024 },
      undefined,
      vi.fn(),
      {}
    )

    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toContain(
      "resolves to a private or internal IP address"
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("allows explicit localhost URLs for local development", async () => {
    const fetchMock = vi.fn<
      (input: string, init?: RequestInit) => Promise<Response>
    >(async () => {
      return new Response("local ok", {
        headers: { "content-type": "text/plain" },
        status: 200,
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    const tool = registerWebFetchTool()
    const result = await tool.execute(
      "call-local",
      { url: "http://localhost:3000/api/health", maxBytes: 1024 },
      undefined,
      vi.fn(),
      {}
    )

    expect(result.isError).not.toBe(true)
    expect(lookupMock).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const requestInit = fetchMock.mock.calls[0]?.[1]
    expect(requestInit).toMatchObject({ redirect: "error" })
  })

  it("disables redirect following on outbound fetches", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }])
    const fetchMock = vi.fn<
      (input: string, init?: RequestInit) => Promise<Response>
    >(async () => {
      return new Response("hello", {
        headers: { "content-type": "text/plain" },
        status: 200,
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    const tool = registerWebFetchTool()
    const result = await tool.execute(
      "call-2",
      { url: "https://example.com", maxBytes: 1024 },
      undefined,
      vi.fn(),
      {}
    )

    expect(result.isError).not.toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const requestInit = fetchMock.mock.calls[0]?.[1]
    expect(requestInit).toMatchObject({ redirect: "error" })
  })
})

function registerWebFetchTool() {
  let registered:
    | {
        execute: (
          toolCallId: string,
          params: { maxBytes?: number; url: string },
          signal: AbortSignal | undefined,
          onUpdate: (update: unknown) => void,
          ctx: unknown
        ) => Promise<{
          content: Array<{ text: string; type: "text" }>
          details?: unknown
          isError?: boolean
        }>
      }
    | undefined

  webFetchExtension({
    registerTool: (tool: typeof registered) => {
      registered = tool
    },
  } as never)

  if (!registered) {
    throw new Error("web_fetch tool was not registered")
  }

  return registered
}
