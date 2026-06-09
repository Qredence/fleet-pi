import { Cpu } from "lucide-react"
import { Select } from "../../../../select"
import { FIELD_CONTROL_CLASS, THINKING_LEVELS } from "../shared/constants"
import {
  ConfigurationSection,
  EditableSection,
  FieldLabel,
} from "../shared/fields"
import {
  CustomModelEditor,
  DefaultModelSummary,
  ModelActivationList,
  ProviderManagementList,
} from "../shared/lists"
import type {
  ChatPiSettings,
  ChatThinkingLevel,
} from "../../../../../lib/pi/chat-protocol"
import type { ConfigModelInfo, ProviderSummary } from "../shared/types"

export function ModelDefaultsSection({
  customModel,
  customProvider,
  draft,
  modelDirty,
  modelFilter,
  modelOptions,
  modelSelectValue,
  onConnectProvider,
  onCustomModelChange,
  onCustomProviderChange,
  onModelDefault,
  onModelFilterChange,
  onModelToggle,
  onProviderDefault,
  onProviderFilterChange,
  onProviderToggle,
  onRevert,
  onSave,
  onSetAllModels,
  onThinkingLevelChange,
  onUseCustomModel,
  onUseRecommended,
  providerFilter,
  providerOptions,
  saving,
  settingsLoading,
}: {
  customModel: string
  customProvider: string
  draft: ChatPiSettings | null
  modelDirty: boolean
  modelFilter: string
  modelOptions: Array<ConfigModelInfo>
  modelSelectValue: string
  onConnectProvider: (provider: string) => void
  onCustomModelChange: (value: string) => void
  onCustomProviderChange: (value: string) => void
  onModelDefault: (model: ConfigModelInfo) => void
  onModelFilterChange: (value: string) => void
  onModelToggle: (model: ConfigModelInfo, enabled: boolean) => void
  onProviderDefault: (provider: string) => void
  onProviderFilterChange: (value: string) => void
  onProviderToggle: (provider: string, enabled: boolean) => void
  onRevert: () => void
  onSave: () => void
  onSetAllModels: (enabled: boolean) => void
  onThinkingLevelChange: (level: ChatThinkingLevel) => void
  onUseCustomModel: () => void
  onUseRecommended: () => void
  providerFilter: string
  providerOptions: Array<ProviderSummary>
  saving: boolean
  settingsLoading: boolean
}) {
  return (
    <ConfigurationSection icon={Cpu} label="Model Defaults">
      <EditableSection
        dirty={modelDirty}
        disabled={!draft || settingsLoading}
        onRevert={onRevert}
        onSave={onSave}
        saving={saving}
        title="Providers and models"
      >
        <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-2">
          <DefaultModelSummary
            model={modelOptions.find((item) => item.id === modelSelectValue)}
            provider={draft?.defaultProvider}
          />
          <FieldLabel label="Thinking">
            <Select
              aria-label="Thinking level"
              value={draft?.defaultThinkingLevel ?? ""}
              disabled={!draft}
              onValueChange={(nextValue) => {
                onThinkingLevelChange(nextValue as ChatThinkingLevel)
              }}
              className={FIELD_CONTROL_CLASS}
              options={THINKING_LEVELS.map((level) => ({
                label: level,
                value: level,
              }))}
            />
          </FieldLabel>
        </div>
        <ProviderManagementList
          defaultProvider={draft?.defaultProvider}
          onConnect={onConnectProvider}
          onDefault={onProviderDefault}
          onToggle={onProviderToggle}
          providers={providerOptions}
        />
        <CustomModelEditor
          model={customModel}
          onModelChange={onCustomModelChange}
          onUse={onUseCustomModel}
          onProviderChange={onCustomProviderChange}
          provider={customProvider}
          providers={providerOptions.map((item) => item.provider)}
        />
        <ModelActivationList
          defaultModel={draft?.defaultModel}
          defaultProvider={draft?.defaultProvider}
          enabledPatterns={draft?.enabledModels}
          filter={modelFilter}
          models={modelOptions}
          onDefault={onModelDefault}
          onFilterChange={onModelFilterChange}
          onProviderFilterChange={onProviderFilterChange}
          onSetAll={onSetAllModels}
          onToggle={onModelToggle}
          onUseRecommended={onUseRecommended}
          providerFilter={providerFilter}
          providers={providerOptions}
        />
      </EditableSection>
    </ConfigurationSection>
  )
}
