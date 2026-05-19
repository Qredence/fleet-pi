import { createSandboxWorkspaceFS } from "./workspace-fs"
import type { AppRuntimeContext } from "@/lib/app-runtime"
import { resolveAppRuntimeContext } from "@/lib/app-runtime"
import { isDaytonaEnabled } from "@/lib/daytona/user-sandbox"

const SANDBOX_WORKSPACE_ROOT = "/home/daytona/fleet-pi/agent-workspace"

export async function resolveWorkspaceContext(
  request: Request
): Promise<AppRuntimeContext> {
  const context = resolveAppRuntimeContext()

  if (!process.env.DAYTONA_API_KEY) {
    return context
  }

  const { auth } = await import("@/lib/auth/server")
  const session = await auth.api
    .getSession({ headers: request.headers })
    .catch(() => null)
  const user = session?.user
  const userId = user?.id

  if (!userId) {
    return context
  }

  if (!isDaytonaEnabled(userId)) {
    return context
  }

  const { getUserSandbox } = await import("@/lib/daytona/user-sandbox")
  const { executeCommand: daytonaExecuteCommand } =
    await import("@/lib/daytona/client")

  const handle = await getUserSandbox({
    userId,
    userEmail: user.email,
  })
  const sb = handle.sandbox

  await daytonaExecuteCommand(sb, `mkdir -p ${SANDBOX_WORKSPACE_ROOT}`)

  context.workspaceFS = createSandboxWorkspaceFS({
    executeCommand: (cmd, cwd) => daytonaExecuteCommand(sb, cmd, cwd),
  })
  context.workspaceRoot = SANDBOX_WORKSPACE_ROOT

  return context
}
