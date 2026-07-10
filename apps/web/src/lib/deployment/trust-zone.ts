import { isVercelDeployment } from "./environment"

export type DeploymentTrustZone =
  "local" | "vercel-production" | "vercel-preview"

export function resolveDeploymentTrustZone(): DeploymentTrustZone {
  if (!isVercelDeployment()) {
    return "local"
  }

  const vercelEnv = process.env.VERCEL_ENV?.trim()
  if (vercelEnv === "preview") {
    return "vercel-preview"
  }

  return "vercel-production"
}

export function isVercelPreviewDeployment() {
  return resolveDeploymentTrustZone() === "vercel-preview"
}

export function requiresAuthenticatedMirrorOwner() {
  return isVercelDeployment()
}
