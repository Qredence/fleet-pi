import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"
import { userPiDurableStub } from "../user-pi-durable"

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

  it("rejects an empty or oversized user id", () => {
    expect(() => userPiDurableStub(env.USER_PI_DURABLE, "")).toThrow(
      /non-empty user id/
    )
    expect(() =>
      userPiDurableStub(env.USER_PI_DURABLE, "a".repeat(1025))
    ).toThrow(/1024 bytes/)
  })
})
