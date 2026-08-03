import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { OCC_INSTANCE_ID_PREFIX } from "@workspace/pi-protocol/provider-catalog"

import { decryptString, encryptString } from "../../auth/crypto"
import {
  allocateOccInstanceId,
  getOccInstanceById,
  listOccInstances,
  removeOccInstance,
  upsertOccInstance,
} from "../occ-instances"

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }))

vi.mock("../pi-session-mirror", () => ({
  withChatPostgresTransaction: async (
    operation: (client: { query: typeof queryMock }) => Promise<void>,
    _userId?: string
  ) => {
    await operation({ query: queryMock })
  },
}))

const ORIGINAL_ENV = { ...process.env }

const USER = "user-1"
const SECRET = "test-secret"

function encMeta(meta: unknown) {
  return encryptString(JSON.stringify(meta), SECRET)
}

function decMeta(ciphertext: string) {
  return JSON.parse(decryptString(ciphertext, SECRET) ?? "null")
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.FLEET_PI_CHAT_DATABASE_URL = "postgres://example.test/db"
  process.env.BETTER_AUTH_SECRET = SECRET
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe("occ-instances persistence", () => {
  it("upsert and list round-trips a named instance", async () => {
    const instance = {
      id: `${OCC_INSTANCE_ID_PREFIX}nebius`,
      displayName: "Nebius AI",
      baseUrl: "https://api.nebius.com/v1",
      modelId: "deepseek-v3",
    }
    queryMock.mockResolvedValueOnce({ rows: [] })
    await upsertOccInstance(USER, instance, "sk-test-123")

    const [insertSql, insertParams] = queryMock.mock.calls[0] as [
      string,
      Array<unknown>,
    ]
    expect(insertSql).toContain("INSERT INTO pi_user_providers")
    expect(insertSql).toContain("ON CONFLICT (user_id, provider_id)")
    expect(insertParams[0]).toBe(USER)
    expect(insertParams[1]).toBe(instance.id)
    // Metadata payload is ciphertext, not plaintext, and contains no API key;
    // it decrypts back to the meta object.
    const metaCiphertext = insertParams[3] as string
    expect(metaCiphertext).not.toContain("Nebius AI")
    expect(metaCiphertext).not.toContain("deepseek-v3")
    expect(metaCiphertext).not.toContain("sk-test-123")
    expect(decMeta(metaCiphertext)).toEqual({
      displayName: "Nebius AI",
      baseUrl: "https://api.nebius.com/v1",
      api: "openai-completions",
      modelIds: ["deepseek-v3"],
    })

    queryMock.mockResolvedValueOnce({
      rows: [
        {
          provider_id: instance.id,
          encrypted_key: "enc",
          encrypted_payload: insertParams[3],
        },
      ],
    })
    const listed = await listOccInstances(USER)
    expect(listed).toEqual([
      {
        ...instance,
        api: "openai-completions",
        modelIds: ["deepseek-v3"],
      },
    ])
  })

  it("skips rows without instance metadata and ignores non-named ids", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          provider_id: "openai-chat-completions",
          encrypted_key: "e",
          encrypted_payload: encMeta({}),
        },
        {
          provider_id: `${OCC_INSTANCE_ID_PREFIX}zen`,
          encrypted_key: "e",
          encrypted_payload: encMeta({
            displayName: "Zen",
            baseUrl: "https://z",
            modelId: "m",
          }),
        },
      ],
    })

    const listed = await listOccInstances(USER)
    expect(listed).toEqual([
      {
        id: `${OCC_INSTANCE_ID_PREFIX}zen`,
        displayName: "Zen",
        baseUrl: "https://z",
        modelId: "m",
        api: "openai-completions",
        modelIds: ["m"],
      },
    ])
  })

  it("getById returns null when missing and the instance when present", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    expect(
      await getOccInstanceById(USER, `${OCC_INSTANCE_ID_PREFIX}x`)
    ).toBeNull()

    queryMock.mockResolvedValueOnce({
      rows: [
        {
          provider_id: `${OCC_INSTANCE_ID_PREFIX}zen`,
          encrypted_key: "e",
          encrypted_payload: encMeta({
            displayName: "Zen",
            baseUrl: "https://z",
            modelId: "m",
          }),
        },
      ],
    })
    expect(
      await getOccInstanceById(USER, `${OCC_INSTANCE_ID_PREFIX}zen`)
    ).toEqual({
      id: `${OCC_INSTANCE_ID_PREFIX}zen`,
      displayName: "Zen",
      baseUrl: "https://z",
      modelId: "m",
      api: "openai-completions",
      modelIds: ["m"],
    })
  })

  it("allocates a unique id, suffixing on collision", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          provider_id: `${OCC_INSTANCE_ID_PREFIX}zen`,
          encrypted_key: "e",
          encrypted_payload: encMeta({
            displayName: "Zen",
            baseUrl: "https://z",
            modelId: "m",
          }),
        },
      ],
    })
    const first = await allocateOccInstanceId(USER, "Zen")
    expect(first).toBe(`${OCC_INSTANCE_ID_PREFIX}zen-2`)
  })

  it("removes an instance by id", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    await removeOccInstance(USER, `${OCC_INSTANCE_ID_PREFIX}zen`)
    const [sql, params] = queryMock.mock.calls[0] as [string, Array<unknown>]
    expect(sql).toContain("DELETE FROM pi_user_providers")
    expect(params).toEqual([USER, `${OCC_INSTANCE_ID_PREFIX}zen`])
  })

  it("returns no instances when the database is not configured", async () => {
    delete process.env.FLEET_PI_CHAT_DATABASE_URL
    expect(await listOccInstances(USER)).toEqual([])
    expect(
      await getOccInstanceById(USER, `${OCC_INSTANCE_ID_PREFIX}zen`)
    ).toBeNull()
  })
})
