export const PRODUCTION_AUTH_URL = "https://fleet-pi-web.vercel.app"

export const LOCAL_AUTH_URL = "http://localhost:3000"

export const LOCAL_TRUSTED_ORIGINS = [
  LOCAL_AUTH_URL,
  "http://localhost:3001",
  "http://localhost:3002",
] as const

/** Explicit production/preview hosts only — no *.vercel.app wildcard. */
export const VERCEL_AUTH_HOSTS = [
  "fleet-pi-web.vercel.app",
  "fleet-pi-web-qredence.vercel.app",
  "fleet-pi-web-git-main-qredence.vercel.app",
] as const

export function toAuthHost(value: string) {
  try {
    return new URL(value).host
  } catch {
    return value.replace(/^https?:\/\//, "").split("/")[0]
  }
}

export function uniqueHosts(values: Array<string | undefined>) {
  return [...new Set(values.filter(Boolean) as Array<string>)]
}

export function resolveVercelAllowedHosts(
  configuredBaseURL?: string,
  vercelUrl?: string
) {
  return uniqueHosts([
    configuredBaseURL ? toAuthHost(configuredBaseURL) : undefined,
    vercelUrl ? toAuthHost(`https://${vercelUrl}`) : undefined,
    ...VERCEL_AUTH_HOSTS,
  ])
}

export function resolvePreviewAuthOrigin(input: {
  betterAuthUrl?: string
  vercelUrl?: string
}) {
  return (
    input.betterAuthUrl ??
    (input.vercelUrl ? `https://${input.vercelUrl}` : undefined)
  )
}

export function resolveTrustedOriginsForDeployment(input: {
  isVercel: boolean
  isPreview: boolean
  configuredOrigins: Array<string>
  betterAuthUrl?: string
  vercelUrl?: string
}) {
  if (input.configuredOrigins.length > 0) {
    return input.configuredOrigins
  }

  if (!input.isVercel) {
    return uniqueHosts([input.betterAuthUrl, ...LOCAL_TRUSTED_ORIGINS])
  }

  if (input.isPreview) {
    const previewOrigin = resolvePreviewAuthOrigin({
      betterAuthUrl: input.betterAuthUrl,
      vercelUrl: input.vercelUrl,
    })
    if (!previewOrigin) {
      throw new Error(
        "BETTER_AUTH_URL is required for Preview deployments. Set BETTER_AUTH_TRUSTED_ORIGINS to the preview origin."
      )
    }
    return [previewOrigin]
  }

  return [
    PRODUCTION_AUTH_URL,
    "https://fleet-pi-web-qredence.vercel.app",
    "https://fleet-pi-web-git-main-qredence.vercel.app",
  ]
}
