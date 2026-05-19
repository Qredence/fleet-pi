import { describe, expect, it } from "vitest"
import {
  createSandbox,
  createVolumeMount,
  resolveDaytonaConfig,
} from "./client"
import type { Daytona, Sandbox } from "@daytonaio/sdk"

describe("Daytona client", () => {
  it("uses SDK defaults when optional Daytona environment is omitted", () => {
    expect(resolveDaytonaConfig({ DAYTONA_API_KEY: "key" })).toEqual({
      apiKey: "key",
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
        mountPath: "/home/daytona/fleet-pi/agent-workspace",
        subpath: "projects/fleet-pi",
      })
    ).toEqual({
      volumeId: "vol-1",
      mountPath: "/home/daytona/fleet-pi/agent-workspace",
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
          mountPath: "/home/daytona/fleet-pi/agent-workspace",
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
          mountPath: "/home/daytona/fleet-pi/agent-workspace",
        },
      ],
    })
  })
})
