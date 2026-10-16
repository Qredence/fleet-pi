import { Daytona } from "@daytona/sdk"
import { daytonaSandboxPort } from "./spike-daytona"
import type { SpikeSandboxPort } from "./spike-env"

export type DurableSandboxConnection = {
  apiKey: string
  sandboxId: string
  apiUrl?: string
  target?: string
}

export async function openDaytonaSandboxPort(
  connection: DurableSandboxConnection
): Promise<SpikeSandboxPort> {
  const client = new Daytona({
    apiKey: connection.apiKey,
    ...(connection.apiUrl ? { apiUrl: connection.apiUrl } : {}),
    ...(connection.target ? { target: connection.target } : {}),
  })
  const sandbox = await client.get(connection.sandboxId)
  return daytonaSandboxPort(sandbox)
}
