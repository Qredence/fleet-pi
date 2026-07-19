import {
  OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID,
  OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID,
  OPENAI_CHAT_COMPLETIONS_PROVIDER_ID,
} from "@workspace/pi-protocol/provider-catalog"
import { resolveUserProviderSecret } from "./user-provider-secrets"
import type {
  AgentSessionServices,
  ProviderConfig,
} from "@earendil-works/pi-coding-agent"
import { isEnvVarConfigured } from "@/lib/env-manager"

const PROVIDER_ID = OPENAI_CHAT_COMPLETIONS_PROVIDER_ID
const BASE_URL_ENV_VAR = "OPENAI_CHAT_COMPLETIONS_BASE_URL"
const MODEL_ENV_VAR = "OPENAI_CHAT_COMPLETIONS_MODEL"

type OpenAiChatCompletionsConfig = {
  apiKey: string
  baseUrl: string
  modelId: string
}

type RegisteredModels = NonNullable<ProviderConfig["models"]>

export function normalizeOpenAiCompatibleBaseUrl(baseUrl: string) {
  return (
    baseUrl
      .trim()
      .replace(/\/+$/, "")
      // Accept pasted chat-completions URLs (OpenCode Zen / OpenAI-compatible).
      .replace(/\/chat\/completions$/i, "")
      .replace(/\/v1\/completions$/i, "/v1")
  )
}

/**
 * Normalize + harden an OpenAI-compatible base URL before persistence or fetch.
 * Blocks private/link-local/metadata targets to reduce SSRF risk when the
 * server later calls `{baseUrl}/models` with the stored API key.
 */
export function assertSafeOpenAiCompatibleBaseUrl(baseUrl: string): string {
  const normalized = normalizeOpenAiCompatibleBaseUrl(baseUrl)
  let parsed: URL
  try {
    parsed = new URL(normalized)
  } catch {
    throw new Error("Invalid OpenAI Chat Completions base URL.")
  }

  const allowLocalHttp = process.env.VERCEL !== "1"
  if (parsed.protocol === "https:") {
    // allowed
  } else if (
    parsed.protocol === "http:" &&
    allowLocalHttp &&
    isLoopbackHostname(parsed.hostname)
  ) {
    // local-dev only
  } else {
    throw new Error(
      "OpenAI Chat Completions base URL must use https (http://localhost is allowed in local dev only)."
    )
  }

  if (isBlockedHostname(parsed.hostname)) {
    throw new Error("OpenAI Chat Completions base URL host is not allowed.")
  }

  return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "")
}

function isLoopbackHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "")
  return host === "localhost" || host === "127.0.0.1" || host === "::1"
}

function isBlockedHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "")
  if (
    host === "metadata.google.internal" ||
    host === "metadata" ||
    host.endsWith(".internal") ||
    host === "0.0.0.0" ||
    host === "::"
  ) {
    return true
  }

  // On Vercel (and generally for non-loopback), block private / link-local.
  if (isLoopbackHostname(host) && process.env.VERCEL !== "1") {
    return false
  }

  return isPrivateOrLinkLocalHost(host)
}

function isPrivateOrLinkLocalHost(host: string) {
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return true
  }

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (ipv4) {
    const octets = ipv4.slice(1).map(Number)
    if (octets.some((part) => part > 255)) return true
    const [a, b] = octets
    if (a === 10) return true
    if (a === 127) return true
    if (a === 0) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
    return false
  }

  // IPv6 unique-local / link-local
  if (
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host.startsWith("fe80")
  ) {
    return true
  }

  return false
}

function buildModelEntry(modelId: string): RegisteredModels[number] {
  return {
    id: modelId,
    name: modelId,
    api: "openai-completions" as const,
    reasoning: false,
    input: ["text" as const],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 32_000,
    compat: {
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
      supportsStore: false,
      maxTokensField: "max_tokens" as const,
    },
  }
}

export async function discoverOpenAiChatCompletionsModels(
  userId: string | undefined
): Promise<Array<{ id: string; name: string }>> {
  const config = await resolveOpenAiChatCompletionsConfig(userId)
  if (!config) return []

  // OpenCode Zen (and similar gateways) may advertise many models on /models.
  // Fleet Pi only exposes the explicitly configured model id for this provider.
  return [{ id: config.modelId, name: config.modelId }]
}

export async function resolveOpenAiChatCompletionsConfig(
  userId: string | undefined
): Promise<OpenAiChatCompletionsConfig | undefined> {
  const apiKey = await resolveUserProviderSecret(userId, PROVIDER_ID)
  if (!apiKey) return undefined

  const fromUserStore = await resolveUserProviderSecret(
    userId,
    OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID
  )
  const baseUrl =
    fromUserStore ??
    (isEnvVarConfigured(BASE_URL_ENV_VAR)
      ? process.env[BASE_URL_ENV_VAR]
      : undefined)

  if (!baseUrl?.trim()) return undefined

  const modelFromStore = await resolveUserProviderSecret(
    userId,
    OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID
  )
  const modelId =
    modelFromStore ??
    (isEnvVarConfigured(MODEL_ENV_VAR) ? process.env[MODEL_ENV_VAR] : undefined)

  if (!modelId?.trim()) return undefined

  let safeBaseUrl: string
  try {
    safeBaseUrl = assertSafeOpenAiCompatibleBaseUrl(baseUrl)
  } catch {
    return undefined
  }

  return {
    apiKey,
    baseUrl: safeBaseUrl,
    modelId: modelId.trim(),
  }
}

export async function registerOpenAiChatCompletionsProvider(
  services: AgentSessionServices,
  userId: string | undefined
) {
  const { modelRuntime } = services

  const config = await resolveOpenAiChatCompletionsConfig(userId)
  if (!config) {
    modelRuntime.unregisterProvider(PROVIDER_ID)
    // Do not delete shared process.env — other sessions may still rely on it.
    return
  }

  const models: RegisteredModels = [buildModelEntry(config.modelId)]

  modelRuntime.registerProvider(PROVIDER_ID, {
    name: "OpenAI Chat Completions",
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    api: "openai-completions",
    models,
  })
}
