import { createHash } from "node:crypto"
import {
  KNOWN_PROVIDERS,
  LLM_PROVIDER_ENV_SCRUB_IDS,
} from "@workspace/hax-design/lib/pi/provider-catalog"
import { loadDecryptedUserProviderSecrets } from "../db/user-providers"
import { isEnvVarConfigured } from "../env-manager"
import { fingerprintProviderSecrets } from "./sandbox-prepare"
import type { PiAuthFile, SandboxProviderSecrets } from "./sandbox-prepare"

export type { PiAuthFile, SandboxProviderSecrets }

export async function loadSandboxProviderSecrets(
  userId: string | undefined
): Promise<SandboxProviderSecrets> {
  const configured = await loadAllProviderSecrets(userId)
  const envVars: Record<string, string> = {}
  const authJson: PiAuthFile = {}

  for (const provider of KNOWN_PROVIDERS) {
    if (INFRA_PROVIDER_IDS.has(provider.id)) continue

    const secret = configured.get(provider.id)
    if (!secret) continue

    if (provider.authType === "oauth") {
      try {
        const credentials = JSON.parse(secret) as unknown
        authJson[provider.id] = { type: "oauth", credentials }
      } catch {
        authJson[provider.id] = {
          type: "oauth",
          credentials: { token: secret },
        }
      }
      continue
    }

    envVars[provider.envVarName] = secret
    authJson[provider.id] = { type: "api_key", key: secret }
  }

  const payload = { envVars, authJson }
  return {
    ...payload,
    fingerprint: fingerprintProviderSecrets(payload),
  }
}

async function loadAllProviderSecrets(
  userId: string | undefined
): Promise<Map<string, string>> {
  if (process.env.VERCEL === "1") {
    if (!userId) return new Map()
    return loadDecryptedUserProviderSecrets(userId)
  }

  const secrets = new Map<string, string>()
  if (userId) {
    const fromDb = await loadDecryptedUserProviderSecrets(userId).catch(
      () => new Map<string, string>()
    )
    for (const [providerId, value] of fromDb) {
      secrets.set(providerId, value)
    }
  }

  for (const providerId of LLM_PROVIDER_ENV_SCRUB_IDS) {
    if (secrets.has(providerId)) continue
    const provider = KNOWN_PROVIDERS.find((entry) => entry.id === providerId)
    if (!provider) continue
    if (isEnvVarConfigured(provider.envVarName)) {
      secrets.set(providerId, process.env[provider.envVarName]!)
    }
  }

  return secrets
}

export function hashOAuthState(payload: Record<string, string>): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex")
}

const INFRA_PROVIDER_IDS = new Set(["daytona", "daytona-target"])
