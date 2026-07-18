import { createHash } from "node:crypto"
import {
  KNOWN_PROVIDERS,
  OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID,
  OPENAI_CHAT_COMPLETIONS_PROVIDER_ID,
} from "@workspace/pi-protocol/provider-catalog"
import {
  daytonaSecretName,
  isDaytonaSecretsEligibleProvider,
  resolveDaytonaSecretHosts,
} from "./secret-hosts"
import type { Daytona, Secret } from "@daytona/sdk"

export type DaytonaSecretsSyncMode = "mounted" | "plaintext-fallback"

export type DaytonaSecretsSyncResult = {
  /** env var name → Daytona secret name (for createSandbox `secrets`) */
  secrets: Record<string, string>
  /** Host-side fingerprint of Secrets-backed values (never sent to Daytona). */
  fingerprint: string
  /** Whether org Secrets were mounted vs plaintext-only sandbox injection. */
  mode: DaytonaSecretsSyncMode
}

/**
 * Host-side fingerprint of Secrets-eligible configured values (no API calls).
 */
export function fingerprintDaytonaSecretsConfig(
  configured: Map<string, string>
): string {
  const occBaseUrl = configured.get(
    OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID
  )
  const fingerprintParts: Array<string> = []

  for (const provider of KNOWN_PROVIDERS) {
    if (!isDaytonaSecretsEligibleProvider(provider, { occBaseUrl })) {
      continue
    }
    const value = configured.get(provider.id)?.trim()
    if (!value) continue
    const hosts = resolveDaytonaSecretHosts(provider.id, { occBaseUrl })
    if (!hosts?.length) continue
    fingerprintParts.push(`${provider.id}:${hashValue(value)}`)
  }

  fingerprintParts.sort()
  return createHash("sha256").update(fingerprintParts.join("|")).digest("hex")
}

/**
 * Upsert Secrets-eligible provider API keys into the user's Daytona org and
 * return the env→secretName map for sandbox create.
 */
export function isDaytonaSecretsApiUnavailableError(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  return (
    normalized.includes("access denied") ||
    normalized.includes("forbidden") ||
    normalized.includes("not authorized") ||
    normalized.includes("permission denied")
  )
}

export async function syncDaytonaSecrets(
  client: Daytona,
  configured: Map<string, string>
): Promise<DaytonaSecretsSyncResult> {
  const fingerprint = fingerprintDaytonaSecretsConfig(configured)

  let existingByName: Map<string, Secret>
  try {
    existingByName = await listSecretsByName(client)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (isDaytonaSecretsApiUnavailableError(message)) {
      return { secrets: {}, fingerprint, mode: "plaintext-fallback" }
    }
    throw error
  }

  const occBaseUrl = configured.get(
    OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID
  )
  const secrets: Record<string, string> = {}

  for (const provider of KNOWN_PROVIDERS) {
    if (!isDaytonaSecretsEligibleProvider(provider, { occBaseUrl })) {
      continue
    }

    const value = configured.get(provider.id)?.trim()
    if (!value) continue

    const hosts = resolveDaytonaSecretHosts(provider.id, { occBaseUrl })
    if (!hosts?.length) continue

    const name = daytonaSecretName(provider.id)
    try {
      await upsertSecret(client, existingByName, {
        name,
        value,
        hosts,
        description: `Fleet Pi ${provider.name} (user BYOK)`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (isDaytonaSecretsApiUnavailableError(message)) {
        return {
          secrets: { ...secrets },
          fingerprint,
          mode:
            Object.keys(secrets).length > 0 ? "mounted" : "plaintext-fallback",
        }
      }
      throw error
    }

    secrets[provider.envVarName] = name
  }

  return {
    secrets,
    fingerprint,
    mode: Object.keys(secrets).length > 0 ? "mounted" : "plaintext-fallback",
  }
}

async function listSecretsByName(
  client: Daytona
): Promise<Map<string, Secret>> {
  const byName = new Map<string, Secret>()
  let cursor: string | undefined

  do {
    const page = await client.secret.list({ cursor, limit: 100 })
    for (const secret of page.items) {
      byName.set(secret.name, secret)
    }
    cursor = page.nextCursor ?? undefined
  } while (cursor)

  return byName
}

async function upsertSecret(
  client: Daytona,
  existingByName: Map<string, Secret>,
  params: {
    name: string
    value: string
    hosts: Array<string>
    description: string
  }
): Promise<void> {
  const existing = existingByName.get(params.name)
  if (!existing) {
    const created = await client.secret.create({
      name: params.name,
      value: params.value,
      hosts: params.hosts,
      description: params.description,
    })
    existingByName.set(created.name, created)
    return
  }

  // Always update value + hosts so credential saves and allowlist drift apply.
  // Daytona never returns plaintext, so we cannot short-circuit on equality.
  const updated = await client.secret.update(existing.id, {
    value: params.value,
    hosts: params.hosts,
    description: params.description,
  })
  existingByName.set(updated.name, updated)
}

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

/** True when OCC provider id should use Secrets (exported for tests). */
export function isOccSecretsEligible(configured: Map<string, string>): boolean {
  return isDaytonaSecretsEligibleProvider(
    { id: OPENAI_CHAT_COMPLETIONS_PROVIDER_ID },
    {
      occBaseUrl: configured.get(OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID),
    }
  )
}
