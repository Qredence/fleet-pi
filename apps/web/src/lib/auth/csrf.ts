import { randomBytes, timingSafeEqual } from "node:crypto"

const COOKIE_NAME = "fleet_pi_csrf"
const HEADER_NAME = "x-fleet-csrf-token"

function readCookie(request: Request) {
  const value = request.headers.get("cookie") ?? ""
  return value
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1)
}

function sameOrigin(request: Request) {
  const requestOrigin = new URL(request.url).origin
  const origin = request.headers.get("origin")
  if (origin) return origin === requestOrigin

  const referer = request.headers.get("referer")
  if (referer) {
    try {
      return new URL(referer).origin === requestOrigin
    } catch {
      return false
    }
  }

  return false
}

export function issueCsrfToken(request: Request) {
  const token = readCookie(request) ?? randomBytes(32).toString("base64url")
  const secure = new URL(request.url).protocol === "https:"
  return {
    token,
    cookie: `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`,
  }
}

export function validateCsrfRequest(request: Request) {
  if (!sameOrigin(request)) {
    return { ok: false as const, reason: "origin" }
  }

  const expected = readCookie(request)
  const received = request.headers.get(HEADER_NAME)
  if (!expected || !received) {
    return { ok: false as const, reason: "token" }
  }

  const expectedBytes = Buffer.from(expected)
  const receivedBytes = Buffer.from(received)
  if (
    expectedBytes.length !== receivedBytes.length ||
    !timingSafeEqual(expectedBytes, receivedBytes)
  ) {
    return { ok: false as const, reason: "token" }
  }

  return { ok: true as const }
}
