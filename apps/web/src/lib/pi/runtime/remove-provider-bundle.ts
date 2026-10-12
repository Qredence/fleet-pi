import { cleanupProjectSettingsForRemovedProvider } from "./cleanup-project-settings-for-removed-provider"
import { loadPersistedProjectSettingsOverrides } from "./durable-project-settings"
import {
  prepareProjectSettingsForPersist,
  projectSettingsOverridesEqual,
} from "./project-settings-persist"
import { resolveProviderCredentialBundle } from "./provider-credential-bundle"
import { saveProjectSettingsOverrides } from "./settings-bridge"
import type { AppRuntimeContext } from "@/lib/app-runtime"
import { removeEnvVars } from "@/lib/env-manager"
import { removeProviderCredentialsAndSettings } from "@/lib/db/remove-provider-with-settings"
import { isVercelDeployment } from "@/lib/deployment/environment"

export async function removeProviderBundle(options: {
  context: AppRuntimeContext
  providerId: string
  userId?: string
}) {
  const { context, providerId, userId } = options
  const { providerIds, envVarNames } =
    resolveProviderCredentialBundle(providerId)
  const currentOverrides = await loadPersistedProjectSettingsOverrides({
    userId,
    projectRoot: context.projectRoot,
  })
  const cleanedOverrides = cleanupProjectSettingsForRemovedProvider(
    currentOverrides,
    providerId
  )
  const settingsChanged = !projectSettingsOverridesEqual(
    currentOverrides,
    cleanedOverrides
  )

  if (isVercelDeployment()) {
    if (!userId) {
      throw new Error(
        "Authentication is required to remove providers on Vercel."
      )
    }
    await removeProviderCredentialsAndSettings(
      userId,
      providerIds,
      settingsChanged
        ? prepareProjectSettingsForPersist(cleanedOverrides)
        : undefined
    )
    return
  }

  await removeEnvVars(context.projectRoot, envVarNames)
  if (settingsChanged) {
    await saveProjectSettingsOverrides(context, cleanedOverrides, { userId })
  }
}
