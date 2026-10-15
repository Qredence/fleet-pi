export type HostedMcpServer = {
  name: string
  url: string
  headers?: Record<string, string>
}

export function assertHttpsMcpServer(server: HostedMcpServer) {
  let parsed: URL
  try {
    parsed = new URL(server.url)
  } catch {
    throw new Error("Hosted MCP accepts https servers only.")
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Hosted MCP accepts https servers only.")
  }
  if (!server.name.trim()) {
    throw new Error("MCP server name is required.")
  }
}

export function hostedMcpToolName(serverName: string, toolName: string) {
  const server = serverName.replace(/[^a-zA-Z0-9]+/g, "_")
  const tool = toolName.replace(/[^a-zA-Z0-9]+/g, "_")
  return `${server}_${tool}`
}
