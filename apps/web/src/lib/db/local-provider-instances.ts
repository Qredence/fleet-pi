import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import {
  allocateProviderId,
  isPiCustomProviderApi,
  normalizeCustomProviderInstance,
  toInstanceSlug,
} from "@workspace/pi-protocol/provider-catalog"
import { isChatDatabaseConfigured } from "./chat-db-config"
import type { PiCustomProviderApi } from "@workspace/pi-protocol/chat-protocol"
import type { OccInstance, OccInstanceInput } from "./occ-instances"
import { resolveAppRuntimeContext } from "@/lib/app-runtime"
import { writeFileAtomic } from "@/lib/fs-atomic"
import { isDeployedChatRuntimeSurface } from "@/lib/pi/runtime/deployed-chat-runtime"

const PROVIDER_STORE_VERSION = 1 as const

/**
 * A custom provider instance in the local dev file store. Mirrors the
 * Postgres-backed `OccInstance` shape plus the plaintext `apiKey`, matching
 * the `.env.local` convention of keeping local secrets on disk unencrypted.
 */
export type LocalProviderInstance = OccInstance & { apiKey: string }

type ProviderStoreFile = {
  version: typeof PROVIDER_STORE_VERSION
  instances: Array<LocalProviderInstance>
}

/**
 * Resolves the gitignored local provider store path for a project root. One
 * file per account: anonymous local chat shares `providers.anonymous.json`,
 * signed-in local accounts get `providers.user-<hash>.json`, so an anonymous
 * user and a local Better Auth account on the same machine never read each
 * other's instances (or plaintext API keys). `.fleet/` is already gitignored
 * (see root `.gitignore`).
 */
export function localProviderStorePath(
  projectRoot: string,
  userId?: string
): string {
  return join(projectRoot, ".fleet", `providers.${storeScope(userId)}.json`)
}

function storeScope(userId: string | undefined): string {
  return userId ? `user-${userStoreScopeHash(userId)}` : "anonymous"
}

function userStoreScopeHash(userId: string): string {
  return createHash("sha256").update(userId).digest("hex").slice(0, 16)
}

function resolveStorePath(userId?: string): string {
  return localProviderStorePath(resolveAppRuntimeContext().projectRoot, userId)
}

/**
 * Local dev fallback: instances are stored outside Postgres when the chat
 * database is not configured for the account (anonymous local chat, or a
 * local Better Auth sign-in without `FLEET_PI_CHAT_DATABASE_URL`). Never true
 * on Vercel or the Neon Function surface, where the filesystem is ephemeral
 * and `pi_user_providers` is the only durable store.
 *
 * @param userId - The signed-in user's id, or `undefined` for anonymous chat
 * @returns `true` when the local file store should back custom instances
 */
export function useLocalProviderStore(userId: string | undefined): boolean {
  return (
    !isDeployedChatRuntimeSurface() &&
    !(Boolean(userId) && isChatDatabaseConfigured())
  )
}

async function readStore(storePath: string): Promise<ProviderStoreFile> {
  let raw: string
  try {
    raw = await readFile(storePath, "utf8")
  } catch (error) {
    if (isEnoent(error)) {
      return { version: PROVIDER_STORE_VERSION, instances: [] }
    }
    throw error
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (cause) {
    throw new Error(`Malformed local provider store at ${storePath}`, { cause })
  }
  if (!isProviderStoreFile(parsed)) {
    throw new Error(`Malformed local provider store at ${storePath}`)
  }
  return parsed
}

function toMetaOnly(instance: LocalProviderInstance): OccInstance {
  return {
    id: instance.id,
    displayName: instance.displayName,
    baseUrl: instance.baseUrl,
    modelId: instance.modelId,
    api: instance.api,
    modelIds: instance.modelIds,
  }
}

/**
 * Lists the metadata of every custom provider instance configured in the local
 * dev store for an account. Mirrors `listOccInstances` (no apiKey); the key is
 * loaded separately via {@link loadLocalProviderInstanceApiKey}.
 *
 * @param userId - The account, or `undefined` for anonymous local chat
 * @returns The stored instances without their apiKey, or `[]` when the store does not exist
 */
export async function listLocalProviderInstances(
  userId?: string
): Promise<Array<OccInstance>> {
  return (await readStore(resolveStorePath(userId))).instances.map(toMetaOnly)
}

/**
 * Lists every custom provider instance together with its stored apiKey for an
 * account. Mirrors `listOccInstancesWithApiKey`: used by the Settings
 * providers list so it does not re-read the store per instance.
 *
 * @param userId - The account, or `undefined` for anonymous local chat
 * @returns The stored instances (with plaintext apiKey), or `[]` when the store does not exist
 */
export async function listLocalProviderInstancesWithApiKey(
  userId?: string
): Promise<Array<LocalProviderInstance>> {
  return (await readStore(resolveStorePath(userId))).instances
}

/**
 * Retrieves a custom provider instance's metadata from the local dev store.
 *
 * @param userId - The account, or `undefined` for anonymous local chat
 * @param id - The provider id (`custom+<slug>` or `openai-chat-completions+<slug>`)
 * @returns The matching instance without its apiKey, or `null` when it is not stored
 */
export async function getLocalProviderInstance(
  userId: string | undefined,
  id: string
): Promise<OccInstance | null> {
  const instances = await listLocalProviderInstances(userId)
  return instances.find((instance) => instance.id === id) ?? null
}

/**
 * Loads the stored apiKey for a custom provider instance.
 *
 * @param userId - The account, or `undefined` for anonymous local chat
 * @param id - The provider id
 * @returns The apiKey, or `undefined` when the instance is not stored
 */
export async function loadLocalProviderInstanceApiKey(
  userId: string | undefined,
  id: string
): Promise<string | undefined> {
  const instances = await listLocalProviderInstancesWithApiKey(userId)
  return instances.find((instance) => instance.id === id)?.apiKey
}

/**
 * Per-process in-flight mutex so concurrent read-modify-write cycles on the
 * store file (e.g. parallel POST/DELETE) cannot lose an update to a stale
 * base snapshot. The DB path needs no equivalent because `pi_user_providers`
 * upserts are atomic in Postgres.
 */
let writeQueue: Promise<unknown> = Promise.resolve()

function withStoreLock<T>(operation: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(operation, operation)
  writeQueue = run.catch(() => undefined)
  return run
}

/**
 * Stores or updates a custom provider instance and its apiKey in the local dev
 * store. Callers updating an existing id in place use this; brand-new
 * instances go through {@link createLocalProviderInstance} so id allocation
 * and the write happen under the same lock.
 *
 * @param userId - The account, or `undefined` for anonymous local chat
 * @param instance - The instance metadata to store
 * @param apiKey - The api key used to authenticate with the instance
 */
export async function upsertLocalProviderInstance(
  userId: string | undefined,
  instance: OccInstanceInput,
  apiKey: string
): Promise<void> {
  await withStoreLock(async () => {
    const storePath = resolveStorePath(userId)
    const store = await readStore(storePath)
    const normalized = normalizeCustomProviderInstance(instance)
    const modelId = requireFirstModelId(normalized.modelIds, instance.id)
    const row: LocalProviderInstance = {
      id: instance.id,
      displayName: instance.displayName,
      baseUrl: instance.baseUrl,
      modelId,
      api: normalized.api,
      modelIds: normalized.modelIds,
      apiKey,
    }
    const existingIndex = store.instances.findIndex(
      (entry) => entry.id === instance.id
    )
    if (existingIndex >= 0) {
      store.instances[existingIndex] = row
    } else {
      store.instances.push(row)
    }
    await writeStore(storePath, store)
  })
}

/**
 * Atomically allocates an available provider id and stores the new instance in
 * the local dev store. Allocation + write share one lock, so two concurrent
 * creates cannot both claim the same id from the same base snapshot.
 *
 * @param userId - The account, or `undefined` for anonymous local chat
 * @param input - The new instance's display name, base URL, API family, and models
 * @param toId - A function that builds the provider id from a slug
 * @param apiKey - The api key used to authenticate with the instance
 * @returns The allocated provider id
 */
export async function createLocalProviderInstance(
  userId: string | undefined,
  input: {
    displayName: string
    baseUrl: string
    api?: PiCustomProviderApi
    modelIds?: Array<string>
  },
  toId: (slug: string) => string,
  apiKey: string
): Promise<string> {
  return withStoreLock(async () => {
    const storePath = resolveStorePath(userId)
    const store = await readStore(storePath)
    const baseSlug = toInstanceSlug(input.displayName)
    const id = allocateProviderId(
      baseSlug,
      new Set(store.instances.map((entry) => entry.id)),
      toId
    )
    const normalized = normalizeCustomProviderInstance(input)
    const modelId = requireFirstModelId(normalized.modelIds, id)
    store.instances.push({
      id,
      displayName: input.displayName,
      baseUrl: input.baseUrl,
      modelId,
      api: normalized.api,
      modelIds: normalized.modelIds,
      apiKey,
    })
    await writeStore(storePath, store)
    return id
  })
}

/**
 * Removes a custom provider instance from the local dev store.
 *
 * @param userId - The account, or `undefined` for anonymous local chat
 * @param id - The provider id to remove
 */
export async function removeLocalProviderInstance(
  userId: string | undefined,
  id: string
): Promise<void> {
  await withStoreLock(async () => {
    const storePath = resolveStorePath(userId)
    const store = await readStore(storePath)
    const next = store.instances.filter((entry) => entry.id !== id)
    if (next.length === store.instances.length) return
    await writeStore(storePath, { ...store, instances: next })
  })
}

/**
 * Allocates an available custom provider id for a display name from the local
 * dev store, appending `-2`, `-3`, … or a timestamp suffix on collisions.
 *
 * @param userId - The account, or `undefined` for anonymous local chat
 * @param displayName - The display name used to derive the provider id
 * @param toId - A function that builds the provider id from a slug
 * @returns A unique provider id
 */
export async function allocateLocalInstanceId(
  userId: string | undefined,
  displayName: string,
  toId: (slug: string) => string
): Promise<string> {
  return withStoreLock(async () => {
    const baseSlug = toInstanceSlug(displayName)
    const existing = new Set(
      (await readStore(resolveStorePath(userId))).instances.map(
        (entry) => entry.id
      )
    )
    return allocateProviderId(baseSlug, existing, toId)
  })
}

/**
 * Rejects a write that carries no model ids. `OccInstance.modelId` is a
 * required string; persisting `modelIds[0]` of an empty list would write
 * `modelId: undefined`, which `JSON.stringify` drops, permanently failing
 * {@link isLocalProviderInstance} on every later read of the store.
 */
function requireFirstModelId(modelIds: Array<string>, id: string): string {
  const modelId = modelIds[0]
  if (!modelId) {
    throw new Error(
      `Custom provider instance "${id}" has no models configured; at least one model id is required`
    )
  }
  return modelId
}

async function writeStore(storePath: string, store: ProviderStoreFile) {
  await writeFileAtomic(storePath, `${JSON.stringify(store, null, 2)}\n`)
}

function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  )
}

function isProviderStoreFile(value: unknown): value is ProviderStoreFile {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Partial<ProviderStoreFile>
  return (
    candidate.version === PROVIDER_STORE_VERSION &&
    Array.isArray(candidate.instances) &&
    candidate.instances.every(isLocalProviderInstance)
  )
}

function isLocalProviderInstance(
  value: unknown
): value is LocalProviderInstance {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Partial<LocalProviderInstance>
  return (
    typeof candidate.id === "string" &&
    typeof candidate.displayName === "string" &&
    typeof candidate.baseUrl === "string" &&
    typeof candidate.modelId === "string" &&
    typeof candidate.apiKey === "string" &&
    (candidate.api === undefined || isPiCustomProviderApi(candidate.api)) &&
    // Optional, matching `OccInstance.modelIds`: legacy or hand-edited rows
    // may carry only `modelId`; readers fall back to `[modelId]`.
    (candidate.modelIds === undefined ||
      (Array.isArray(candidate.modelIds) &&
        candidate.modelIds.every((model) => typeof model === "string")))
  )
}
