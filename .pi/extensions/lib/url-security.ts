import { lookup } from "node:dns/promises"
import { isIP } from "node:net"
import type { LookupFunction } from "node:net"
import { Agent } from "undici"

const MAX_DISPATCHERS = 100
const dispatcherCache = new Map<string, Agent>()

const BLOCKED_HOSTNAME_RE =
  /^(localhost|.*\.localhost)$|^127\.|^0\.|^10\.|^172\.(1[6-9]|2\d|3[01])\.|^192\.168\.|^169\.254\.|^\[?::1\]?$|^\[?fc|^\[?fd/i

export async function validatePublicHttpsUrl(url: string, label = "URL") {
  const parsed = new URL(url)

  if (parsed.protocol !== "https:") {
    throw new Error(`${label} must use https://.`)
  }

  if (isBlockedHost(parsed.hostname)) {
    throw new Error(`${label} points to a private or internal host.`)
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

  return { parsed, addresses }
}

/**
 * Fetch a validated public URL using the exact address checked by DNS.
 * The original hostname remains in the URL so TLS SNI and certificate
 * validation are preserved, while the dispatcher prevents a second DNS
 * resolution from rebinding the connection to a private address.
 */
export async function fetchPublicHttpsUrl(
  url: string,
  label = "URL",
  init: RequestInit = {}
) {
  const { parsed, addresses } = await validatePublicHttpsUrl(url, label)
  const address = addresses.find(
    (entry) => !isPrivateNetworkAddress(entry.address)
  )?.address
  if (!address) {
    throw new Error(`${label} did not resolve to a public address.`)
  }

  const pinnedLookup: LookupFunction = (_hostname, _options, callback) =>
    callback(null, address, isIP(address) as 4 | 6)

  let dispatcher = dispatcherCache.get(address)
  if (!dispatcher) {
    if (dispatcherCache.size >= MAX_DISPATCHERS) {
      const firstKey = dispatcherCache.keys().next().value
      if (firstKey) {
        const oldDispatcher = dispatcherCache.get(firstKey)
        dispatcherCache.delete(firstKey)
        oldDispatcher?.close().catch(() => undefined)
      }
    }
    dispatcher = new Agent({
      connect: {
        lookup: pinnedLookup,
      },
    })
    dispatcherCache.set(address, dispatcher)
  }

  return fetch(parsed, {
    ...init,
    redirect: "error",
    dispatcher,
  } as RequestInit & { dispatcher: Agent })
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
