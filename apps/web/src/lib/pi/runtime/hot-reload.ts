import { resolveDefaultModelSelection } from "./diagnostics"
import {
  
  getActiveSessionRecords
} from "./active-sessions"
import { applyModelSelection } from "./model-catalog"
import { RESOURCE_SETTING_KEYS } from "./types"
import { applyRuntimeAuth } from "./session-factory"
import type {ActiveSessionRecord} from "./active-sessions";
import type { ChatPiSettingsUpdate } from "@workspace/hax-design/lib/pi/chat-protocol"

async function reloadRuntimeForRecord(
  record: ActiveSessionRecord,
  update?: ChatPiSettingsUpdate
) {
  const { runtime } = record
  const resourceReloadRequired =
    update && RESOURCE_SETTING_KEYS.some((key) => update[key] !== undefined)

  await runtime.services.settingsManager.reload()

  if (resourceReloadRequired) {
    await runtime.services.resourceLoader.reload()
  }

  if (update) {
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
  }

  await applyRuntimeAuth(runtime.services, { userId: record.userId })
}

export async function hotReloadActiveRuntimes(update: ChatPiSettingsUpdate) {
  for (const record of getActiveSessionRecords().values()) {
    await reloadRuntimeForRecord(record, update)
  }
}

export async function hotReloadActiveRuntimesForUser(
  userId: string,
  update?: ChatPiSettingsUpdate
) {
  for (const record of getActiveSessionRecords().values()) {
    if (record.userId !== userId) continue
    await reloadRuntimeForRecord(record, update)
  }
}

export async function hotReloadProviderAuthForActiveRuntimes() {
  for (const record of getActiveSessionRecords().values()) {
    await applyRuntimeAuth(record.runtime.services, { userId: record.userId })
  }
}
