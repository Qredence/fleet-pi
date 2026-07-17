import { describe, expect, it, vi } from "vitest"
import {
  fingerprintDaytonaSecretsConfig,
  isOccSecretsEligible,
  syncDaytonaSecrets,
} from "./sync-daytona-secrets"
import type { Daytona } from "@daytona/sdk"

describe("syncDaytonaSecrets", () => {
  it("fingerprints Secrets-eligible values stably", () => {
    const configured = new Map([
      ["google", "gem-key"],
      ["openai", "oai-key"],
      ["daytona", "ignored"],
    ])
    const a = fingerprintDaytonaSecretsConfig(configured)
    const b = fingerprintDaytonaSecretsConfig(configured)
    expect(a).toBe(b)
    expect(a).toHaveLength(64)
  })

  it("upserts secrets and returns env→name map", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "sec-1",
      name: "fleet_pi_google",
      hosts: ["generativelanguage.googleapis.com"],
    })
    const update = vi.fn()
    const list = vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      nextCursor: null,
    })
    const client = {
      secret: { list, create, update },
    } as unknown as Daytona

    const result = await syncDaytonaSecrets(
      client,
      new Map([["google", "gem-key"]])
    )

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "fleet_pi_google",
        value: "gem-key",
        hosts: ["generativelanguage.googleapis.com"],
      })
    )
    expect(result.secrets).toEqual({ GEMINI_API_KEY: "fleet_pi_google" })
    expect(result.mode).toBe("mounted")
    expect(result.fingerprint).toBe(
      fingerprintDaytonaSecretsConfig(new Map([["google", "gem-key"]]))
    )
  })

  it("returns empty secrets when Secrets API is unavailable", async () => {
    const list = vi.fn().mockRejectedValue(new Error("Access denied"))
    const client = {
      secret: { list, create: vi.fn(), update: vi.fn() },
    } as unknown as Daytona

    const configured = new Map([["google", "gem-key"]])
    const result = await syncDaytonaSecrets(client, configured)

    expect(result.secrets).toEqual({})
    expect(result.mode).toBe("plaintext-fallback")
    expect(result.fingerprint).toBe(fingerprintDaytonaSecretsConfig(configured))
    expect(list).toHaveBeenCalled()
  })

  it("returns partial secrets map when a later upsert is denied", async () => {
    let createCalls = 0
    const create = vi.fn().mockImplementation((params: { name: string }) => {
      createCalls += 1
      if (createCalls === 1) {
        return Promise.resolve({
          id: "sec-1",
          name: params.name,
          hosts: ["api.openai.com"],
        })
      }
      return Promise.reject(new Error("Access denied"))
    })
    const list = vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      nextCursor: null,
    })
    const client = {
      secret: { list, create, update: vi.fn() },
    } as unknown as Daytona

    const configured = new Map([
      ["google", "gem-key"],
      ["openai", "oai-key"],
    ])
    const result = await syncDaytonaSecrets(client, configured)

    expect(result.secrets).toEqual({ OPENAI_API_KEY: "fleet_pi_openai" })
    expect(result.mode).toBe("mounted")
    expect(create).toHaveBeenCalledTimes(2)
  })

  it("updates existing secrets by name", async () => {
    const update = vi.fn().mockResolvedValue({
      id: "sec-1",
      name: "fleet_pi_openai",
      hosts: ["api.openai.com"],
    })
    const list = vi.fn().mockResolvedValue({
      items: [
        {
          id: "sec-1",
          name: "fleet_pi_openai",
          hosts: ["api.openai.com"],
        },
      ],
      total: 1,
      nextCursor: null,
    })
    const client = {
      secret: { list, create: vi.fn(), update },
    } as unknown as Daytona

    await syncDaytonaSecrets(client, new Map([["openai", "new-key"]]))

    expect(update).toHaveBeenCalledWith(
      "sec-1",
      expect.objectContaining({
        value: "new-key",
        hosts: ["api.openai.com"],
      })
    )
  })

  it("treats OCC as eligible only with HTTPS base URL", () => {
    expect(
      isOccSecretsEligible(
        new Map([
          ["openai-chat-completions", "key"],
          ["openai-chat-completions-base-url", "https://api.example.com"],
        ])
      )
    ).toBe(true)
    expect(
      isOccSecretsEligible(new Map([["openai-chat-completions", "key"]]))
    ).toBe(false)
  })
})
