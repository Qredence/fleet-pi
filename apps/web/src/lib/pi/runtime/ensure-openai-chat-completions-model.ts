import { OPENAI_CHAT_COMPLETIONS_PROVIDER_ID } from "@workspace/pi-protocol/provider-catalog"
import { isModelPatternEnabled } from "@workspace/pi-protocol/model-patterns"
import {
  loadPersistedProjectSettingsOverrides,
  updateChatSettings,
} from "./settings-bridge"
import type { AppRuntimeContext } from "@/lib/app-runtime"

/**
 * When Settings → Providers saves an OpenAI Chat Completions model, ensure
 * that model is allowlisted in `.pi/settings.json` `enabledModels`.
 *
 * Restrictive allowlists like `["github-copilot/*"]` otherwise hide the
 * newly configured model from `/api/chat/models` and the InputBar picker.
 */
export async function ensureOpenAiChatCompletionsModelEnabled(
  context: AppRuntimeContext,
  modelId: string,
  options?: { userId?: string; skipSettingsHotReload?: boolean }
) {
  const trimmedModelId = modelId.trim()
  if (!trimmedModelId) return

  const pattern = `${OPENAI_CHAT_COMPLETIONS_PROVIDER_ID}/${trimmedModelId}`
  const current = await loadPersistedProjectSettingsOverrides({
    userId: options?.userId,
    projectRoot: context.projectRoot,
  })

  // Missing enabledModels means allow-all — nothing to change.
  if (!Object.prototype.hasOwnProperty.call(current, "enabledModels")) {
    return
  }

  const existing = Array.isArray(current.enabledModels)
    ? current.enabledModels.filter(
        (entry): entry is string => typeof entry === "string"
      )
    : []

  const alreadyEnabled = isModelPatternEnabled(
    {
      id: trimmedModelId,
      modelId: trimmedModelId,
      provider: OPENAI_CHAT_COMPLETIONS_PROVIDER_ID,
      key: pattern,
    },
    existing
  )

  const shouldAlignDefault =
    typeof current.defaultModel === "string" &&
    current.defaultModel.trim() === trimmedModelId &&
    current.defaultProvider === "openai"

  if (alreadyEnabled) {
    if (shouldAlignDefault) {
      await updateChatSettings(
        context,
        {
          defaultProvider: OPENAI_CHAT_COMPLETIONS_PROVIDER_ID,
          defaultModel: trimmedModelId,
        },
        {
          userId: options?.userId,
          skipHotReload: options?.skipSettingsHotReload,
        }
      )
    }
    return
  }

  await updateChatSettings(
    context,
    {
      enabledModels: [...existing, pattern],
      ...(shouldAlignDefault
        ? {
            defaultProvider: OPENAI_CHAT_COMPLETIONS_PROVIDER_ID,
            defaultModel: trimmedModelId,
          }
        : {}),
    },
    { userId: options?.userId, skipHotReload: options?.skipSettingsHotReload }
  )
}
