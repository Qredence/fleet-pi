import {
  DaytonaCredentialRequiredError,
  resolveAppRuntimeContext,
} from "@/lib/app-runtime"
import { resolveUserSandboxContext } from "@/lib/daytona/resolve-user-sandbox-context"
import { isDaytonaEnabled } from "@/lib/daytona/user-sandbox"
import { isHostedDeployment } from "@/lib/deployment/environment"
import {
  DURABLE_WORKSPACE_ROOT,
  durableWorkspaceFSForUser,
} from "@/lib/pi/durable/durable-workspace-fs"
import { resolveDaytonaRuntimeApiKey } from "@/lib/pi/runtime/user-provider-secrets"

import type { AppRuntimeContext } from "@/lib/app-runtime"

export async function resolveWorkspaceContext(
  request: Request,
  authenticatedUser?: { id: string; email?: string | null },
  options: { requireDaytona?: boolean } = {}
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

  if (!resolvedDaytonaApiKey && options.requireDaytona === false) {
    // Chat-only surfaces (e.g. the slash-command catalog) degrade to the
    // bundled runtime context instead of gating users without Daytona.
    return context
  }

  if (isHostedDeployment() && !resolvedDaytonaApiKey) {
    // Without a Daytona key the panel shows the built-in Durable Object store.
    const durableFS = durableWorkspaceFSForUser(userId)
    if (!durableFS) throw new DaytonaCredentialRequiredError()
    context.workspaceFS = durableFS
    context.workspaceRoot = DURABLE_WORKSPACE_ROOT
    return context
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
