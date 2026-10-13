import type { Daytona } from "@daytona/sdk"

const SNAPSHOT_PREFIX = "fleet-pi-v"

export async function findLatestSnapshot(
  client: Daytona
): Promise<string | undefined> {
  try {
    const result = await client.snapshot.list(1, 20)
    const fleetPiSnapshots = result.items
      .filter((s) => s.name.startsWith(SNAPSHOT_PREFIX) && s.state === "active")
      .sort((a, b) => {
        const aDate = new Date(a.createdAt).getTime()
        const bDate = new Date(b.createdAt).getTime()
        return bDate - aDate
      })

    return fleetPiSnapshots[0]?.name
  } catch {
    return undefined
  }
}
