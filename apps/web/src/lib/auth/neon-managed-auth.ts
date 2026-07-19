import {
  resolveNeonAuthBaseUrl,
  resolveNeonAuthCookieSecret,
} from "@/lib/auth/auth-mode"

type NeonAuthInstance = {
  handler: () => {
    GET: (
      request: Request,
      context: { params: Promise<{ path: Array<string> }> }
    ) => Promise<Response>
    POST: (
      request: Request,
      context: { params: Promise<{ path: Array<string> }> }
    ) => Promise<Response>
    PUT: (
      request: Request,
      context: { params: Promise<{ path: Array<string> }> }
    ) => Promise<Response>
    DELETE: (
      request: Request,
      context: { params: Promise<{ path: Array<string> }> }
    ) => Promise<Response>
    PATCH: (
      request: Request,
      context: { params: Promise<{ path: Array<string> }> }
    ) => Promise<Response>
  }
}

let neonAuthSingleton: NeonAuthInstance | null = null
let neonAuthLoader: Promise<NeonAuthInstance> | null = null

function validateNeonCookieSecret(secret: string) {
  if (secret.length < 32) {
    throw new Error(
      "NEON_AUTH_COOKIE_SECRET (or BETTER_AUTH_SECRET fallback) must be at least 32 characters."
    )
  }
}

async function loadNeonManagedAuth() {
  if (neonAuthSingleton) {
    return neonAuthSingleton
  }

  if (!neonAuthLoader) {
    neonAuthLoader = import("@neondatabase/auth/next/server").then(
      ({ createNeonAuth }) => {
        const baseUrl = resolveNeonAuthBaseUrl()
        const secret = resolveNeonAuthCookieSecret()
        validateNeonCookieSecret(secret)

        neonAuthSingleton = createNeonAuth({
          baseUrl,
          cookies: {
            secret,
            sessionDataTtl: 300,
          },
        })

        return neonAuthSingleton
      }
    )
  }

  return neonAuthLoader
}

export function extractAuthProxyPath(request: Request) {
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
  return remainder.split("/").filter(Boolean)
}

export async function handleNeonManagedAuthRequest(request: Request) {
  const neonAuth = await loadNeonManagedAuth()
  const handlers = neonAuth.handler()
  const path = extractAuthProxyPath(request)
  const params = Promise.resolve({ path })

  switch (request.method) {
    case "GET":
      return handlers.GET(request, { params })
    case "POST":
      return handlers.POST(request, { params })
    case "PUT":
      return handlers.PUT(request, { params })
    case "DELETE":
      return handlers.DELETE(request, { params })
    case "PATCH":
      return handlers.PATCH(request, { params })
    default:
      return new Response("Method Not Allowed", { status: 405 })
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
  const neonAuth = await loadNeonManagedAuth()
  const handlers = neonAuth.handler()
  const sessionRequest = new Request(
    new URL("/api/auth/get-session", request.url),
    {
      method: "GET",
      headers: request.headers,
    }
  )
  const response = await handlers.GET(sessionRequest, {
    params: Promise.resolve({ path: ["get-session"] }),
  })

  if (!response.ok) {
    return null
  }

  const payload = (await response.json()) as SessionPayload
  if (!payload.user?.id) {
    return null
  }

  return payload
}
