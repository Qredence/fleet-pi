import { downloadFile, executeCommand, uploadFile } from "../../daytona/client"
import type { SpikeSandboxPort } from "./spike-env"

/** Daytona sandbox behind the same port the scripted echo uses. */
export function daytonaSandboxPort(
  sandbox: Parameters<typeof executeCommand>[0]
): SpikeSandboxPort {
  return {
    async read(path) {
      const body = await downloadFile(sandbox, path)
      return body.toString("utf8")
    },
    async write(path, content) {
      await uploadFile(sandbox, content, path)
    },
    async exec(command) {
      const result = await executeCommand(
        sandbox,
        command,
        "/home/daytona/agent-workspace"
      )
      return { exitCode: result.exitCode, output: result.result }
    },
  }
}
