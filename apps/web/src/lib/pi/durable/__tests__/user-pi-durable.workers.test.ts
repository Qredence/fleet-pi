import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"
import { userPiDurableStub } from "../user-pi-durable"

function durableFetch(
  stub: ReturnType<typeof userPiDurableStub>,
  request: Request
): Promise<Response> {
  const target = stub as { fetch: (request: Request) => Promise<Response> }
  return target.fetch.call(stub, request)
}

async function agentTurn(
  stub: ReturnType<typeof userPiDurableStub>,
  input: { create: boolean; conversationId?: string; modelId: string }
): Promise<{ sessionId: string; body: string }> {
  const response = await durableFetch(
    stub,
    new Request("https://user-pi-durable/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "hello",
        create: input.create,
        conversationId: input.conversationId,
        model: {
          provider: "spike",
          modelId: input.modelId,
          apiKey: "test-key",
          baseUrl: "http://localhost/v1",
          api: "openai-completions",
        },
      }),
    })
  )
  expect(response.ok).toBe(true)
  const body = await response.text()
  const done = body
    .split("\n")
    .filter((line) => line.startsWith('{"type":"done"'))
    .map((line) => JSON.parse(line) as { sessionId: string })
    .at(-1)
  expect(done).toBeTruthy()
  return { sessionId: done!.sessionId, body }
}

/** Sessions the user started; the harness root conversation has no prompt. */
async function promptedSessions(
  stub: ReturnType<typeof userPiDurableStub>
): Promise<Array<{ id: string; firstMessage: string }>> {
  const response = await durableFetch(
    stub,
    new Request("https://user-pi-durable/sessions")
  )
  const body = (await response.json()) as {
    sessions: Array<{ id: string; firstMessage: string }>
  }
  return body.sessions.filter((session) => session.firstMessage !== "")
}

describe("UserPiDurable", () => {
  it("routes two requests for the same user to one object id", async () => {
    const first = userPiDurableStub(env.USER_PI_DURABLE, "user-a")
    const second = userPiDurableStub(env.USER_PI_DURABLE, "user-a")
    const other = userPiDurableStub(env.USER_PI_DURABLE, "user-b")

    expect(first.id.toString()).toBe(second.id.toString())
    expect(first.id.toString()).not.toBe(other.id.toString())

    const firstOwner = await first.storageOwner()
    const secondOwner = await second.storageOwner()
    const otherOwner = await other.storageOwner()

    expect(firstOwner.objectId).toBe(secondOwner.objectId)
    expect(firstOwner.objectId).toBe(first.id.toString())
    expect(firstOwner.userId).toBe("user-a")
    expect(secondOwner.userId).toBe("user-a")
    expect(otherOwner.objectId).not.toBe(firstOwner.objectId)
    expect(otherOwner.userId).toBe("user-b")
  })

  it("keeps a scripted bash echo on the same root after restart", async () => {
    const stub = userPiDurableStub(env.USER_PI_DURABLE, "user-echo")
    const echo = await stub.scriptedBashEcho()
    const restarted = await stub.restart()

    expect(restarted.rootId).toBe(echo.rootId)
    expect(restarted.transcript).toContain("fleet-pi-spike")
    expect(echo.transcript).toContain("fleet-pi-spike")
  })

  it("replays a read and interrupts bash inside the object", async () => {
    const reader = userPiDurableStub(env.USER_PI_DURABLE, "user-read")
    const started = await reader.beginHangingRead()
    const replayed = await reader.replayRead()

    const runner = userPiDurableStub(env.USER_PI_DURABLE, "user-bash")
    await runner.beginHangingBash()
    const interrupted = await runner.replayBash()

    expect(started.reads).toBe(1)
    expect(replayed.reads).toBe(2)
    expect(replayed.rootId).toBe((await reader.rootConversation()).rootId)
    expect(interrupted.bashes).toBe(1)
    expect(interrupted.transcript).toContain(
      "Tool bash was interrupted and may have partially run"
    )
  })

  it("returns a model reply without sandbox tools", async () => {
    const stub = userPiDurableStub(env.USER_PI_DURABLE, "user-model")
    const reply = await stub.modelOnlyReply("hello")

    expect(reply.tools).not.toContain("bash")
    expect(reply.tools).not.toContain("write")
    expect(reply.tools).not.toContain("edit")
    expect(reply.transcript).toContain("spike model reply")
  })

  it("aborts an in-flight agent turn via POST /agent/abort", async () => {
    const stub = userPiDurableStub(env.USER_PI_DURABLE, "user-agent-abort")
    const spikeModel = {
      provider: "spike",
      modelId: "spike",
      apiKey: "test",
      baseUrl: "http://localhost",
      api: "openai-completions" as const,
    }
    const turn = durableFetch(
      stub,
      new Request("https://user-pi-durable/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "hello",
          create: true,
          model: spikeModel,
        }),
      })
    )
    const abortResponse = await durableFetch(
      stub,
      new Request("https://user-pi-durable/agent/abort", { method: "POST" })
    )
    expect(await abortResponse.json()).toMatchObject({ aborted: true })
    const stream = await turn
    expect(stream.ok).toBe(true)
    await stream.text()

    const secondTurn = await durableFetch(
      stub,
      new Request("https://user-pi-durable/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "again",
          create: true,
          model: spikeModel,
        }),
      })
    )
    expect(secondTurn.status).not.toBe(409)
    await secondTurn.text()
  })

  it("returns aborted false when no agent turn is active", async () => {
    const stub = userPiDurableStub(env.USER_PI_DURABLE, "user-agent-idle")
    const response = await durableFetch(
      stub,
      new Request("https://user-pi-durable/agent/abort", { method: "POST" })
    )
    expect(await response.json()).toMatchObject({ aborted: false })
  })

  it("tombstones durable session deletes idempotently", async () => {
    const stub = userPiDurableStub(env.USER_PI_DURABLE, "user-delete-session")
    const agentResponse = await durableFetch(
      stub,
      new Request("https://user-pi-durable/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "hello durable delete",
          create: true,
          model: {
            provider: "spike",
            modelId: "spike",
            apiKey: "test-key",
            baseUrl: "http://localhost/v1",
            api: "openai-completions",
          },
          workspace: {
            toolsAvailable: false,
            reason: "daytona_sandbox_not_ready",
          },
        }),
      })
    )
    expect(agentResponse.ok).toBe(true)
    const body = await agentResponse.text()
    const startLine = body
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith('{"type":"start"'))
    expect(startLine).toBeTruthy()
    const start = JSON.parse(startLine!) as {
      sessionId: string
      workspace?: { reason?: string }
    }
    expect(start.workspace?.reason).toBe("daytona_sandbox_not_ready")
    const conversationId = start.sessionId.replace(/^durable:/, "")

    const firstDelete = await durableFetch(
      stub,
      new Request(
        `https://user-pi-durable/session?id=${encodeURIComponent(conversationId)}`,
        { method: "DELETE" }
      )
    )
    expect(firstDelete.status).toBe(200)

    const readDeleted = await durableFetch(
      stub,
      new Request(
        `https://user-pi-durable/session?id=${encodeURIComponent(conversationId)}`
      )
    )
    expect(readDeleted.status).toBe(404)

    const secondDelete = await durableFetch(
      stub,
      new Request(
        `https://user-pi-durable/session?id=${encodeURIComponent(conversationId)}`,
        { method: "DELETE" }
      )
    )
    expect(secondDelete.status).toBe(200)
  })

  it("runs a resumed conversation on the model chosen for that turn", async () => {
    const stub = userPiDurableStub(env.USER_PI_DURABLE, "user-model-switch")
    const first = await agentTurn(stub, { create: true, modelId: "spike" })
    const conversationId = first.sessionId.replace(/^durable:/, "")

    const second = await agentTurn(stub, {
      create: false,
      conversationId,
      modelId: "spike-b",
    })

    expect(second.sessionId).toBe(first.sessionId)
    expect(second.body).toContain("spike model reply from spike-b")
  })

  it("erases every hosted conversation on DELETE /data", async () => {
    const stub = userPiDurableStub(env.USER_PI_DURABLE, "user-erase")
    const before = await agentTurn(stub, { create: true, modelId: "spike" })
    const conversationId = before.sessionId.replace(/^durable:/, "")
    expect(await promptedSessions(stub)).toHaveLength(1)

    const erased = await durableFetch(
      stub,
      new Request("https://user-pi-durable/data", { method: "DELETE" })
    )
    expect(await erased.json()).toEqual({ erased: true })
    expect(await promptedSessions(stub)).toEqual([])
    const readErased = await durableFetch(
      stub,
      new Request(
        `https://user-pi-durable/session?id=${encodeURIComponent(conversationId)}`
      )
    )
    expect(readErased.status).toBe(404)

    const after = await agentTurn(stub, { create: true, modelId: "spike" })
    expect(after.body).toContain("spike model reply")
    expect(await promptedSessions(stub)).toHaveLength(1)
  })

  it("rejects an empty or oversized user id", () => {
    expect(() => userPiDurableStub(env.USER_PI_DURABLE, "")).toThrow(
      /non-empty user id/
    )
    expect(() =>
      userPiDurableStub(env.USER_PI_DURABLE, "a".repeat(1025))
    ).toThrow(/1024 bytes/)
  })
})
