/**
 * Normalize + harden OpenAI-compatible base URLs before persistence or fetch.
 * Shared by OCC BYOK registration and Neon AI Gateway resolution (avoids a
 * circular import between neon-ai-gateway and openai-chat-completions-provider).
 */

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

  // IPv6 unique-local (fc00::/7) and link-local (fe80::/10). Parse the first
  // hextet instead of naive prefix matching so public hostnames that happen to
  // start with fc/fd/fe80* nibbles are not false-blocked.
  if (isPrivateOrLinkLocalIpv6(host)) {
    return true
  }

  return false
}

/**
 * True for IPv6 unique-local (`fc00::/7` → first hextet 0xfc00–0xfdff) and
 * link-local (`fe80::/10` → first hextet in [0xfe80, 0xfebf]). Accepts a bare
 * hostname (no brackets) or a bracketed IPv6 literal.
 */
function isPrivateOrLinkLocalIpv6(host: string) {
  const firstHextet = firstIpv6Hextet(host)
  if (firstHextet === null) return false
  if (firstHextet >= 0xfc00 && firstHextet <= 0xfdff) return true // fc00::/7
  if (firstHextet >= 0xfe80 && firstHextet <= 0xfebf) return true // fe80::/10
  return false
}

function firstIpv6Hextet(host: string): number | null {
  const unwrapped = host
    .trim()
    .replace(/^\[|\]$/g, "")
    .toLowerCase()
  // Not an IPv6 literal (IPv4/hostname handled elsewhere).
  if (!unwrapped.includes(":")) return null
  const firstSegment = unwrapped.split(":", 1)[0]
  // Empty first segment means a leading "::" — the address starts with zeroes,
  // so it cannot be fc00::/7 or fe80::/10 (those begin with a nonzero nibble).
  if (firstSegment === "") return null
  const value = Number.parseInt(firstSegment, 16)
  if (Number.isNaN(value) || value < 0 || value > 0xffff) return null
  return value
}

function isLoopbackHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "")
  return host === "localhost" || host === "127.0.0.1" || host === "::1"
}

/** Platform Neon AI Gateway hosts only — blocks token exfil to arbitrary HTTPS. */
export function isAllowedNeonAiGatewayHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "")
  return host === "neon.tech" || host.endsWith(".neon.tech")
}
