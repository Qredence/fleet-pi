import { SettingsManager } from "@earendil-works/pi-coding-agent"

type SettingsStorage = Parameters<typeof SettingsManager.fromStorage>[0]
type SettingsScope = Parameters<SettingsStorage["withLock"]>[0]

/** Each service owns its storage; no deployed settings touch shared files. */
class IsolatedSettingsStorage implements SettingsStorage {
  private documents: Record<SettingsScope, string | undefined> = {
    global: undefined,
    project: undefined,
  }

  constructor(settings: Record<string, unknown>) {
    this.replaceProject(settings)
  }

  withLock(
    scope: SettingsScope,
    update: (current: string | undefined) => string | undefined
  ) {
    const next = update(this.documents[scope])
    if (next !== undefined) this.documents[scope] = next
  }

  replaceProject(settings: Record<string, unknown>) {
    this.documents = { global: undefined, project: JSON.stringify(settings) }
  }
}

const stores = new WeakMap<SettingsManager, IsolatedSettingsStorage>()

export function createIsolatedProjectSettings(
  settings: Record<string, unknown>
) {
  const storage = new IsolatedSettingsStorage(settings)
  const manager = SettingsManager.fromStorage(storage)
  stores.set(manager, storage)
  return manager
}

/** Replace the entire snapshot so removed overrides cannot survive a reload. */
export async function replaceIsolatedProjectSettings(
  manager: SettingsManager,
  settings: Record<string, unknown>
) {
  const storage = stores.get(manager)
  if (!storage) {
    throw new Error("Deployed Pi settings require isolated runtime storage.")
  }
  await manager.flush()
  storage.replaceProject(settings)
  await manager.reload()
}
