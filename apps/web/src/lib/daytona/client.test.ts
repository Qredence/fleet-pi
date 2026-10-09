import { describe, expect, it, vi } from "vitest"
import {
  createSandbox,
  createVolumeMount,
  getOrCreateVolume,
  resolveDaytonaConfig,
} from "./client"
import type { Daytona, Sandbox } from "@daytona/sdk"

describe("Daytona client", () => {
  it("uses SDK defaults when optional Daytona environment is omitted", () => {
    expect(resolveDaytonaConfig({ DAYTONA_API_KEY: "key" })).toEqual({
      apiKey: "key",
    })
  })

  it("prioritizes explicit api key over env", () => {
    expect(
      resolveDaytonaConfig({ DAYTONA_API_KEY: "key" }, "explicit-key")
    ).toEqual({
      apiKey: "explicit-key",
    })
  })

  it("passes optional API URL and target when configured", () => {
    expect(
      resolveDaytonaConfig({
        DAYTONA_API_KEY: "key",
        DAYTONA_API_URL: " https://example.test/api ",
        DAYTONA_TARGET: " eu ",
      })
    ).toEqual({
      apiKey: "key",
      apiUrl: "https://example.test/api",
      target: "eu",
    })
  })

  it("requires a Daytona API key", () => {
    expect(() => resolveDaytonaConfig({})).toThrow("DAYTONA_API_KEY is not set")
  })

  it("creates validated Daytona volume mounts", () => {
    expect(
      createVolumeMount({
        volumeId: "vol-1",
        mountPath: "/home/daytona/agent-workspace",
        subpath: "projects/fleet-pi",
      })
    ).toEqual({
      volumeId: "vol-1",
      mountPath: "/home/daytona/agent-workspace",
      subpath: "projects/fleet-pi",
    })
  })

  it("rejects unsafe Daytona volume mount paths", () => {
    expect(() =>
      createVolumeMount({ volumeId: "vol-1", mountPath: "/etc/fleet-pi" })
    ).toThrow("Invalid Daytona volume mount path")
    expect(() =>
      createVolumeMount({ volumeId: "vol-1", mountPath: "agent-workspace" })
    ).toThrow("Invalid Daytona volume mount path")
  })

  it("passes volume mounts and lifecycle options into sandbox creation", async () => {
    const calls: Array<unknown> = []
    const sandbox = { id: "sandbox-1" } as Sandbox
    const client = {
      create: (params: unknown) => {
        calls.push(params)
        return Promise.resolve(sandbox)
      },
    } as unknown as Daytona

    await createSandbox(client, {
      name: "fleet-pi",
      image: "node:22-bookworm",
      language: "typescript",
      public: true,
      autoStopInterval: 30,
      volumes: [
        createVolumeMount({
          volumeId: "vol-1",
          mountPath: "/home/daytona/agent-workspace",
        }),
      ],
    })

    expect(calls[0]).toMatchObject({
      name: "fleet-pi",
      image: "node:22-bookworm",
      language: "typescript",
      public: true,
      autoStopInterval: 30,
      volumes: [
        {
          volumeId: "vol-1",
          mountPath: "/home/daytona/agent-workspace",
        },
      ],
    })
  })

  it("passes Daytona Secrets map into sandbox creation", async () => {
    const calls: Array<unknown> = []
    const sandbox = { id: "sandbox-1" } as Sandbox
    const client = {
      create: (params: unknown) => {
        calls.push(params)
        return Promise.resolve(sandbox)
      },
    } as unknown as Daytona

    await createSandbox(client, {
      name: "fleet-pi",
      image: "node:22-bookworm",
      secrets: { GEMINI_API_KEY: "fleet_pi_google" },
    })

    expect(calls[0]).toMatchObject({
      name: "fleet-pi",
      secrets: { GEMINI_API_KEY: "fleet_pi_google" },
    })
  })

  it("passes resource overrides when using the default Daytona image", async () => {
    const calls: Array<unknown> = []
    const sandbox = { id: "sandbox-1" } as Sandbox
    const client = {
      create: (params: unknown) => {
        calls.push(params)
        return Promise.resolve(sandbox)
      },
    } as unknown as Daytona

    await createSandbox(client, {
      name: "fleet-pi",
      cpu: 2,
      memory: 4,
      disk: 8,
    })

    expect(calls[0]).toMatchObject({
      image: "node:22-bookworm",
      resources: {
        cpu: 2,
        memory: 4,
        disk: 8,
      },
    })
  })
})

describe("getOrCreateVolume", () => {
  function volumeClient(states: Array<string | undefined>) {
    const get = vi.fn(() => {
      const state = states.length > 1 ? states.shift() : states[0]
      return Promise.resolve({ id: "vol-1", name: "fleet-pi-ws-u1", state })
    })
    return { client: { volume: { get } } as unknown as Daytona, get }
  }

  it("returns a ready volume without polling", async () => {
    const { client, get } = volumeClient(["ready"])
    const sleep = vi.fn(() => Promise.resolve())

    await expect(
      getOrCreateVolume(client, "fleet-pi-ws-u1", { sleep })
    ).resolves.toEqual({ id: "vol-1", name: "fleet-pi-ws-u1", state: "ready" })
    expect(get).toHaveBeenCalledTimes(1)
    expect(get).toHaveBeenCalledWith("fleet-pi-ws-u1", true)
    expect(sleep).not.toHaveBeenCalled()
  })

  it("waits for a freshly created volume to leave pending_create", async () => {
    const { client, get } = volumeClient([
      "pending_create",
      "creating",
      "ready",
    ])
    const sleep = vi.fn(() => Promise.resolve())

    const volume = await getOrCreateVolume(client, "fleet-pi-ws-u1", {
      sleep,
      pollIntervalMs: 10,
    })

    expect(volume.state).toBe("ready")
    expect(get).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenCalledTimes(2)
  })

  it("fails with a clear error when the volume never becomes ready", async () => {
    const { client } = volumeClient(["pending_create"])
    let clock = 0
    const sleep = vi.fn((ms: number) => {
      clock += ms
      return Promise.resolve()
    })

    await expect(
      getOrCreateVolume(client, "fleet-pi-ws-u1", {
        sleep,
        now: () => clock,
        timeoutMs: 30,
        pollIntervalMs: 10,
      })
    ).rejects.toThrow(/not ready after 30ms \(state: pending_create\)/)
    expect(sleep).toHaveBeenCalledTimes(3)
  })

  it("counts slow volume lookups toward the timeout", async () => {
    let clock = 0
    const get = vi.fn(() => {
      clock += 25 // each GET takes 25ms
      return Promise.resolve({
        id: "vol-1",
        name: "fleet-pi-ws-u1",
        state: "pending_create",
      })
    })
    const client = { volume: { get } } as unknown as Daytona
    const sleep = vi.fn((ms: number) => {
      clock += ms
      return Promise.resolve()
    })

    await expect(
      getOrCreateVolume(client, "fleet-pi-ws-u1", {
        sleep,
        now: () => clock,
        timeoutMs: 60,
        pollIntervalMs: 10,
      })
    ).rejects.toThrow(/not ready after 60ms/)
    expect(sleep).toHaveBeenCalledTimes(1)
  })

  it("rejects a volume without a state instead of assuming it is ready", async () => {
    const { client } = volumeClient([undefined])
    const sleep = vi.fn(() => Promise.resolve())

    await expect(
      getOrCreateVolume(client, "fleet-pi-ws-u1", { sleep })
    ).rejects.toThrow(/not usable \(state: unknown\)/)
    expect(sleep).not.toHaveBeenCalled()
  })

  it("fails fast for unusable volume states", async () => {
    const { client } = volumeClient(["error"])
    const sleep = vi.fn(() => Promise.resolve())

    await expect(
      getOrCreateVolume(client, "fleet-pi-ws-u1", { sleep })
    ).rejects.toThrow(/not usable \(state: error\)/)
    expect(sleep).not.toHaveBeenCalled()
  })
})
