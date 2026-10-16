export const PRODUCTION_AUTH_URL = "https://fleet-pi-web.workers.dev"

export const LOCAL_AUTH_URL = "http://localhost:3000"

export const LOCAL_TRUSTED_ORIGINS = [
  LOCAL_AUTH_URL,
  "http://localhost:3001",
  "http://localhost:3002",
] as const

/** Explicit production hosts only — preview origins come from BETTER_AUTH_URL. */
export const HOSTED_AUTH_HOSTS = ["fleet-pi-web.workers.dev"] as const

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

export function resolveHostedAllowedHosts(configuredBaseURL?: string) {
  return uniqueHosts([
    configuredBaseURL ? toAuthHost(configuredBaseURL) : undefined,
    ...HOSTED_AUTH_HOSTS,
  ])
}

export function resolveTrustedOriginsForDeployment(input: {
  isHosted: boolean
  isPreview: boolean
  configuredOrigins: Array<string>
  betterAuthUrl?: string
}) {
  if (input.configuredOrigins.length > 0) {
    return input.configuredOrigins
  }

  if (!input.isHosted) {
    return uniqueHosts([input.betterAuthUrl, ...LOCAL_TRUSTED_ORIGINS])
  }

  if (input.isPreview) {
    if (!input.betterAuthUrl) {
      throw new Error(
        "BETTER_AUTH_URL is required for Preview deployments. Set BETTER_AUTH_TRUSTED_ORIGINS to the preview origin."
      )
    }
    return [input.betterAuthUrl]
  }

  return uniqueHosts([input.betterAuthUrl, PRODUCTION_AUTH_URL])
}
