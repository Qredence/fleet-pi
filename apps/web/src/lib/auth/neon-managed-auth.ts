import { parseCookies } from "better-auth/cookies"
import {
  resolveNeonAuthBaseUrl,
  resolveNeonAuthCookieSecret,
} from "@/lib/auth/auth-mode"

const NEON_AUTH_COOKIE_PREFIX = "__Secure-neon-auth"
const NEON_AUTH_MIDDLEWARE_HEADER = "x-neon-auth-middleware"
const PROXY_REQUEST_HEADERS = [
  "user-agent",
  "authorization",
  "referer",
  "content-type",
] as const
const PROXY_RESPONSE_HEADERS = [
  "content-type",
  "content-length",
  "content-encoding",
  "transfer-encoding",
  "connection",
  "date",
  "set-cookie",
  "set-auth-jwt",
  "set-auth-token",
  "x-neon-ret-request-id",
] as const

function validateNeonCookieSecret(secret: string) {
  if (secret.length < 32) {
    throw new Error(
      "NEON_AUTH_COOKIE_SECRET (or BETTER_AUTH_SECRET fallback) must be at least 32 characters."
    )
  }
}

function requireNeonAuthBaseUrl() {
  const baseUrl = resolveNeonAuthBaseUrl()
  if (!baseUrl) {
    throw new Error(
      "NEON_AUTH_BASE_URL (or NEON_AUTH_URL) is required for Neon Managed Auth."
    )
  }
  validateNeonCookieSecret(resolveNeonAuthCookieSecret())
  return baseUrl.replace(/\/$/, "")
}

function extractNeonAuthCookies(cookieHeader: string | null) {
  if (!cookieHeader) {
    return ""
  }

  const parsed = parseCookies(cookieHeader)
  const parts: Array<string> = []
  for (const [name, value] of parsed.entries()) {
    if (name.startsWith(NEON_AUTH_COOKIE_PREFIX)) {
      parts.push(`${name}=${value}`)
    }
  }
  return parts.join("; ")
}

function resolveRequestOrigin(request: Request) {
  return (
    request.headers.get("origin") ||
    request.headers.get("referer")?.split("/").slice(0, 3).join("/") ||
    new URL(request.url).origin
  )
}

function buildUpstreamUrl(
  baseUrl: string,
  path: Array<string>,
  request: Request
) {
  const joined = path.join("/")
  const upstream = new URL(`${baseUrl}/${joined}`)
  upstream.search = new URL(request.url).search
  return upstream
}

function prepareUpstreamHeaders(request: Request) {
  const headers = new Headers()
  for (const header of PROXY_REQUEST_HEADERS) {
    const value = request.headers.get(header)
    if (value) {
      headers.set(header, value)
    }
  }
  headers.set("Origin", resolveRequestOrigin(request))
  headers.set("Cookie", extractNeonAuthCookies(request.headers.get("cookie")))
  headers.set(NEON_AUTH_MIDDLEWARE_HEADER, "true")
  return headers
}

function prepareDownstreamHeaders(response: Response) {
  const headers = new Headers()
  for (const header of PROXY_RESPONSE_HEADERS) {
    if (header === "set-cookie") {
      for (const cookie of response.headers.getSetCookie()) {
        headers.append("Set-Cookie", cookie)
      }
      continue
    }
    const value = response.headers.get(header)
    if (value) {
      headers.set(header, value)
    }
  }
  return headers
}

export function extractAuthProxyPath(request: Request): Array<string> | null {
  const url = new URL(request.url)
  const prefix = "/api/auth"
  const pathname = url.pathname
  if (!pathname.startsWith(prefix)) {
    return []
  }
  const remainder = pathname.slice(prefix.length).replace(/^\//, "")
  if (!remainder) {
    return []
  }
  const segments = remainder.split("/").filter(Boolean)
  if (segments.some((segment) => segment === "." || segment === "..")) {
    return null
  }
  return segments
}

/**
 * Framework-agnostic reverse proxy to Neon Auth (no Next.js adapter).
 * Mirrors the upstream proxy behavior of `@neondatabase/auth/next/server`
 * without importing `next/headers` or `next/server`.
 */
export async function handleNeonManagedAuthRequest(request: Request) {
  if (
    request.method !== "GET" &&
    request.method !== "POST" &&
    request.method !== "PUT" &&
    request.method !== "DELETE" &&
    request.method !== "PATCH"
  ) {
    return new Response("Method Not Allowed", { status: 405 })
  }

  const baseUrl = requireNeonAuthBaseUrl()
  const path = extractAuthProxyPath(request)
  if (path === null) {
    return new Response("Bad Request", { status: 400 })
  }
  const upstreamUrl = buildUpstreamUrl(baseUrl, path, request)
  const headers = prepareUpstreamHeaders(request)
  const body = request.method === "GET" ? undefined : await request.text()

  try {
    const upstream = await fetch(upstreamUrl.toString(), {
      method: request.method,
      headers,
      body,
    })

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: prepareDownstreamHeaders(upstream),
    })
  } catch (error) {
    return Response.json(
      {
        error: "Failed to reach Neon Auth upstream.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    )
  }
}

type SessionPayload = {
  user?: {
    id: string
    email?: string | null
    name?: string | null
    image?: string | null
  }
  session?: {
    id: string
    userId: string
  } | null
}

export async function getNeonManagedSessionFromRequest(request: Request) {
  const baseUrl = requireNeonAuthBaseUrl()
  const sessionRequest = new Request(`${baseUrl}/get-session`, {
    method: "GET",
    headers: prepareUpstreamHeaders(request),
  })

  let response: Response
  try {
    response = await fetch(sessionRequest)
  } catch {
    return null
  }

  if (!response.ok) {
    return null
  }

  const payload = (await response.json()) as SessionPayload
  if (!payload.user?.id) {
    return null
  }

  return payload
}
