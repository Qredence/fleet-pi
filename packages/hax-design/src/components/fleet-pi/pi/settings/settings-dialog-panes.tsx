import { PersonalizationSection } from "../config-panel/sections/personalization-section"
import { ProviderCredentialsSection } from "../config-panel/sections/provider-credentials-section"
import { ModelDefaultsSection } from "../config-panel/sections/model-defaults-section"
import { ResourcesSection } from "../config-panel/sections/resources-section"
import { AgentLoopSection } from "../config-panel/sections/agent-loop-section"
import { SandboxProviderSection } from "../config-panel/sections/sandbox-provider-section"
import {
  modelSettings,
  resourceSettings,
} from "../config-panel/shared/settings-mappers"
import type { SettingsSectionId } from "../settings-sections"
import type { useSettingsForm } from "./use-settings-form"
import type { ReactNode } from "react"

type SettingsFormState = ReturnType<typeof useSettingsForm>

export function settingsSectionPanes(
  form: SettingsFormState
): Record<SettingsSectionId, () => ReactNode> {
  const resourcesPane = (scope: "skills" | "harness") => (
    <ResourcesSection
      scope={scope}
      draft={form.draft}
      onEnableSkillCommandsChange={(enableSkillCommands) =>
        form.updateDraft((current) => ({
          ...current,
          enableSkillCommands,
        }))
      }
      onExtensionsChange={(extensions) =>
        form.updateDraft((current) => ({ ...current, extensions }))
      }
      onPackageRowsChange={form.handlePackageRowsChange}
      onPromptsChange={(prompts) =>
        form.updateDraft((current) => ({ ...current, prompts }))
      }
      onRevert={form.revertResourceDraft}
      onSave={() =>
        form.draft &&
        form.saveSection("resources", resourceSettings(form.draft))
      }
      onSkillsChange={(skills) =>
        form.updateDraft((current) => ({ ...current, skills }))
      }
      onThemesChange={(themes) =>
        form.updateDraft((current) => ({ ...current, themes }))
      }
      packageError={form.packageError}
      packageRows={form.packageRows}
      resourceDirty={form.resourceDirty}
      resources={form.resources}
      resourceSummary={form.resourceSummary}
      saving={form.savingSection === "resources"}
      settingsLoading={form.settingsLoading}
    />
  )

  return {
    appearance: () => (
      <div className="flex flex-col gap-6">
        <div>
          <h3 className="text-lg font-medium">Appearance</h3>
          <p className="text-sm text-muted-foreground">
            Customize the look and feel of the interface.
          </p>
        </div>
        <PersonalizationSection
          onThemePreferenceChange={form.onThemePreferenceChange}
          themePreference={form.themePreference}
        />
      </div>
    ),
    sandbox: () => (
      <SandboxProviderSection
        isLoading={form.isLoadingProviders ?? false}
        isPending={form.isUpdatingProvider ?? false}
        providers={form.providers}
        onUpdateProvider={form.onUpdateProvider}
      />
    ),
    providers: () => (
      <ProviderCredentialsSection
        isLoading={form.isLoadingProviders ?? false}
        isPending={form.isUpdatingProvider ?? false}
        providers={form.providers}
        onRemoveProvider={form.onRemoveProvider}
        onUpdateProvider={form.onUpdateProvider}
      />
    ),
    "llm-models": () => (
      <ModelDefaultsSection
        draft={form.draft}
        discoveringProviderId={form.discoveringProviderId}
        modelDirty={form.modelDirty}
        modelFilter={form.modelFilter}
        modelOptions={form.modelOptions}
        chatModels={form.chatModels}
        onAddModels={form.addModels}
        onDiscoverProvider={form.discoverProvider}
        onModelFilterChange={form.setModelFilter}
        onRemoveModel={form.removeModel}
        providers={form.providers}
        onRevert={form.revertModelDraft}
        onSave={() =>
          form.draft && form.saveSection("models", modelSettings(form.draft))
        }
        saving={form.savingSection === "models"}
        settingsLoading={form.settingsLoading}
      />
    ),
    skills: () => resourcesPane("skills"),
    "agent-loop": () => (
      <AgentLoopSection
        onSave={(update) => form.saveSection("agent-loop", update)}
        saving={form.savingSection === "agent-loop"}
        settings={form.settings?.effective ?? null}
      />
    ),
    "pi-harness": () => resourcesPane("harness"),
  }
}
