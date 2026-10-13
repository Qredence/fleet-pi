import { openDurableObjectSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/cloudflare"
import { DurableObject } from "cloudflare:workers"
import {
  createScriptedPort,
  createSpikeTrace,
  openSpikeHarness,
  waitForCount,
} from "./spike-harness"
import type { Storage } from "@earendil-works/pi-durable"
import type { DurableObjectState } from "cloudflare:workers"
import type { SpikeSandboxPort } from "./spike-env"
import type {
  OpenSpikeHarness,
  SpikeToolMode,
  SpikeTrace,
} from "./spike-harness"

const maxUserIdBytes = 1024

export type UserPiDurableStorageOwner = {
  objectId: string
  userId: string | undefined
}

export type UserPiDurableEcho = {
  rootId: string
  transcript: string
}

export type UserPiDurableStub = {
  readonly id: { toString: () => string }
  storageOwner: () => Promise<UserPiDurableStorageOwner>
  rootConversation: () => Promise<{ rootId: string }>
  scriptedBashEcho: () => Promise<UserPiDurableEcho>
  restart: () => Promise<{ rootId: string; transcript: string }>
  beginHangingRead: () => Promise<{ reads: number }>
  beginHangingBash: () => Promise<{ bashes: number }>
  replayRead: () => Promise<{ reads: number; rootId: string }>
  replayBash: () => Promise<{ bashes: number; transcript: string }>
  modelOnlyReply: (
    prompt: string
  ) => Promise<{ tools: Array<string>; transcript: string }>
}

type PiDurableStorage = Awaited<
  ReturnType<typeof openDurableObjectSqliteStorage>
>

/**
 * One SQLite Durable Object per user id. The object opens Pi Durable storage
 * and a harness on that storage. Production chat does not construct it.
 */
export class UserPiDurable extends DurableObject {
  #storage: PiDurableStorage | undefined
  #harness: OpenSpikeHarness | undefined
  #trace: SpikeTrace = createSpikeTrace()
  #port: SpikeSandboxPort = createScriptedPort(this.#trace)
  #mode: SpikeToolMode = "sandbox"

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env)
    void ctx.blockConcurrencyWhile(() => this.#open("sandbox"))
  }

  storageOwner(): Promise<UserPiDurableStorageOwner> {
    if (this.#storage === undefined) {
      return Promise.reject(new Error("Pi Durable storage is not open"))
    }
    return Promise.resolve({
      objectId: this.ctx.id.toString(),
      userId: this.ctx.id.name,
    })
  }

  async rootConversation() {
    const harness = await this.#requireHarness()
    return { rootId: await harness.rootId() }
  }

  async scriptedBashEcho(): Promise<UserPiDurableEcho> {
    const harness = await this.#requireHarness()
    return harness.runEcho()
  }

  async restart() {
    const harness = await this.#reopen()
    return {
      rootId: await harness.rootId(),
      transcript: await harness.transcript(),
    }
  }

  async beginHangingRead() {
    this.#trace.hang = true
    const harness = await this.#requireHarness()
    await harness.beginHanging("read")
    await waitForCount(() => this.#trace.reads, 1)
    return { reads: this.#trace.reads }
  }

  async beginHangingBash() {
    this.#trace.hang = true
    const harness = await this.#requireHarness()
    await harness.beginHanging("bash")
    await waitForCount(() => this.#trace.bashes, 1)
    return { bashes: this.#trace.bashes }
  }

  async replayRead() {
    const harness = await this.#reopen()
    harness.resume()
    await waitForCount(() => this.#trace.reads, 2)
    return { reads: this.#trace.reads, rootId: await harness.rootId() }
  }

  async replayBash() {
    const harness = await this.#reopen()
    harness.resume()
    const transcript = await harness.transcript()
    const started = Date.now()
    let latest = transcript
    while (!latest.includes("interrupted") && Date.now() - started < 4000) {
      await new Promise((resolve) => setTimeout(resolve, 20))
      latest = await harness.transcript()
    }
    return { bashes: this.#trace.bashes, transcript: latest }
  }

  async modelOnlyReply(prompt: string) {
    this.#mode = "model-only"
    const harness = await this.#reopen()
    const transcript = await harness.modelReply(prompt)
    return { tools: harness.toolNames, transcript }
  }

  async #open(mode: SpikeToolMode) {
    this.#mode = mode
    const storage = await openDurableObjectSqliteStorage(this.ctx.storage)
    this.#storage = storage
    this.#harness = await openSpikeHarness(storage, mode, this.#port)
  }

  async #reopen() {
    await this.#open(this.#mode)
    return this.#requireHarness()
  }

  #requireHarness() {
    if (this.#harness === undefined) {
      return Promise.reject(new Error("Pi Durable harness is not open"))
    }
    return Promise.resolve(this.#harness)
  }
}

export function userPiDurableName(userId: string): string {
  if (userId.length === 0) {
    throw new Error("Pi Durable object name must be a non-empty user id")
  }
  if (new TextEncoder().encode(userId).byteLength > maxUserIdBytes) {
    throw new Error(
      "Pi Durable object name must be a user id within 1024 bytes"
    )
  }
  return userId
}

export function userPiDurableStub<Stub extends UserPiDurableStub>(
  namespace: { getByName: (name: string) => Stub },
  userId: string
): Stub {
  return namespace.getByName(userPiDurableName(userId))
}
