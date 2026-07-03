import {
  Bot,
  Check,
  Cpu,
  Info,
  PlugZap,
  Plus,
  Power,
  PowerOff,
  Search,
  Trash2,
  Wrench,
} from "lucide-react"
import { useState } from "react"
import { Button } from "../../../../button"
import { Input } from "../../../../input"
import { Select } from "../../../../select"
import { Switch } from "../../../../switch"
import { Badge } from "../../../../badge"
import { cn } from "../../../../../lib/utils"
import { COMPACT_ACTION_BUTTON_CLASS } from "../../../styles/tokens"
import { SectionSurface } from "../../../primitives/surface"
import { FIELD_CONTROL_CLASS } from "./constants"
import { FieldLabel } from "./fields"
import { isModelEnabled } from "./model-patterns"
import { PROVIDER_METADATA } from "./provider-metadata"
import { addUnique } from "./settings-mappers"
import type { ConfigModelInfo, ProviderSummary } from "./types"

export function DefaultModelSummary({
  model,
  provider,
}: {
  model?: ConfigModelInfo
  provider?: string
}) {
  const meta = provider ? PROVIDER_METADATA[provider] : null
  const IconComponent = meta?.icon ?? Bot
  const hasReasoning = model?.reasoning === true

  return (
    <div className="group relative flex min-w-0 items-center gap-3 rounded-[10px] border border-border/35 border-l-primary/70 bg-gradient-to-br from-background/70 to-background/35 p-2.5 shadow-sm transition-all duration-300 hover:-translate-y-px hover:border-border/45 hover:border-l-primary hover:bg-background/80 hover:shadow-md">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border transition-all duration-300",
          "border-primary/20 bg-primary/5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] group-hover:scale-105 group-hover:border-primary/30"
        )}
      >
        <IconComponent
          className={cn(
            "h-4.5 w-4.5 transition-transform duration-300 group-hover:rotate-12",
            "text-primary"
          )}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-bold tracking-wide text-foreground/85">
          {model?.name ?? model?.modelId ?? "No active default model"}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 leading-none">
          <span className="truncate font-mono text-[9.5px] font-semibold tracking-tight text-foreground/45">
            {provider && model
              ? `${provider}/${model.modelId}`
              : "Choose a default model below"}
          </span>
          {hasReasoning && (
            <Badge
              variant="secondary"
              className="h-4 border border-border/10 px-1.5 text-[9px] leading-none font-medium shadow-none"
            >
              Reasoning
            </Badge>
          )}
          {model?.available !== false && (
            <Badge
              variant="outline"
              className="h-4 border-primary/20 bg-primary/10 px-1.5 text-[9px] leading-none font-semibold text-primary"
            >
              Stream
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}

export function ProviderManagementList({
  defaultProvider,
  onConnect,
  onDefault,
  onToggle,
  providers,
}: {
  defaultProvider?: string
  onConnect: (provider: string) => void
  onDefault: (provider: string) => void
  onToggle: (provider: string, enabled: boolean) => void
  providers: Array<ProviderSummary>
}) {
  if (providers.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] font-bold tracking-wide text-foreground/45 uppercase">
        Providers Network
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {providers.map((provider) => {
          const active = provider.active > 0
          const isDefault = provider.provider === defaultProvider
          const meta = PROVIDER_METADATA[provider.provider] ?? {
            icon: Cpu,
          }
          const IconComponent = meta.icon

          return (
            <div
              key={provider.provider}
              className={cn(
                "flex min-w-0 items-center gap-2.5 rounded-[10px] border border-border/30 bg-background/40 p-2.5 transition-all duration-300 hover:-translate-y-px hover:border-border/45 hover:bg-foreground/2 hover:shadow-md",
                isDefault && "border-primary/45 bg-primary/[0.015] shadow-sm"
              )}
            >
              <div className="flex shrink-0 items-center gap-2">
                <Switch
                  aria-label={`Activate provider ${provider.provider}`}
                  checked={active}
                  onCheckedChange={(checked) =>
                    onToggle(provider.provider, checked)
                  }
                  className="scale-90"
                />
                <div className="relative">
                  <div
                    className={cn(
                      "flex h-7.5 w-7.5 items-center justify-center rounded-[6px] border border-border/20 bg-background/50 text-foreground/50 transition-all duration-300",
                      active && "border-primary/20 bg-primary/5"
                    )}
                  >
                    <IconComponent
                      className={cn(
                        "h-3.5 w-3.5",
                        active ? "text-primary" : "text-foreground/35"
                      )}
                    />
                  </div>
                  {active && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    </span>
                  )}
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[11.5px] leading-none font-bold text-foreground/80">
                    {provider.provider}
                  </span>
                  {isDefault && (
                    <Badge variant="default" className="shadow-sm">
                      Default
                    </Badge>
                  )}
                </div>
                <div className="mt-1 flex flex-col gap-1">
                  <div className="flex items-center justify-between font-mono text-[9px] leading-none text-foreground/45">
                    <span>
                      {provider.active} / {provider.total} active
                    </span>
                    <span>
                      {Math.round(
                        (provider.active / Math.max(provider.total, 1)) * 100
                      )}
                      %
                    </span>
                  </div>
                  <div className="relative h-1 w-full overflow-hidden rounded-full bg-muted/40">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        active ? "bg-primary" : "bg-muted-foreground/30"
                      )}
                      style={{
                        width: `${(provider.active / Math.max(provider.total, 1)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="h-6 w-6 rounded-[5px] text-foreground/35 transition-all duration-200 hover:bg-foreground/5 hover:text-foreground/60"
                  onClick={() => onConnect(provider.provider)}
                  title="Prepare custom model for this provider"
                  aria-label={`Connect provider ${provider.provider}`}
                >
                  <PlugZap className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-6 rounded-[5px] px-2 text-[10px] text-foreground/45 transition-all duration-200 hover:bg-foreground/5 hover:text-foreground/75",
                    isDefault && "cursor-not-allowed opacity-30"
                  )}
                  disabled={isDefault}
                  onClick={() => onDefault(provider.provider)}
                >
                  Use
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function PathListField({
  addLabel,
  label,
  onChange,
  values,
}: {
  addLabel: string
  label: string
  onChange: (values: Array<string>) => void
  values: Array<string>
}) {
  return (
    <FieldLabel label={label}>
      <StringListEditor
        addLabel={addLabel}
        emptyLabel={`No ${label.toLowerCase()} configured.`}
        placeholder="../agent-workspace/pi/path"
        values={values}
        onChange={onChange}
      />
    </FieldLabel>
  )
}

export function StringListEditor({
  addLabel,
  emptyLabel,
  onChange,
  placeholder,
  values,
}: {
  addLabel: string
  emptyLabel: string
  onChange: (values: Array<string>) => void
  placeholder?: string
  values: Array<string>
}) {
  const [newValue, setNewValue] = useState("")
  const rows = values.length > 0 ? values : []

  const updateRow = (index: number, value: string) => {
    const next = rows.map((item, itemIndex) =>
      itemIndex === index ? value : item
    )
    onChange(next)
  }

  const removeRow = (index: number) => {
    onChange(rows.filter((_, itemIndex) => itemIndex !== index))
  }

  const addRow = () => {
    const trimmed = newValue.trim()
    if (!trimmed) return
    onChange(addUnique(rows, trimmed))
    setNewValue("")
  }

  return (
    <div className="space-y-2">
      {rows.length > 0 ? (
        <div className="space-y-1.5 rounded-lg border border-border/20 bg-background/15 p-2">
          {rows.map((value, index) => {
            const displayIndex = String(index + 1).padStart(2, "0")
            return (
              <div
                key={`${value}-${index}`}
                className="group flex min-w-0 items-center gap-2 rounded-md border border-border/20 bg-background/40 px-2 py-0.5 shadow-sm transition-all duration-200 hover:border-border/30 hover:bg-background/55"
              >
                <span className="shrink-0 font-mono text-[10px] font-bold text-foreground/25 transition-colors select-none group-hover:text-foreground/45">
                  {displayIndex}
                </span>
                <Input
                  aria-label={`${addLabel} ${index + 1}`}
                  value={value}
                  onChange={(event) => updateRow(index, event.target.value)}
                  className={cn(
                    FIELD_CONTROL_CLASS,
                    "h-7 flex-1 border-transparent bg-transparent px-1 font-mono text-[11px] leading-none text-foreground/75 transition-all duration-150 placeholder:text-foreground/20 focus-visible:border-border/30 focus-visible:bg-background/30 focus-visible:ring-0"
                  )}
                />
                <button
                  type="button"
                  aria-label={`Remove ${value || "row"}`}
                  title="Remove"
                  className="flex h-5.5 w-5.5 shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground/30 transition-all duration-200 hover:bg-red-500/10 hover:text-red-400 hover:shadow-[0_0_8px_rgba(239,68,68,0.25)]"
                  onClick={() => removeRow(index)}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-1.5 rounded-[8px] border border-dashed border-border/25 bg-background/5 px-3 py-4 text-center">
          <Info className="h-4 w-4 text-foreground/25" />
          <span className="text-[11px] leading-relaxed font-semibold text-foreground/35">
            {emptyLabel}
          </span>
        </div>
      )}
      <div className="group/add flex min-w-0 items-center gap-1.5">
        <Input
          aria-label={addLabel}
          value={newValue}
          onChange={(event) => setNewValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              addRow()
            }
          }}
          placeholder={placeholder}
          className={cn(FIELD_CONTROL_CLASS, "font-mono text-[11px]")}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(COMPACT_ACTION_BUTTON_CLASS, "group")}
          onClick={addRow}
          disabled={!newValue.trim()}
        >
          <Plus className="mr-1 h-3.5 w-3.5 text-foreground/60 transition-transform duration-300 group-hover/add:rotate-90" />
          Add
        </Button>
      </div>
    </div>
  )
}

export function ModelActivationList({
  defaultModel,
  defaultProvider,
  enabledPatterns,
  filter,
  models,
  onDefault,
  onFilterChange,
  onProviderFilterChange,
  onSetAll,
  onToggle,
  onUseRecommended,
  providerFilter,
  providers,
}: {
  defaultModel?: string
  defaultProvider?: string
  enabledPatterns?: Array<string>
  filter: string
  models: Array<ConfigModelInfo>
  onDefault: (model: ConfigModelInfo) => void
  onFilterChange: (value: string) => void
  onProviderFilterChange: (value: string) => void
  onSetAll: (enabled: boolean) => void
  onToggle: (model: ConfigModelInfo, enabled: boolean) => void
  onUseRecommended: () => void
  providerFilter: string
  providers: Array<ProviderSummary>
}) {
  if (models.length === 0) return null

  const normalizedFilter = filter.trim().toLowerCase()
  const visibleModels = models.filter((model) => {
    const providerMatch =
      providerFilter === "all" || model.provider === providerFilter
    const textMatch =
      !normalizedFilter ||
      [model.name, model.modelId, model.provider, model.id]
        .join(" ")
        .toLowerCase()
        .includes(normalizedFilter)
    return providerMatch && textMatch
  })
  const activeCount = models.filter((model) =>
    isModelEnabled(model, enabledPatterns)
  ).length

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex min-w-0 items-center justify-between gap-2 border-b border-border/10 pb-1.5">
        <div className="text-[11px] font-bold tracking-wide text-foreground/45 uppercase">
          Model Routing Registry
        </div>
        <Badge
          variant="default"
          className="font-mono text-[9px] tracking-tight shadow-sm"
        >
          {activeCount} / {models.length} Activated
        </Badge>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-1.5 rounded-lg border border-border/15 bg-foreground/1.5 p-1 shadow-inner">
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 h-3 w-3 text-foreground/30" />
          <Input
            aria-label="Search models"
            value={filter}
            onChange={(event) => onFilterChange(event.target.value)}
            placeholder="Search model ID or brand..."
            className={cn(
              FIELD_CONTROL_CLASS,
              "w-full border-border/25 bg-background/50 pl-7.5 hover:border-border/40 focus-visible:ring-primary/15"
            )}
          />
        </div>
        <Select
          aria-label="Filter provider"
          value={providerFilter}
          onValueChange={onProviderFilterChange}
          className={cn(
            FIELD_CONTROL_CLASS,
            "border-border/25 bg-background/50 font-semibold focus-visible:ring-primary/15"
          )}
          options={[
            { label: "All Providers", value: "all" },
            ...providers.map((p) => ({
              label: p.provider,
              value: p.provider,
            })),
          ]}
        />
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7.5 cursor-pointer rounded-[6px] border-border/35 bg-background/40 font-mono text-[10px] font-semibold text-foreground/60 transition-all duration-200 hover:-translate-y-[1px] hover:border-border/50 hover:bg-foreground/5 hover:text-foreground active:translate-y-0"
          onClick={() => onSetAll(true)}
        >
          <Power className="mr-1.5 h-3 w-3 text-foreground/45" />
          Enable All
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7.5 cursor-pointer rounded-[6px] border-border/35 bg-background/40 font-mono text-[10px] font-semibold text-foreground/60 transition-all duration-200 hover:-translate-y-[1px] hover:border-border/50 hover:bg-foreground/5 hover:text-foreground active:translate-y-0"
          onClick={() => onSetAll(false)}
        >
          <PowerOff className="mr-1.5 h-3 w-3 text-foreground/45" />
          Disable All
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7.5 cursor-pointer rounded-[6px] border-border/35 bg-background/40 font-mono text-[10px] font-semibold text-foreground/60 transition-all duration-200 hover:-translate-y-[1px] hover:border-border/50 hover:bg-foreground/5 hover:text-foreground active:translate-y-0"
          onClick={onUseRecommended}
        >
          <Check className="mr-1.5 h-3 w-3 text-foreground/45" />
          Recommended
        </Button>
      </div>

      <div
        className="max-h-80 scrollbar-thin scrollbar-thumb-foreground/10 space-y-1.5 overflow-y-auto pr-1"
        data-testid="runtime-models-list"
      >
        {visibleModels.length === 0 ? (
          <div className="rounded-[8px] border border-dashed border-border/25 bg-background/10 px-3 py-4 text-center text-[11px] leading-relaxed text-foreground/35">
            No models found matching the search criteria.
          </div>
        ) : null}
        {visibleModels.map((model) => {
          const active = isModelEnabled(model, enabledPatterns)
          const isDefault =
            model.provider === defaultProvider && model.modelId === defaultModel

          return (
            <div
              key={model.id}
              className={cn(
                "group flex min-w-0 items-center gap-2.5 rounded-[10px] border border-border/25 bg-background/40 px-2.5 py-2 transition-all duration-300",
                "hover:translate-x-0.5 hover:border-border/45 hover:bg-foreground/2",
                isDefault &&
                  "border-l-[3px] border-primary/30 border-l-primary bg-primary/[0.015] shadow-sm"
              )}
            >
              <Switch
                aria-label={`Activate ${model.name}`}
                checked={active}
                onCheckedChange={(checked) => onToggle(model, checked)}
                className="scale-90"
              />

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[11.5px] leading-tight font-bold text-foreground/80">
                    {model.name}
                  </span>
                  {isDefault && (
                    <Badge variant="default" className="shadow-sm">
                      Default
                    </Badge>
                  )}
                  {model.reasoning && (
                    <Badge variant="secondary" className="gap-0.5 shadow-sm">
                      Reason
                    </Badge>
                  )}
                  {model.available !== false && (
                    <Badge
                      variant="outline"
                      className="h-4 border-primary/20 bg-primary/10 px-1 text-[8.5px] leading-none text-primary"
                    >
                      Stream
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 truncate font-mono text-[9.5px] leading-none tracking-tight text-foreground/40">
                  <span className={cn("font-bold", "text-primary/70")}>
                    {model.provider}
                  </span>{" "}
                  / {model.modelId}
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-6.5 shrink-0 rounded-[5px] px-2 text-[10px] text-foreground/45 transition-all duration-250 hover:bg-foreground/5 hover:text-foreground/75",
                  isDefault && "cursor-not-allowed opacity-30"
                )}
                disabled={isDefault}
                onClick={() => onDefault(model)}
              >
                Use
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function CustomModelEditor({
  model,
  onModelChange,
  onProviderChange,
  onUse,
  provider,
  providers,
}: {
  model: string
  onModelChange: (value: string) => void
  onProviderChange: (value: string) => void
  onUse: () => void
  provider: string
  providers: Array<string>
}) {
  return (
    <SectionSurface elevation="quiet" className="space-y-2.5">
      <div className="flex items-center gap-1.5">
        <Wrench className="h-3.5 w-3.5 text-foreground/50" />
        <span className="text-[11.5px] font-semibold tracking-wide text-foreground/75">
          Connect Custom Endpoint
        </span>
      </div>
      <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_auto] items-end gap-1.5">
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-medium tracking-wider text-foreground/45 uppercase">
            Provider
          </label>
          <Input
            aria-label="Custom provider"
            value={provider}
            onChange={(event) => onProviderChange(event.target.value)}
            className={cn(
              FIELD_CONTROL_CLASS,
              "border-border/25 bg-background/50 font-mono text-[11px] hover:border-border/40 focus-visible:ring-primary/15"
            )}
            placeholder="e.g. openrouter"
            list="pi-config-providers"
          />
          <datalist id="pi-config-providers">
            {providers.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-medium tracking-wider text-foreground/45 uppercase">
            Model Identifier
          </label>
          <Input
            aria-label="Custom model"
            value={model}
            onChange={(event) => onModelChange(event.target.value)}
            placeholder="e.g. deepseek/deepseek-chat"
            className={cn(
              FIELD_CONTROL_CLASS,
              "border-border/25 bg-background/50 font-mono text-[11px] hover:border-border/40 focus-visible:ring-primary/15"
            )}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            COMPACT_ACTION_BUTTON_CLASS,
            "group/connect h-7.5 border-border/35 hover:border-border/50 hover:bg-foreground/5"
          )}
          onClick={onUse}
          disabled={!provider.trim() || !model.trim()}
        >
          <Plus className="mr-1 h-3.5 w-3.5 text-foreground/60 transition-transform duration-300 group-hover/connect:rotate-90" />
          Connect
        </Button>
      </div>
      <div className="flex items-start gap-1.5 rounded border border-border/10 bg-foreground/1.5 p-2 text-[9.5px] leading-normal text-foreground/45">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/35" />
        <span>
          Local or self-hosted endpoint configurations. Valid model patterns are
          resolved automatically to instantiate a project-scoped session.
        </span>
      </div>
    </SectionSurface>
  )
}
