import { afterEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { ChatSessionResponseSchema } from "./chat-protocol.zod"
import {
  fetchValidatedJson,
  parseWithSchema,
  readChatStream,
} from "./chat-fetch"

describe("chat-fetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("validates JSON responses with schemas", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            session: { sessionId: "session-1" },
            messages: [],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
    )

    await expect(
      fetchValidatedJson("/api/chat/new", ChatSessionResponseSchema, {
        method: "POST",
      })
    ).resolves.toEqual({
      session: { sessionId: "session-1" },
      messages: [],
    })
  })

  it("rejects invalid JSON responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ session: { sessionId: 42 }, messages: [] }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
    )

    await expect(
      fetchValidatedJson("/api/chat/new", ChatSessionResponseSchema, {
        method: "POST",
      })
    ).rejects.toThrow(
      "Response from /api/chat/new did not match the expected contract"
    )
  })

  it("validates NDJSON stream events", async () => {
    const events: Array<unknown> = []
    const response = new Response(
      '{"type":"start","id":"assistant-1","runId":"assistant-1","sessionId":"session-1"}\n' +
        '{"type":"done","runId":"assistant-1","message":{"id":"assistant-1","role":"assistant","parts":[{"type":"text","text":"ok"}]},"sessionId":"session-1"}\n'
    )

    await readChatStream(response, (event) => events.push(event))

    expect(events).toEqual([
      {
        type: "start",
        id: "assistant-1",
        runId: "assistant-1",
        sessionId: "session-1",
      },
      {
        type: "done",
        runId: "assistant-1",
        message: {
          id: "assistant-1",
          role: "assistant",
          parts: [{ type: "text", text: "ok" }],
        },
        sessionId: "session-1",
      },
    ])
  })

  it("throws on invalid streamed events", async () => {
    const response = new Response(
      '{"type":"start","id":123,"sessionId":"session-1"}\n'
    )

    await expect(readChatStream(response, () => undefined)).rejects.toThrow(
      "Chat stream event did not match the expected contract"
    )
  })

  it("exposes a reusable schema parser", () => {
    expect(
      parseWithSchema(
        z.object({ ok: z.boolean() }),
        { ok: true },
        "Sample payload"
      )
    ).toEqual({ ok: true })

    expect(() =>
      parseWithSchema(
        z.object({ ok: z.boolean() }),
        { ok: "yes" },
        "Sample payload"
      )
    ).toThrow("Sample payload did not match the expected contract")
  })
})
