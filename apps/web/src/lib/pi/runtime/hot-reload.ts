import { resolveDefaultModelSelection } from "./diagnostics"
import { getActiveSessionRecords } from "./active-sessions"
import { applyModelSelection } from "./model-catalog"
import { RESOURCE_SETTING_KEYS } from "./types"
import { applyRuntimeAuth } from "./session-factory"
import type { ChatPiSettingsUpdate } from "@workspace/hax-design/lib/pi/chat-protocol"

export async function hotReloadActiveRuntimes(update: ChatPiSettingsUpdate) {
  const resourceReloadRequired = RESOURCE_SETTING_KEYS.some(
    (key) => update[key] !== undefined
  )

  for (const record of getActiveSessionRecords().values()) {
    const { runtime } = record

    await runtime.services.settingsManager.reload()

    if (resourceReloadRequired) {
      await runtime.services.resourceLoader.reload()
    }
    const { defaultProvider, defaultModel } = resolveDefaultModelSelection(
      runtime.services.settingsManager
    )
    const defaultThinkingLevel =
      runtime.services.settingsManager.getDefaultThinkingLevel()

    await applyModelSelection(runtime, {
      provider: defaultProvider,
      id: defaultModel,
      thinkingLevel: defaultThinkingLevel,
    })

    await applyRuntimeAuth(runtime.services, { userId: record.userId })
  }
}

export async function hotReloadActiveRuntimesForUser(userId: string) {
  for (const record of getActiveSessionRecords().values()) {
    if (record.userId !== userId) continue

    await record.runtime.services.settingsManager.reload()
    await applyRuntimeAuth(record.runtime.services, { userId })
  }
}

export async function hotReloadProviderAuthForActiveRuntimes() {
  for (const record of getActiveSessionRecords().values()) {
    await applyRuntimeAuth(record.runtime.services, { userId: record.userId })
  }
}
