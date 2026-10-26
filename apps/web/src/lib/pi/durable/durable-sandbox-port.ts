import { Daytona } from "@daytona/sdk"
import { daytonaSandboxPort } from "./hosted-sandbox"
import type { HostedSandboxPort } from "./hosted-sandbox-env"

export type DurableSandboxConnection = {
  apiKey: string
  sandboxId: string
  apiUrl?: string
  target?: string
}

export async function openDaytonaSandboxPort(
  connection: DurableSandboxConnection
): Promise<HostedSandboxPort> {
  const client = new Daytona({
    apiKey: connection.apiKey,
    ...(connection.apiUrl ? { apiUrl: connection.apiUrl } : {}),
    ...(connection.target ? { target: connection.target } : {}),
  })
  const sandbox = await client.get(connection.sandboxId)
  return daytonaSandboxPort(sandbox)
}
