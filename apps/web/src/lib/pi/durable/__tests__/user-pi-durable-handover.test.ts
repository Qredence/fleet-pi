import { describe, expect, it, vi } from "vitest"

import { createScriptedSandboxPort, createHostedTrace } from "../hosted-harness"

import { nodeWorkspaceSql } from "./node-workspace-sql"

import type { HostedSandboxPort } from "../hosted-sandbox-env"

vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    constructor(public ctx: unknown) {}
  },
}))

vi.mock("@earendil-works/pi-durable/storage/sqlite/cloudflare", () => ({
  openDurableObjectSqliteStorage: () => Promise.resolve({}),
}))

vi.mock("../durable-sandbox-port", () => ({
  openDaytonaSandboxPort: vi.fn(),
}))

vi.mock("../hosted-harness", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../hosted-harness")>()),
  openHostedHarness: () =>
    Promise.resolve({
      runAgentTurn: () => Promise.resolve({ conversationId: "test" }),
    }),
}))

async function setup(volume: HostedSandboxPort) {
  const { openDaytonaSandboxPort } = await import("../durable-sandbox-port")
  vi.mocked(openDaytonaSandboxPort).mockResolvedValue(volume)
  const { UserPiDurable } = await import("../user-pi-durable")
  let initialized = Promise.resolve()
  const sql = nodeWorkspaceSql()
  const deleteAll = vi.fn(() => {
    for (const name of ["files", "dirs", "template", "meta"]) {
      sql.exec(`DELETE FROM fleet_workspace_${name}`)
    }
    return Promise.resolve()
  })
  const ctx = {
    storage: { sql, deleteAll },
    blockConcurrencyWhile: (callback: () => Promise<void>) => {
      initialized = callback()
      return initialized
    },
  }
  const durable = new UserPiDurable(ctx as never, {})
  await initialized
  const write = await durable.fetch(
    new Request("https://durable/workspace/fs", {
      method: "POST",
      body: JSON.stringify({
        op: "write",
        path: "scratch/note.md",
        content: "keep me",
      }),
    })
  )
  expect(write.ok).toBe(true)
  const turn = async () => {
    const response = await durable.fetch(
      new Request("https://durable/agent", {
        method: "POST",
        body: JSON.stringify({
          create: true,
          prompt: "hello",
          model: { provider: "hosted", modelId: "hosted", apiKey: "test" },
          sandbox: { sandboxId: "same-sandbox", apiKey: "test" },
        }),
      })
    )
    expect(response.ok).toBe(true)
    await response.text()
  }
  return { durable, turn, deleteAll }
}

describe("UserPiDurable workspace handover scheduling", () => {
  it("retries a failed handover on the next turn with the cached sandbox", async () => {
    const base = createScriptedSandboxPort(createHostedTrace())
    const write = vi.fn(base.write).mockRejectedValueOnce(new Error("offline"))
    const { turn } = await setup({ ...base, write })
    await turn()
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1))
    await turn()
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(2))
    await expect(base.read("scratch/note.md")).resolves.toBe("keep me")
  })

  it("finishes an in-flight handover before erasing its storage", async () => {
    const base = createScriptedSandboxPort(createHostedTrace())
    let finishWrite = () => {}
    const pending = new Promise<void>((resolve) => {
      finishWrite = resolve
    })
    const write = vi.fn(async () => pending)
    const { durable, turn, deleteAll } = await setup({ ...base, write })
    await turn()
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1))
    const erasure = durable.fetch(
      new Request("https://durable/data", { method: "DELETE" })
    )
    await Promise.resolve()
    expect(deleteAll).not.toHaveBeenCalled()
    finishWrite()
    expect((await erasure).ok).toBe(true)
    expect(deleteAll).toHaveBeenCalledOnce()
  })
})
