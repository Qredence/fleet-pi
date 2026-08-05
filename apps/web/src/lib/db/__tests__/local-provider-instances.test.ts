import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  CUSTOM_PROVIDER_ID_PREFIX,
  OCC_INSTANCE_ID_PREFIX,
  toCustomProviderId,
  toOccInstanceId,
} from "@workspace/pi-protocol/provider-catalog"
import {
  allocateLocalInstanceId,
  createLocalProviderInstance,
  getLocalProviderInstance,
  listLocalProviderInstances,
  listLocalProviderInstancesWithApiKey,
  loadLocalProviderInstanceApiKey,
  localProviderStorePath,
  removeLocalProviderInstance,
  upsertLocalProviderInstance,
  useLocalProviderStore,
} from "../local-provider-instances"
import type { OccInstance } from "../occ-instances"
import { runWithChatAuthSurface } from "@/lib/auth/chat-auth-surface"

const originalRepoRoot = process.env.FLEET_PI_REPO_ROOT
const originalVercel = process.env.VERCEL
const originalChatUrl = process.env.FLEET_PI_CHAT_DATABASE_URL

let tempRoot: string

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), "fleet-providers-"))
  process.env.FLEET_PI_REPO_ROOT = tempRoot
  delete process.env.VERCEL
  delete process.env.FLEET_PI_CHAT_DATABASE_URL
})

afterEach(() => {
  rmSync(tempRoot, { recursive: true, force: true })
  if (originalRepoRoot === undefined) {
    delete process.env.FLEET_PI_REPO_ROOT
  } else {
    process.env.FLEET_PI_REPO_ROOT = originalRepoRoot
  }
  if (originalVercel === undefined) {
    delete process.env.VERCEL
  } else {
    process.env.VERCEL = originalVercel
  }
  if (originalChatUrl === undefined) {
    delete process.env.FLEET_PI_CHAT_DATABASE_URL
  } else {
    process.env.FLEET_PI_CHAT_DATABASE_URL = originalChatUrl
  }
})

const sampleInstance: OccInstance = {
  id: `${CUSTOM_PROVIDER_ID_PREFIX}my-endpoint`,
  displayName: "My Endpoint",
  baseUrl: "https://api.example.com/v1",
  modelId: "gpt-compatible",
  api: "openai-completions",
  modelIds: ["gpt-compatible"],
}

describe("useLocalProviderStore", () => {
  it("returns true for anonymous local chat (no Vercel, no chat DB)", () => {
    expect(useLocalProviderStore(undefined)).toBe(true)
  })

  it("returns true for a local sign-in without a chat DB", () => {
    expect(useLocalProviderStore("user-1")).toBe(true)
  })

  it("returns false on Vercel even without a chat DB", () => {
    process.env.VERCEL = "1"
    expect(useLocalProviderStore(undefined)).toBe(false)
  })

  it("returns false for a signed-in user with a chat DB", () => {
    process.env.FLEET_PI_CHAT_DATABASE_URL = "postgres://example"
    expect(useLocalProviderStore("user-1")).toBe(false)
  })

  it("returns false on the Neon Function surface even without a chat DB", () => {
    runWithChatAuthSurface("neon-function", () => {
      expect(useLocalProviderStore(undefined)).toBe(false)
      expect(useLocalProviderStore("user-1")).toBe(false)
    })
  })
})

describe("local provider instance store", () => {
  it("starts empty when the store file does not exist", async () => {
    expect(await listLocalProviderInstances()).toEqual([])
    expect(existsSync(localProviderStorePath(tempRoot))).toBe(false)
  })

  it("upserts an instance and lists it back, keys separate from metadata", async () => {
    await upsertLocalProviderInstance(undefined, sampleInstance, "sk-test")

    expect(await listLocalProviderInstances()).toEqual([sampleInstance])
    expect(await listLocalProviderInstancesWithApiKey()).toEqual([
      { ...sampleInstance, apiKey: "sk-test" },
    ])

    expect(
      await loadLocalProviderInstanceApiKey(undefined, sampleInstance.id)
    ).toBe("sk-test")
    expect(
      await getLocalProviderInstance(undefined, sampleInstance.id)
    ).toEqual(sampleInstance)
  })

  it("updates an existing instance in place instead of duplicating it", async () => {
    await upsertLocalProviderInstance(undefined, sampleInstance, "sk-old")
    await upsertLocalProviderInstance(
      undefined,
      {
        ...sampleInstance,
        baseUrl: "https://new.example.com/v1",
        api: "openai-responses",
      },
      "sk-new"
    )

    const instances = await listLocalProviderInstancesWithApiKey()
    expect(instances).toHaveLength(1)
    expect(instances[0]).toMatchObject({
      id: sampleInstance.id,
      baseUrl: "https://new.example.com/v1",
      api: "openai-responses",
      apiKey: "sk-new",
    })
  })

  it("normalizes a legacy single-model instance to modelIds", async () => {
    await upsertLocalProviderInstance(
      undefined,
      {
        id: `${OCC_INSTANCE_ID_PREFIX}legacy`,
        displayName: "Legacy",
        baseUrl: "https://legacy.example.com/v1",
        modelId: "kimi-k2.6",
      },
      "sk-legacy"
    )

    const instances = await listLocalProviderInstances()
    expect(instances[0]).toMatchObject({
      api: "openai-completions",
      modelIds: ["kimi-k2.6"],
    })
  })

  it("rejects writes with no model ids instead of corrupting the store", async () => {
    await upsertLocalProviderInstance(undefined, sampleInstance, "sk-test")

    await expect(
      upsertLocalProviderInstance(
        undefined,
        { ...sampleInstance, modelId: undefined, modelIds: [] },
        "sk-bad"
      )
    ).rejects.toThrow(/no models configured/)
    await expect(
      createLocalProviderInstance(
        undefined,
        {
          displayName: "No Models",
          baseUrl: "https://api.example.com/v1",
          modelIds: [],
        },
        toCustomProviderId,
        "sk-bad"
      )
    ).rejects.toThrow(/no models configured/)

    // The store stays readable and unchanged after the rejected writes.
    expect(await listLocalProviderInstances()).toEqual([sampleInstance])
  })

  it("accepts a stored row without modelIds (legacy/hand-edited store)", async () => {
    const storePath = localProviderStorePath(tempRoot)
    mkdirSync(dirname(storePath), { recursive: true })
    writeFileSync(
      storePath,
      JSON.stringify({
        version: 1,
        instances: [
          {
            id: `${OCC_INSTANCE_ID_PREFIX}legacy`,
            displayName: "Legacy",
            baseUrl: "https://legacy.example.com/v1",
            modelId: "kimi-k2.6",
            apiKey: "sk-legacy",
          },
        ],
      }),
      "utf8"
    )

    const instances = await listLocalProviderInstances()
    expect(instances).toHaveLength(1)
    expect(instances[0]).toMatchObject({
      id: `${OCC_INSTANCE_ID_PREFIX}legacy`,
      modelId: "kimi-k2.6",
    })
  })

  it("returns null / undefined for unknown ids", async () => {
    expect(
      await getLocalProviderInstance(undefined, "custom+missing")
    ).toBeNull()
    expect(
      await loadLocalProviderInstanceApiKey(undefined, "custom+missing")
    ).toBeUndefined()
  })

  it("removes an instance and leaves the store empty", async () => {
    await upsertLocalProviderInstance(undefined, sampleInstance, "sk-test")
    await removeLocalProviderInstance(undefined, sampleInstance.id)

    expect(await listLocalProviderInstances()).toEqual([])
  })

  it("treats removing an unknown id as a no-op", async () => {
    await upsertLocalProviderInstance(undefined, sampleInstance, "sk-test")
    await removeLocalProviderInstance(undefined, "custom+missing")

    expect(await listLocalProviderInstances()).toHaveLength(1)
  })

  it("writes the store atomically without leftover temp files", async () => {
    await upsertLocalProviderInstance(undefined, sampleInstance, "sk-test")

    const storeDir = join(tempRoot, ".fleet")
    expect(
      readdirSync(storeDir).filter((name) => name.endsWith(".tmp"))
    ).toEqual([])
    expect(
      JSON.parse(readFileSync(localProviderStorePath(tempRoot), "utf8"))
    ).toMatchObject({
      version: 1,
      instances: [{ ...sampleInstance, apiKey: "sk-test" }],
    })
  })

  it("throws on a malformed store file instead of silently dropping it", async () => {
    const storePath = localProviderStorePath(tempRoot)
    mkdirSync(dirname(storePath), { recursive: true })
    writeFileSync(storePath, "{ not json", "utf8")

    await expect(listLocalProviderInstances()).rejects.toThrow(
      /Malformed local provider store/
    )
  })

  it("keeps anonymous and signed-in accounts in separate store files", async () => {
    await upsertLocalProviderInstance(undefined, sampleInstance, "sk-anon")
    await upsertLocalProviderInstance(
      "user-1",
      { ...sampleInstance, id: `${CUSTOM_PROVIDER_ID_PREFIX}user1` },
      "sk-user1"
    )
    await upsertLocalProviderInstance(
      "user-2",
      { ...sampleInstance, id: `${CUSTOM_PROVIDER_ID_PREFIX}user2` },
      "sk-user2"
    )

    expect(await listLocalProviderInstances(undefined)).toEqual([
      sampleInstance,
    ])
    expect(await listLocalProviderInstances("user-1")).toEqual([
      { ...sampleInstance, id: `${CUSTOM_PROVIDER_ID_PREFIX}user1` },
    ])
    expect(await listLocalProviderInstances("user-2")).toEqual([
      { ...sampleInstance, id: `${CUSTOM_PROVIDER_ID_PREFIX}user2` },
    ])
    expect(
      await loadLocalProviderInstanceApiKey(
        "user-1",
        `${CUSTOM_PROVIDER_ID_PREFIX}user1`
      )
    ).toBe("sk-user1")
    // Account A cannot read account B's (or anonymous's) keys.
    expect(
      await loadLocalProviderInstanceApiKey("user-1", sampleInstance.id)
    ).toBeUndefined()
    expect(existsSync(localProviderStorePath(tempRoot))).toBe(true)
    expect(existsSync(localProviderStorePath(tempRoot, "user-1"))).toBe(true)
  })

  it("allocates and stores a brand-new instance in one atomic step", async () => {
    const id = await createLocalProviderInstance(
      undefined,
      sampleInstance,
      toCustomProviderId,
      "sk-created"
    )

    expect(id).toBe(`${CUSTOM_PROVIDER_ID_PREFIX}my-endpoint`)
    expect(await listLocalProviderInstances()).toEqual([sampleInstance])
    expect(await loadLocalProviderInstanceApiKey(undefined, id)).toBe(
      "sk-created"
    )
  })

  it("serializes concurrent creates so each gets a distinct id", async () => {
    const ids = await Promise.all([
      createLocalProviderInstance(
        undefined,
        sampleInstance,
        toCustomProviderId,
        "sk-1"
      ),
      createLocalProviderInstance(
        undefined,
        sampleInstance,
        toCustomProviderId,
        "sk-2"
      ),
    ])

    expect(new Set(ids).size).toBe(2)
    expect(ids).toContain(`${CUSTOM_PROVIDER_ID_PREFIX}my-endpoint`)
    expect(ids).toContain(`${CUSTOM_PROVIDER_ID_PREFIX}my-endpoint-2`)
    expect(await listLocalProviderInstances()).toHaveLength(2)
  })
})

describe("allocateLocalInstanceId", () => {
  it("allocates the base custom id from the display name", async () => {
    expect(
      await allocateLocalInstanceId(
        undefined,
        "My Endpoint",
        toCustomProviderId
      )
    ).toBe(`${CUSTOM_PROVIDER_ID_PREFIX}my-endpoint`)
  })

  it("allocates an occ-namespaced id via the occ toId", async () => {
    expect(
      await allocateLocalInstanceId(undefined, "My Endpoint", toOccInstanceId)
    ).toBe(`${OCC_INSTANCE_ID_PREFIX}my-endpoint`)
  })

  it("appends -2, -3 on collisions with existing instances", async () => {
    await upsertLocalProviderInstance(undefined, sampleInstance, "sk-test")

    expect(
      await allocateLocalInstanceId(
        undefined,
        "My Endpoint",
        toCustomProviderId
      )
    ).toBe(`${CUSTOM_PROVIDER_ID_PREFIX}my-endpoint-2`)
    await upsertLocalProviderInstance(
      undefined,
      { ...sampleInstance, id: `${CUSTOM_PROVIDER_ID_PREFIX}my-endpoint-2` },
      "sk-2"
    )
    expect(
      await allocateLocalInstanceId(
        undefined,
        "My Endpoint",
        toCustomProviderId
      )
    ).toBe(`${CUSTOM_PROVIDER_ID_PREFIX}my-endpoint-3`)
  })
})
