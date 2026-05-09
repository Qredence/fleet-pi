import {
  Bot,
  Cable,
  Cpu,
  Monitor,
  Moon,
  Palette,
  Sun,
  Wrench,
} from "lucide-react"
import { useEffect, useState } from "react"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import type { ChatThinkingLevel } from "@/lib/pi/chat-protocol"
import type { ThemePreference } from "@/lib/canvas-utils"

export type ConfigModelInfo = {
  id: string
  name: string
  provider: string
  modelId: string
  version?: string
  reasoning?: boolean
  available?: boolean
  thinkingLevel?: ChatThinkingLevel
}

export function ConfigurationsPanelContent({
  models,
  onThemePreferenceChange,
  themePreference,
}: {
  models: Array<ConfigModelInfo>
  onThemePreferenceChange: (preference: ThemePreference) => void
  themePreference: ThemePreference
}) {
  const [allowedModelIds, setAllowedModelIds] = useState<Set<string>>(
    () => new Set(models.map((model) => model.id))
  )

  useEffect(() => {
    setAllowedModelIds((current) => {
      const next = new Set(current)
      for (const model of models) next.add(model.id)
      return next
    })
  }, [models])

  const toggleModel = (modelId: string, checked: boolean) => {
    setAllowedModelIds((current) => {
      const next = new Set(current)
      if (checked) next.add(modelId)
      else next.delete(modelId)
      return next
    })
  }

  return (
    <div className="space-y-3" data-testid="configurations-tab">
      <ConfigurationSection icon={Wrench} label="Tools">
        <ConfigurationRow
          action="Coming soon"
          description="Add Pi tools and project extensions to the active workspace."
          status="UI draft"
          title="Add tools"
        />
        <ConfigurationRow
          action="Manage"
          description="Review enabled coding, planning, research, and context tools."
          status="Local"
          title="Tool policy"
        />
      </ConfigurationSection>

      <ConfigurationSection icon={Cable} label="Connectors">
        <ConfigurationRow
          action="Add"
          description="Prepare external connectors such as GitHub, Linear, Drive, and Slack."
          status="UI draft"
          title="Connector catalog"
        />
      </ConfigurationSection>

      <ConfigurationSection icon={Cpu} label="LLM Providers">
        <ConfigurationRow
          action="Manage"
          description="Amazon Bedrock is the current provider; additional providers can be configured later."
          status="Active"
          title="Amazon Bedrock"
        />
        <ConfigurationRow
          action="Add"
          description="Reserve space for OpenAI-compatible, local, or custom provider entries."
          status="UI draft"
          title="Provider setup"
        />
      </ConfigurationSection>

      <ConfigurationSection icon={Palette} label="Personalization">
        <div className="rounded-[8px] border border-border/60 bg-foreground/2 px-2.5 py-2">
          <div className="mb-2 flex min-w-0 items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium text-foreground/75">
                Theme
              </div>
              <p className="mt-0.5 text-[11px] leading-4 text-foreground/40">
                Choose Light, Dark, or follow the system appearance.
              </p>
            </div>
          </div>
          <div className="flex rounded-[7px] bg-foreground/5 p-0.5">
            <ThemeSegment
              active={themePreference === "light"}
              icon={Sun}
              label="Light"
              onClick={() => onThemePreferenceChange("light")}
            />
            <ThemeSegment
              active={themePreference === "dark"}
              icon={Moon}
              label="Dark"
              onClick={() => onThemePreferenceChange("dark")}
            />
            <ThemeSegment
              active={themePreference === "system"}
              icon={Monitor}
              label="System"
              onClick={() => onThemePreferenceChange("system")}
            />
          </div>
        </div>
      </ConfigurationSection>

      <ConfigurationSection icon={Bot} label="Allowed Models">
        {models.length === 0 ? (
          <div className="rounded-[6px] px-2 py-1.5 text-[12px] text-foreground/35">
            No models loaded.
          </div>
        ) : (
          <div
            className="space-y-1 pr-1 lg:max-h-100 lg:overflow-y-auto"
            data-testid="allowed-models-list"
          >
            {models.map((model) => (
              <ModelAllowRow
                key={model.id}
                checked={allowedModelIds.has(model.id)}
                model={model}
                onCheckedChange={(checked) => toggleModel(model.id, checked)}
              />
            ))}
          </div>
        )}
      </ConfigurationSection>
    </div>
  )
}

function ConfigurationSection({
  children,
  icon: Icon,
  label,
}: {
  children: ReactNode
  icon: LucideIcon
  label: string
}) {
  return (
    <div className="py-1">
      <div className="mb-1 flex items-center gap-2 text-[11px] font-medium tracking-normal text-foreground/35 uppercase">
        <Icon className="size-3" />
        <span>{label}</span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function ConfigurationRow({
  action,
  description,
  status,
  title,
}: {
  action: string
  description: string
  status: string
  title: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-[8px] border border-border/60 bg-foreground/2 px-2.5 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-[12px] font-medium text-foreground/75">
            {title}
          </span>
          <span className="shrink-0 rounded-lg bg-foreground/5 px-1.5 py-0.5 text-[10px] text-foreground/35">
            {status}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-foreground/40">
          {description}
        </p>
      </div>
      <button
        type="button"
        disabled
        className="shrink-0 rounded-[6px] border border-border/60 px-2 py-1 text-[11px] font-medium text-foreground/35"
      >
        {action}
      </button>
    </div>
  )
}

function ModelAllowRow({
  checked,
  model,
  onCheckedChange,
}: {
  checked: boolean
  model: ConfigModelInfo
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <label className="flex min-w-0 items-center gap-2 rounded-[8px] border border-border/60 bg-foreground/2 px-2.5 py-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className="size-3.5 shrink-0 accent-foreground"
      />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-[12px] font-medium text-foreground/75">
            {model.name}
          </span>
          <span className="shrink-0 rounded-lg bg-foreground/5 px-1.5 py-0.5 text-[10px] text-foreground/35">
            {model.available === false ? "Unavailable" : "Available"}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[11px] leading-4 text-foreground/40">
          {model.provider} / {model.modelId}
        </p>
      </div>
    </label>
  )
}

function ThemeSegment({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: LucideIcon
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-7 min-w-0 flex-1 items-center justify-center gap-1 rounded-[6px] px-2 text-[11px] font-medium transition-colors ${
        active
          ? "bg-background text-foreground/75 shadow-sm"
          : "text-foreground/40 hover:text-foreground/65"
      }`}
    >
      <Icon className="size-3" />
      <span className="truncate">{label}</span>
    </button>
  )
}
