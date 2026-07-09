import { KNOWN_PROVIDERS } from "@workspace/hax-design/lib/pi/provider-catalog"
import type { ChatProviderInfo } from "@workspace/hax-design/lib/pi/chat-protocol"
import type { AgentSessionServices } from "@earendil-works/pi-coding-agent"
import { isEnvVarConfigured } from "@/lib/env-manager"
import { withChatPostgresTransaction } from "@/lib/db/pi-session-mirror"

export async function getProviderConfigStatus(options?: {
  userId?: string
  services?: AgentSessionServices
}): Promise<Array<ChatProviderInfo>> {
  if (process.env.VERCEL === "1") {
    return getVercelProviderConfigStatus(options?.userId)
  }

  return getLocalProviderConfigStatus(options?.services)
}

async function getVercelProviderConfigStatus(userId?: string) {
  if (!userId) {
    return KNOWN_PROVIDERS.map((provider) => ({
      id: provider.id,
      name: provider.name,
      envVarName: provider.envVarName,
      isConfigured: false,
    }))
  }

  const configuredProviderIds = new Set<string>()
  await withChatPostgresTransaction(async (client: any) => {
    const res = await client.query(
      "SELECT provider_id FROM pi_user_providers WHERE user_id = $1",
      [userId]
    )
    for (const row of res.rows) {
      configuredProviderIds.add(row.provider_id)
    }
  }, userId)

  return KNOWN_PROVIDERS.map((provider) => ({
    id: provider.id,
    name: provider.name,
    envVarName: provider.envVarName,
    isConfigured: configuredProviderIds.has(provider.id),
  }))
}

function getLocalProviderConfigStatus(services?: AgentSessionServices) {
  return KNOWN_PROVIDERS.map((provider) => ({
    id: provider.id,
    name: provider.name,
    envVarName: provider.envVarName,
    isConfigured:
      isEnvVarConfigured(provider.envVarName) ||
      hasRuntimeApiKey(services, provider.id),
  }))
}

function hasRuntimeApiKey(
  services: AgentSessionServices | undefined,
  providerId: string
) {
  if (!services) return false

  const authStorage = services.authStorage as {
    getRuntimeApiKey?: (providerId: string) => string | undefined
  }
  const runtimeKey = authStorage.getRuntimeApiKey?.(providerId)
  return typeof runtimeKey === "string" && runtimeKey.length > 0
}
