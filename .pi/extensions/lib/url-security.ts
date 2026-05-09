import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

const BLOCKED_HOSTNAME_RE =
  /^(localhost|.*\.localhost)$|^127\.|^0\.|^10\.|^172\.(1[6-9]|2\d|3[01])\.|^192\.168\.|^169\.254\.|^\[?::1\]?$|^\[?fc|^\[?fd/i

export async function validatePublicHttpsUrl(
  url: string,
  label = "URL",
  options: { allowExplicitLoopback?: boolean } = {}
) {
  const parsed = new URL(url)
  const explicitLoopback = isExplicitLoopbackHost(parsed.hostname)

  if (
    parsed.protocol !== "https:" &&
    !(
      options.allowExplicitLoopback &&
      explicitLoopback &&
      parsed.protocol === "http:"
    )
  ) {
    throw new Error(`${label} must use https://.`)
  }

  if (
    isBlockedHost(parsed.hostname) &&
    !(options.allowExplicitLoopback && explicitLoopback)
  ) {
    throw new Error(`${label} points to a private or internal host.`)
  }

  if (options.allowExplicitLoopback && explicitLoopback) {
    return parsed
  }

  const addresses = await lookup(parsed.hostname, {
    all: true,
    order: "verbatim",
  })
  if (addresses.length === 0) {
    throw new Error(`${label} could not be resolved.`)
  }

  if (addresses.some((entry) => isPrivateNetworkAddress(entry.address))) {
    throw new Error(`${label} resolves to a private or internal IP address.`)
  }

  return parsed
}

export function isPrivateNetworkAddress(address: string) {
  const normalized = address.trim().toLowerCase()
  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1]
  const candidate = mappedIpv4 ?? normalized
  const family = isIP(candidate)

  if (family === 4) {
    return isPrivateIpv4(candidate)
  }
  if (family === 6) {
    return isPrivateIpv6(candidate)
  }
  return false
}

function isBlockedHost(hostname: string) {
  return BLOCKED_HOSTNAME_RE.test(hostname)
}

function isExplicitLoopbackHost(hostname: string) {
  const normalized = hostname.trim().toLowerCase()
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "[::1]"
  )
}

function isPrivateIpv4(address: string) {
  const octets = address.split(".").map((part) => Number.parseInt(part, 10))
  if (octets.length !== 4 || octets.some((part) => Number.isNaN(part))) {
    return false
  }

  const [a, b] = octets
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a === 198 && (b === 18 || b === 19)) return true
  return false
}

function isPrivateIpv6(address: string) {
  if (address === "::" || address === "::1") return true
  return (
    address.startsWith("fc") ||
    address.startsWith("fd") ||
    address.startsWith("fe8") ||
    address.startsWith("fe9") ||
    address.startsWith("fea") ||
    address.startsWith("feb")
  )
}
