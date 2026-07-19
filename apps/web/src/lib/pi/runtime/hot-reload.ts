import { resolveDefaultModelSelection } from "./diagnostics"
import { getActiveSessionRecords } from "./active-sessions"
import { applyModelSelection } from "./model-catalog"
import { applyProjectSettingsToServices } from "./apply-project-settings"
import { resolveProjectSettings } from "./durable-project-settings"
import { RESOURCE_SETTING_KEYS } from "./types"
import { applyRuntimeAuth } from "./session-factory"
import { normalizeChatThinkingLevel } from "./thinking-level"
import type { ActiveSessionRecord } from "./active-sessions"
import type { ChatPiSettingsUpdate } from "@workspace/pi-protocol/chat-protocol"

async function reloadRuntimeForRecord(
  record: ActiveSessionRecord,
  update?: ChatPiSettingsUpdate,
  projectRoot?: string
) {
  const { runtime } = record
  const resourceReloadRequired =
    update && RESOURCE_SETTING_KEYS.some((key) => update[key] !== undefined)

  await runtime.services.settingsManager.reload()

  const merged = await resolveProjectSettings({
    userId: record.userId,
    projectRoot,
  })
  applyProjectSettingsToServices(runtime.services, merged)

  if (resourceReloadRequired || process.env.VERCEL === "1") {
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
      thinkingLevel: normalizeChatThinkingLevel(defaultThinkingLevel),
    })
  }

  await applyRuntimeAuth(runtime.services, { userId: record.userId })
}

export async function hotReloadActiveRuntimes(
  update: ChatPiSettingsUpdate,
  projectRoot?: string
) {
  for (const record of getActiveSessionRecords().values()) {
    await reloadRuntimeForRecord(record, update, projectRoot)
  }
}

export async function hotReloadActiveRuntimesForUser(
  userId: string,
  update?: ChatPiSettingsUpdate,
  projectRoot?: string
) {
  for (const record of getActiveSessionRecords().values()) {
    if (record.userId !== userId) continue
    await reloadRuntimeForRecord(record, update, projectRoot)
  }
}

export async function hotReloadProviderAuthForActiveRuntimes() {
  for (const record of getActiveSessionRecords().values()) {
    await applyRuntimeAuth(record.runtime.services, { userId: record.userId })
  }
}
