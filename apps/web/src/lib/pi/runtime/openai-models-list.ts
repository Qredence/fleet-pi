import { isGatewayHost } from "./openai-chat-completions-url"
import type { PiCustomProviderApi } from "@workspace/pi-protocol/chat-protocol"

/** Cap a remote catalog so one provider cannot flood the Add models dialog. */
export const MAX_REMOTE_MODELS = 300

export type RemoteOpenAiModel = {
  id: string
  name?: string
  contextWindow?: number
  /** Present when the catalog says which routes can serve the model. */
  endpoints?: Array<string>
  supportedGenerationMethods?: Array<string>
}

const CHAT_COMPLETIONS_ENDPOINT = "/chat/completions"
const RESPONSES_ENDPOINT = "/responses"
const MESSAGES_ENDPOINT = "/messages"

/**
 * Route a Pi API family to the OpenAI-style `supported_endpoints` value.
 * Google GenAI catalogs are not OpenAI model lists.
 */
export function providerApiEndpoint(
  api: PiCustomProviderApi
): string | undefined {
  switch (api) {
    case "openai-completions":
      return CHAT_COMPLETIONS_ENDPOINT
    case "openai-responses":
      return RESPONSES_ENDPOINT
    case "anthropic-messages":
      return MESSAGES_ENDPOINT
    case "google-genai":
      return undefined
    default: {
      const exhaustive: never = api
      return exhaustive
    }
  }
}

/**
 * Whether a remote model can be called with this provider's wire.
 * Catalogs that omit `supported_endpoints` (plain OpenAI `/models`) stay
 * listed. Catalogs that declare routes, such as Command Code, are filtered
 * so a Claude model is not offered on Chat Completions, where it 400s.
 */
export function modelSupportsProviderApi(
  model: RemoteOpenAiModel,
  api: PiCustomProviderApi
): boolean {
  if (api === "google-genai") {
    return (
      model.supportedGenerationMethods === undefined ||
      model.supportedGenerationMethods.includes("generateContent")
    )
  }
  const endpoint = providerApiEndpoint(api)
  if (!endpoint) return false
  if (!model.endpoints || model.endpoints.length === 0) return true
  return model.endpoints.includes(endpoint)
}

/**
 * Parse an OpenAI-style `{ data: [...] }` or `{ models: [...] }` payload.
 * Keeps display names and `supported_endpoints` when the host sends them.
 */
export function parseOpenAiModelsList(
  payload: unknown
): Array<RemoteOpenAiModel> {
  const rows = rowsFrom(payload)
  const models: Array<RemoteOpenAiModel> = []
  const seen = new Set<string>()
  for (const row of rows) {
    if (models.length >= MAX_REMOTE_MODELS) break
    const model = parseModelRow(row)
    if (!model || seen.has(model.id)) continue
    seen.add(model.id)
    models.push(model)
  }
  return models
}

/**
 * GET `{baseUrl}/models` with the stored key. Neon AI Gateway hosts are
 * skipped so a refresh cannot ingest the platform catalog.
 */
export async function listOpenAiCompatibleModels(
  baseUrl: string,
  apiKey: string,
  api: PiCustomProviderApi = "openai-completions"
): Promise<Array<RemoteOpenAiModel>> {
  if (isGatewayHost(baseUrl)) return []
  const url = `${baseUrl.replace(/\/+$/, "")}/models`
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(api === "anthropic-messages"
        ? {
            "anthropic-version": "2023-06-01",
            "x-api-key": apiKey,
            "content-type": "application/json",
          }
        : {}),
    },
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) {
    throw new Error(`Model list request failed (${response.status}).`)
  }
  return parseOpenAiModelsList(await response.json())
}

function rowsFrom(payload: unknown): Array<unknown> {
  if (!payload || typeof payload !== "object") return []
  const record = payload as Record<string, unknown>
  if (Array.isArray(record.data)) return record.data
  if (Array.isArray(record.models)) return record.models
  return []
}

function parseModelRow(row: unknown): RemoteOpenAiModel | undefined {
  if (typeof row === "string") {
    const id = row.trim()
    return id && id.length <= 4096 ? { id } : undefined
  }
  if (!row || typeof row !== "object") return undefined
  const record = row as Record<string, unknown>
  const rawId = typeof record.id === "string" ? record.id : record.name
  if (typeof rawId !== "string") return undefined
  const id = rawId.trim()
  if (!id || id.length > 4096) return undefined
  const displayName =
    typeof record.name === "string" ? record.name.trim() : undefined
  const contextWindow = finiteNumber(
    record.context_length ?? record.contextWindow
  )
  const endpoints = Array.isArray(record.supported_endpoints)
    ? record.supported_endpoints.filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0
      )
    : undefined
  return {
    id,
    ...(displayName && displayName !== id ? { name: displayName } : {}),
    ...(contextWindow !== undefined ? { contextWindow } : {}),
    ...(endpoints && endpoints.length > 0 ? { endpoints } : {}),
  }
}

/**
 * GET `{baseUrl}/models` for a Google GenAI-compatible host.
 * Ids drop the `models/` prefix Gemini returns.
 */
export async function listGoogleGenaiModels(
  baseUrl: string,
  apiKey: string
): Promise<Array<RemoteOpenAiModel>> {
  const url = `${baseUrl.replace(/\/+$/, "")}/models`
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "x-goog-api-key": apiKey,
    },
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) {
    throw new Error(`Model list request failed (${response.status}).`)
  }
  return parseGoogleGenaiModelsList(await response.json())
}

export function parseGoogleGenaiModelsList(
  payload: unknown
): Array<RemoteOpenAiModel> {
  if (!payload || typeof payload !== "object") return []
  const rows = (payload as { models?: unknown }).models
  if (!Array.isArray(rows)) return []
  const models: Array<RemoteOpenAiModel> = []
  const seen = new Set<string>()
  for (const row of rows) {
    if (models.length >= MAX_REMOTE_MODELS) break
    if (!row || typeof row !== "object") continue
    const record = row as Record<string, unknown>
    const rawName = typeof record.name === "string" ? record.name : ""
    const id = rawName.replace(/^models\//, "").trim()
    if (!id || id.length > 4096 || seen.has(id)) continue
    seen.add(id)
    const displayName =
      typeof record.displayName === "string"
        ? record.displayName.trim()
        : undefined
    const contextWindow = finiteNumber(record.inputTokenLimit)
    const supportedGenerationMethods = Array.isArray(
      record.supportedGenerationMethods
    )
      ? record.supportedGenerationMethods.filter(
          (method): method is string => typeof method === "string"
        )
      : undefined
    models.push({
      id,
      ...(displayName && displayName !== id ? { name: displayName } : {}),
      ...(contextWindow !== undefined ? { contextWindow } : {}),
      ...(supportedGenerationMethods !== undefined
        ? { supportedGenerationMethods }
        : {}),
    })
  }
  return models
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}
