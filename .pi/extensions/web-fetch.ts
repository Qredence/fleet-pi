import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import { Type } from "typebox"

const DEFAULT_MAX_BYTES = 100_000
const FETCH_TIMEOUT_MS = 15_000

const GITHUB_BLOB_RE =
  /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/

export default function webFetchExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "web_fetch",
    label: "Web Fetch",
    description:
      "Fetch the contents of a URL and return it as text. GitHub blob URLs are automatically rewritten to raw content URLs. Only text responses are returned; binary content is rejected.",
    promptSnippet: "web_fetch: fetch a URL and return its text content",
    parameters: Type.Object({
      url: Type.String({
        description: "URL to fetch",
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

      const timeoutSignal = AbortSignal.timeout(FETCH_TIMEOUT_MS)
      const combinedSignal = signal
        ? AbortSignal.any([signal, timeoutSignal])
        : timeoutSignal

      let response: Response
      try {
        response = await fetch(rawUrl, {
          signal: combinedSignal,
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

      const buffer = await response.arrayBuffer()
      const bytes = buffer.byteLength
      const truncated = bytes > limit
      const slice = truncated ? buffer.slice(0, limit) : buffer
      const text = new TextDecoder("utf-8", { fatal: false }).decode(slice)
      const body = truncated
        ? `${text}\n\n[Truncated: showed ${limit} of ${bytes} bytes]`
        : text

      return {
        content: [{ type: "text" as const, text: body }],
        details: {
          url: params.url,
          finalUrl: rawUrl,
          contentType,
          bytes,
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
