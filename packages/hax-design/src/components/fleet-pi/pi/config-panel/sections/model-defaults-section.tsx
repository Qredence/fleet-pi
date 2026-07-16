import { Search } from "lucide-react"
import { useMemo, useState } from "react"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../../../../input-group"
import { Switch } from "../../../../switch"
import { cn } from "../../../../../lib/utils"
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

type ModelStatusFilter = "all" | "enabled" | "disabled"

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
  const [statusFilter, setStatusFilter] = useState<ModelStatusFilter>("all")
  const disabled = !draft || settingsLoading
  const normalizedFilter = modelFilter.trim().toLowerCase()

  const enabledCount = useMemo(
    () =>
      modelOptions.filter((model) =>
        isModelEnabled(model, draft?.enabledModels)
      ).length,
    [draft?.enabledModels, modelOptions]
  )

  const visibleModels = useMemo(() => {
    return modelOptions.filter((model) => {
      const enabled = isModelEnabled(model, draft?.enabledModels)
      if (statusFilter === "enabled" && !enabled) return false
      if (statusFilter === "disabled" && enabled) return false
      if (!normalizedFilter) return true
      return [model.name, model.modelId, model.provider, model.id]
        .join(" ")
        .toLowerCase()
        .includes(normalizedFilter)
    })
  }, [draft?.enabledModels, modelOptions, normalizedFilter, statusFilter])

  const groupedModels = useMemo(() => {
    const groups = new Map<string, Array<ConfigModelInfo>>()
    for (const model of visibleModels) {
      const key = model.provider
      const existing = groups.get(key)
      if (existing) {
        existing.push(model)
      } else {
        groups.set(key, [model])
      }
    }
    return [...groups.entries()]
  }, [visibleModels])

  const emptyMessage = (() => {
    if (modelOptions.length === 0) {
      return "No models loaded."
    }
    if (statusFilter === "enabled" && enabledCount === 0) {
      return "No models enabled."
    }
    if (visibleModels.length === 0) {
      return "No models match your search."
    }
    return null
  })()

  return (
    <SettingsPane
      title="LLM Models"
      description={`Enable models available in chat. ${enabledCount} enabled of ${modelOptions.length}.`}
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
      <div
        className="flex flex-wrap gap-1"
        role="group"
        aria-label="Filter models by status"
      >
        {(
          [
            { id: "all", label: "All" },
            { id: "enabled", label: `Enabled (${enabledCount})` },
            {
              id: "disabled",
              label: `Disabled (${Math.max(modelOptions.length - enabledCount, 0)})`,
            },
          ] as const
        ).map((option) => (
          <button
            key={option.id}
            type="button"
            className={cn(
              "h-7 rounded-full px-2.5 text-[11px] font-medium transition-colors",
              statusFilter === option.id
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
            )}
            aria-pressed={statusFilter === option.id}
            onClick={() => setStatusFilter(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

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

      <div className="flex flex-col gap-3" data-testid="runtime-models-list">
        {emptyMessage ? (
          <p className="px-1 py-6 text-center text-xs text-pretty text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          groupedModels.map(([provider, models]) => (
            <div key={provider} className="flex flex-col gap-1.5">
              <div className="px-1 text-xs font-medium text-muted-foreground">
                {formatProviderLabel(provider)}
              </div>
              {models.map((model) => {
                const enabled = isModelEnabled(model, draft?.enabledModels)
                return (
                  <ItemRow
                    key={model.id}
                    icon={<ProviderBrandIcon provider={model.provider} />}
                    title={model.name}
                    subtitle={`${formatProviderLabel(model.provider)} · ${model.modelId}`}
                    trailing={
                      <Switch
                        aria-label={`${enabled ? "Disable" : "Enable"} ${model.name}`}
                        checked={enabled}
                        disabled={disabled}
                        onCheckedChange={(checked) =>
                          onModelToggle(model, checked)
                        }
                      />
                    }
                  />
                )
              })}
            </div>
          ))
        )}
      </div>
    </SettingsPane>
  )
}
