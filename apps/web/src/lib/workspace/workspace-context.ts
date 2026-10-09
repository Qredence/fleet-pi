import type { AppRuntimeContext } from "@/lib/app-runtime"
import {
  DaytonaCredentialRequiredError,
  resolveAppRuntimeContext,
} from "@/lib/app-runtime"
import { resolveUserSandboxContext } from "@/lib/daytona/resolve-user-sandbox-context"
import { isDaytonaEnabled } from "@/lib/daytona/user-sandbox"
import { resolveDaytonaRuntimeApiKey } from "@/lib/pi/runtime/user-provider-secrets"
import { isVercelDeployment } from "@/lib/deployment/environment"

export async function resolveWorkspaceContext(
  request: Request,
  authenticatedUser?: { id: string; email?: string | null }
): Promise<AppRuntimeContext> {
  const context = resolveAppRuntimeContext()

  let user = authenticatedUser
  if (!user) {
    const { auth } = await import("@/lib/auth/server")
    const session = await Promise.resolve(auth.api.getSession(request)).catch(
      () => null
    )
    user = session?.user
  }
  const userId = user?.id

  if (!userId) {
    return context
  }

  const resolvedDaytonaApiKey = await resolveDaytonaRuntimeApiKey(userId)

  if (isVercelDeployment() && !resolvedDaytonaApiKey) {
    throw new DaytonaCredentialRequiredError()
  }

  if (
    !resolvedDaytonaApiKey ||
    !isDaytonaEnabled(userId, resolvedDaytonaApiKey)
  ) {
    return context
  }

  const sandboxContext = await resolveUserSandboxContext({
    userId,
    userEmail: user?.email ?? undefined,
    apiKey: resolvedDaytonaApiKey,
    surface: "workspace",
  })

  context.workspaceFS = sandboxContext.workspaceFS
  context.workspaceRoot = sandboxContext.workspaceRoot
  return context
}
