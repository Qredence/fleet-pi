import type { AppRuntimeContext } from "@/lib/app-runtime"
import { resolveAppRuntimeContext } from "@/lib/app-runtime"
import { resolveUserSandboxContext } from "@/lib/daytona/resolve-user-sandbox-context"
import { isDaytonaEnabled } from "@/lib/daytona/user-sandbox"
import { resolveDaytonaRuntimeApiKey } from "@/lib/pi/runtime/user-provider-secrets"

export async function resolveWorkspaceContext(
  request: Request
): Promise<AppRuntimeContext> {
  const context = resolveAppRuntimeContext()

  const { auth } = await import("@/lib/auth/server")
  const session = await Promise.resolve(auth.api.getSession(request)).catch(
    () => null
  )
  const user = session?.user
  const userId = user?.id

  if (!userId) {
    return context
  }

  const clientDaytonaApiKey = request.headers.get("x-daytona-api-key")
  const resolvedDaytonaApiKey = await resolveDaytonaRuntimeApiKey(
    userId,
    clientDaytonaApiKey || undefined
  )

  if (process.env.VERCEL === "1" && !resolvedDaytonaApiKey) {
    throw new Error("daytona_credential_required")
  }

  if (
    !resolvedDaytonaApiKey ||
    !isDaytonaEnabled(userId, resolvedDaytonaApiKey)
  ) {
    return context
  }

  const sandboxContext = await resolveUserSandboxContext({
    userId,
    userEmail: user.email ?? undefined,
    apiKey: resolvedDaytonaApiKey,
    surface: "workspace",
  })

  context.workspaceFS = sandboxContext.workspaceFS
  context.workspaceRoot = sandboxContext.workspaceRoot
  context.workspaceBootstrap = undefined
  return context
}
