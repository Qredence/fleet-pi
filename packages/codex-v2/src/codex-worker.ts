import type { CodexWorkerResult, WorkerAssignment } from "./types.js"

export async function runCodexWorker({
  worker,
  workspaceRoot,
}: {
  worker: WorkerAssignment
  workspaceRoot: string
}): Promise<CodexWorkerResult> {
  const { Agent, MCPServerStdio, run, withTrace } =
    await import("@openai/agents")
  const server = new MCPServerStdio({
    name: "Codex CLI",
    fullCommand: "codex mcp-server",
  })

  await server.connect()
  try {
    const agent = new Agent({
      name: `Fleet Pi ${worker.role}`,
      instructions: [
        `You are the ${worker.role} worker in Fleet Pi Codex multi-agent v2.`,
        "Use Codex MCP for repository work.",
        "Keep all work scoped to the provided workspace root.",
        "Use approval-policy on-request and sandbox workspace-write for mutating Codex calls.",
        "Return a concise completion summary and include any Codex thread id if available.",
      ].join("\n"),
      mcpServers: [server],
    })

    const result = await withTrace(`fleet-pi codex-v2 ${worker.id}`, () =>
      run(
        agent,
        [
          `Workspace root: ${workspaceRoot}`,
          `Worker id: ${worker.id}`,
          `Worker role: ${worker.role}`,
          `Task: ${worker.task}`,
        ].join("\n")
      )
    )

    return {
      content: String(result.finalOutput ?? ""),
      threadId: extractThreadId(result),
    }
  } finally {
    await server.close()
  }
}

function extractThreadId(result: unknown) {
  const maybe = result as {
    state?: { _history?: Array<{ structuredContent?: { threadId?: string } }> }
  }
  return maybe.state?._history
    ?.map((item) => item.structuredContent?.threadId)
    .find((threadId): threadId is string => typeof threadId === "string")
}
