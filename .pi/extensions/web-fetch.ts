import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import { Type } from "typebox"
import { validatePublicHttpsUrl } from "./lib/url-security"

const DEFAULT_MAX_BYTES = 100_000
const FETCH_TIMEOUT_MS = 15_000

const GITHUB_BLOB_RE =
  /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/
export default function webFetchExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "web_fetch",
    label: "Web Fetch",
    description:
      "Fetch the contents of a public HTTPS URL and return it as text. GitHub blob URLs are automatically rewritten to raw content URLs. Only text responses are returned; binary content is rejected. Private/internal network addresses are blocked.",
    promptSnippet: "web_fetch: fetch a URL and return its text content",
    parameters: Type.Object({
      url: Type.String({
        description:
          "HTTPS URL to fetch (http:// is also accepted for GitHub raw URLs)",
      }),
      maxBytes: Type.Optional(
        Type.Number({
          description: `Maximum response bytes to return (default ${DEFAULT_MAX_BYTES})`,
        })
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const limit = params.maxBytes ?? DEFAULT_MAX_BYTES
      const rawUrl = rewriteUrl(params.url)

      try {
        await validatePublicHttpsUrl(rawUrl, "URL", {
          allowExplicitLoopback: true,
        })
      } catch (error) {
        const message =
          error instanceof Error ? error.message : `Invalid URL: ${rawUrl}`
        return {
          content: [{ type: "text" as const, text: `Blocked: ${message}` }],
          details: undefined,
          isError: true,
        }
      }

      const timeoutSignal = AbortSignal.timeout(FETCH_TIMEOUT_MS)
      const combinedSignal = signal
        ? AbortSignal.any([signal, timeoutSignal])
        : timeoutSignal

      let response: Response
      try {
        response = await fetch(rawUrl, {
          signal: combinedSignal,
          redirect: "error",
          headers: { "User-Agent": "fleet-pi-agent/1.0" },
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return {
          content: [{ type: "text" as const, text: `Fetch error: ${message}` }],
          details: undefined,
          isError: true,
        }
      }

      if (!response.ok) {
        return {
          content: [
            {
              type: "text" as const,
              text: `HTTP ${response.status} ${response.statusText}: ${rawUrl}`,
            },
          ],
          details: undefined,
          isError: true,
        }
      }

      const contentType = response.headers.get("content-type") ?? ""
      if (!isTextContentType(contentType)) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Rejected: content-type "${contentType}" is not text. Only text/* and application/json are supported.`,
            },
          ],
          details: undefined,
          isError: true,
        }
      }

      // Check content-length header early to avoid streaming a huge body
      const contentLength = response.headers.get("content-length")
      if (contentLength !== null) {
        const declaredBytes = parseInt(contentLength, 10)
        if (!isNaN(declaredBytes) && declaredBytes > limit * 10) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Rejected: content-length ${declaredBytes} exceeds maximum allowed size.`,
              },
            ],
            details: undefined,
            isError: true,
          }
        }
      }

      // Stream body and stop once limit is reached
      const chunks: Array<Uint8Array> = []
      let totalBytes = 0
      let truncated = false

      if (response.body) {
        const reader = response.body.getReader()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            if (value) {
              const remaining = limit - totalBytes
              if (value.byteLength > remaining) {
                chunks.push(value.slice(0, remaining))
                totalBytes += remaining
                truncated = true
                reader.cancel().catch(() => undefined)
                break
              }
              chunks.push(value)
              totalBytes += value.byteLength
            }
          }
        } catch {
          // partial read is fine — decode what we have
        }
      }

      const combined = new Uint8Array(totalBytes)
      let offset = 0
      for (const chunk of chunks) {
        combined.set(chunk, offset)
        offset += chunk.byteLength
      }
      const text = new TextDecoder("utf-8", { fatal: false }).decode(combined)
      const body = truncated
        ? `${text}\n\n[Truncated: showed ${limit} of ${totalBytes}+ bytes]`
        : text

      return {
        content: [{ type: "text" as const, text: body }],
        details: {
          url: params.url,
          finalUrl: response.url || rawUrl,
          contentType,
          bytes: totalBytes,
          truncated,
        },
      }
    },
  })
}

function rewriteUrl(url: string): string {
  const match = url.match(GITHUB_BLOB_RE)
  if (match) {
    const [, owner, repo, branch, path] = match
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`
  }
  return url
}

function isTextContentType(contentType: string): boolean {
  const base = contentType.split(";")[0].trim().toLowerCase()
  return base.startsWith("text/") || base === "application/json"
}
