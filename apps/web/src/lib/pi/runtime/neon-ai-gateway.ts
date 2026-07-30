import { assertSafeOpenAiCompatibleBaseUrl } from "./openai-chat-completions-url"
import { isEnvVarConfigured } from "@/lib/env-manager"

/** Curated Neon AI Gateway model IDs (OpenAI-compatible /v1 chat completions). */
export const NEON_AI_GATEWAY_DEFAULT_MODEL_IDS = [
  "qwen35-122b-a10b",
  "gpt-oss-120b",
] as const

export type NeonAiGatewayModelId =
  (typeof NEON_AI_GATEWAY_DEFAULT_MODEL_IDS)[number]

export const NEON_AI_GATEWAY_DEFAULT_MODEL: NeonAiGatewayModelId =
  "qwen35-122b-a10b"

/** Pre-Gateway Fleet Pi OCC defaults — superseded by Neon AI Gateway on deploy. */
export const LEGACY_FLEET_OCC_MODEL_IDS = [
  "deepseek-v4-flash-free",
  "nemotron-3-ultra-free",
] as const

export const NEON_AI_GATEWAY_ENV_VAR_NAMES = [
  "NEON_AI_GATEWAY_TOKEN",
  "NEON_AI_GATEWAY_BASE_URL",
] as const

export function isLegacyFleetOccModelId(modelId: string) {
  return (LEGACY_FLEET_OCC_MODEL_IDS as ReadonlyArray<string>).includes(
    modelId.trim()
  )
}

export function isLegacyFleetOccEnabledModelPattern(pattern: string) {
  const normalized = pattern.trim()
  return LEGACY_FLEET_OCC_MODEL_IDS.some(
    (legacyId) =>
      normalized === legacyId ||
      normalized === `openai-chat-completions/${legacyId}` ||
      normalized.endsWith(`/${legacyId}`)
  )
}

export type NeonAiGatewayConfig = {
  apiKey: string
  baseUrl: string
  modelIds: ReadonlyArray<NeonAiGatewayModelId>
}

/**
 * Process-local Gateway config captured before env scrub so bash/tools cannot
 * read `NEON_AI_GATEWAY_*` while OCC registration still works.
 */
let capturedGatewayConfig: NeonAiGatewayConfig | undefined

function readGatewayEnv(): { apiKey?: string; baseUrl?: string } {
  const apiKey = isEnvVarConfigured("NEON_AI_GATEWAY_TOKEN")
    ? process.env.NEON_AI_GATEWAY_TOKEN!.trim()
    : undefined
  const baseUrl = isEnvVarConfigured("NEON_AI_GATEWAY_BASE_URL")
    ? process.env.NEON_AI_GATEWAY_BASE_URL!.trim()
    : undefined
  return { apiKey, baseUrl }
}

function resolveGatewayConfigFromEnv(): NeonAiGatewayConfig | undefined {
  const { apiKey, baseUrl } = readGatewayEnv()
  if (!apiKey || !baseUrl) return undefined

  let safeBaseUrl: string
  try {
    safeBaseUrl = assertSafeOpenAiCompatibleBaseUrl(`${baseUrl}/v1`)
  } catch {
    return undefined
  }

  return {
    apiKey,
    baseUrl: safeBaseUrl,
    modelIds: NEON_AI_GATEWAY_DEFAULT_MODEL_IDS,
  }
}

/**
 * Snapshot Gateway credentials into process memory, then delete the env vars
 * so agent bash/tools cannot `printenv` the platform token.
 * Call once at session-services boot on deployed chat surfaces.
 */
export function captureAndScrubNeonAiGatewayEnv() {
  const fromEnv = resolveGatewayConfigFromEnv()
  if (fromEnv) {
    capturedGatewayConfig = fromEnv
  }

  for (const envVarName of NEON_AI_GATEWAY_ENV_VAR_NAMES) {
    delete process.env[envVarName]
  }
}

/** Test helper: clear captured credentials between cases. */
export function resetCapturedNeonAiGatewayCredentialsForTests() {
  capturedGatewayConfig = undefined
}

/**
 * Platform Neon AI Gateway credentials for authenticated chat sessions.
 * Not user BYOK — injected from branch-scoped NEON_AI_GATEWAY_* env (or the
 * in-memory capture after env scrub).
 *
 * Manual smoke (after `neon deploy` with preview.aiGateway): send one chat turn
 * per default model (`qwen35-122b-a10b`, `gpt-oss-120b`). Neon may return
 * `message.content` as typed blocks for these models; verify transcripts render.
 */
export function resolveNeonAiGatewayConfig(
  userId: string | undefined
): NeonAiGatewayConfig | undefined {
  if (!userId) return undefined
  return capturedGatewayConfig ?? resolveGatewayConfigFromEnv()
}
