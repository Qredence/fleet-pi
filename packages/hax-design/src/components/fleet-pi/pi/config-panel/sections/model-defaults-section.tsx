import { Search } from "lucide-react"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../../../../input-group"
import { Switch } from "../../../../switch"
import { ItemRow } from "../../../primitives/item-row"
import {
  SettingsCommitActions,
  SettingsPane,
} from "../../../primitives/settings-pane"
import { isModelEnabled } from "../shared/model-patterns"
import {
  ProviderBrandIcon,
  formatProviderLabel,
} from "../shared/provider-brand-icon"
import type { ChatPiSettings } from "../../../../../lib/pi/chat-protocol"
import type { ConfigModelInfo } from "../shared/types"

export function ModelDefaultsSection({
  draft,
  modelDirty,
  modelFilter,
  modelOptions,
  onModelFilterChange,
  onModelToggle,
  onRevert,
  onSave,
  saving,
  settingsLoading,
}: {
  draft: ChatPiSettings | null
  modelDirty: boolean
  modelFilter: string
  modelOptions: Array<ConfigModelInfo>
  onModelFilterChange: (value: string) => void
  onModelToggle: (model: ConfigModelInfo, enabled: boolean) => void
  onRevert: () => void
  onSave: () => void
  saving: boolean
  settingsLoading: boolean
}) {
  const disabled = !draft || settingsLoading
  const normalizedFilter = modelFilter.trim().toLowerCase()
  const visibleModels = modelOptions.filter((model) => {
    if (!normalizedFilter) return true
    return [model.name, model.modelId, model.provider, model.id]
      .join(" ")
      .toLowerCase()
      .includes(normalizedFilter)
  })

  return (
    <SettingsPane
      title="LLM Models"
      description="Enable models available in chat."
      actions={
        <SettingsCommitActions
          dirty={modelDirty}
          disabled={disabled}
          onRevert={onRevert}
          onSave={onSave}
          saving={saving}
        />
      }
    >
      <InputGroup>
        <InputGroupAddon align="inline-start">
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          aria-label="Search models"
          value={modelFilter}
          onChange={(event) => onModelFilterChange(event.target.value)}
          placeholder="Search models…"
        />
      </InputGroup>

      <div className="flex flex-col gap-1.5" data-testid="runtime-models-list">
        {visibleModels.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-pretty text-muted-foreground">
            No models match your search.
          </p>
        ) : null}

        {visibleModels.map((model) => {
          const enabled = isModelEnabled(model, draft?.enabledModels)
          return (
            <ItemRow
              key={model.id}
              icon={<ProviderBrandIcon provider={model.provider} />}
              title={model.name}
              subtitle={formatProviderLabel(model.provider)}
              trailing={
                <Switch
                  aria-label={`${enabled ? "Disable" : "Enable"} ${model.name}`}
                  checked={enabled}
                  disabled={disabled}
                  onCheckedChange={(checked) => onModelToggle(model, checked)}
                />
              }
            />
          )
        })}
      </div>
    </SettingsPane>
  )
}
