import { dirname } from "node:path"
import { bootstrapAgentWorkspace } from "./bootstrap-agent-workspace"

export { AGENT_WORKSPACE_DIRECTORY } from "./workspace-contract"

export async function seedAgentWorkspace(workspaceRoot: string) {
  return bootstrapAgentWorkspace({
    projectRoot: dirname(workspaceRoot),
    workspaceRoot,
  })
}
