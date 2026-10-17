export class WranglerPreviewJsonError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "WranglerPreviewJsonError"
  }
}

function firstUrlIn(urls: unknown): string | undefined {
  if (!Array.isArray(urls)) return undefined
  for (const value of urls) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim().replace(/\/$/, "")
    }
  }
  return undefined
}

function previewUrlsFromPayload(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined
  const preview = (payload as { preview?: unknown }).preview
  if (preview && typeof preview === "object") {
    return firstUrlIn((preview as { urls?: unknown }).urls)
  }
  return undefined
}

export function parsePreviewDeployJson(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined
  const record = payload as Record<string, unknown>
  const candidates = [
    record.preview_url,
    record.url,
    record.deployment_url,
    record.latest_url,
  ]
  for (const value of candidates) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim().replace(/\/$/, "")
    }
  }

  const fromPreview = previewUrlsFromPayload(payload)
  if (fromPreview) return fromPreview

  const deployment = record.deployment
  if (deployment && typeof deployment === "object") {
    return firstUrlIn((deployment as { urls?: unknown }).urls)
  }

  return undefined
}

/**
 * Wrangler `--json` may print progress lines before the JSON object.
 * Prefer the last parseable object that carries `preview.urls`.
 */
export function parseWranglerJsonOutput(raw: string): unknown {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new WranglerPreviewJsonError(
      "wrangler --json output was empty; expected a preview deploy payload."
    )
  }

  try {
    const direct = JSON.parse(trimmed) as unknown
    if (parsePreviewDeployJson(direct)) return direct
  } catch {
    // Fall through and scan for embedded JSON.
  }

  let lastWithPreviewUrls: unknown
  let lastWithAnyUrl: unknown
  let index = 0
  while (index < trimmed.length) {
    const start = trimmed.indexOf("{", index)
    if (start < 0) break
    try {
      const payload = JSON.parse(trimmed.slice(start)) as unknown
      if (previewUrlsFromPayload(payload)) {
        lastWithPreviewUrls = payload
      } else if (parsePreviewDeployJson(payload)) {
        lastWithAnyUrl = payload
      }
    } catch {
      // Try the next object start.
    }
    index = start + 1
  }

  if (lastWithPreviewUrls) return lastWithPreviewUrls
  if (lastWithAnyUrl) return lastWithAnyUrl

  throw new WranglerPreviewJsonError(
    "Could not parse wrangler preview --json output (progress text before JSON)."
  )
}
