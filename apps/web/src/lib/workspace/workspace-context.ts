import type { AppRuntimeContext } from "@/lib/app-runtime"
import { resolveAppRuntimeContext } from "@/lib/app-runtime"
import { isDaytonaEnabled } from "@/lib/daytona/user-sandbox"

import { resolveDaytonaRuntimeApiKey } from "@/lib/pi/runtime/user-provider-secrets"

const SANDBOX_WORKSPACE_ROOT = "/home/daytona/fleet-pi/agent-workspace"

export async function resolveWorkspaceContext(
  request: Request
): Promise<AppRuntimeContext> {
  const context = resolveAppRuntimeContext()

  const { auth } = await import("@/lib/auth/server")
  const session = await Promise.resolve(
    auth.api.getSession({ headers: request.headers })
  ).catch(() => null)
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

  const { getUserSandbox } = await import("@/lib/daytona/user-sandbox")
  const { executeCommand: daytonaExecuteCommand } =
    await import("@/lib/daytona/client")

  const handle = await getUserSandbox({
    userId,
    userEmail: user.email,
    apiKey: resolvedDaytonaApiKey,
  })
  const sb = handle.sandbox

  await daytonaExecuteCommand(sb, `mkdir -p ${SANDBOX_WORKSPACE_ROOT}`)

  const { createSandboxWorkspaceFS } = await import("./workspace-fs")

  context.workspaceFS = createSandboxWorkspaceFS({
    executeCommand: (cmd, cwd) => daytonaExecuteCommand(sb, cmd, cwd),
  })
  context.workspaceRoot = SANDBOX_WORKSPACE_ROOT

  return context
}
