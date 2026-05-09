import {
  Activity,
  Bot,
  Cable,
  Cpu,
  Monitor,
  Moon,
  Palette,
  Sun,
  Wrench,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import type {
  ChatMode,
  ChatResourcesResponse,
  ChatThinkingLevel,
} from "@/lib/pi/chat-protocol"
import type { ThemePreference } from "@/lib/canvas-utils"
import type { QueueState } from "@/lib/pi/chat-fetch"
import type { ChatStatus } from "@workspace/ui/components/agent-elements/chat-types"
import { queueLabel } from "@/lib/pi/chat-helpers"

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
  activityLabel,
  mode,
  models,
  onThemePreferenceChange,
  planLabel,
  queue,
  resources,
  selectedModelKey,
  status,
  themePreference,
}: {
  activityLabel?: string
  mode: ChatMode
  models: Array<ConfigModelInfo>
  onThemePreferenceChange: (preference: ThemePreference) => void
  planLabel?: string
  queue: QueueState
  resources: ChatResourcesResponse | null
  selectedModelKey?: string
  status: ChatStatus
  themePreference: ThemePreference
}) {
  const selectedModel = models.find((model) => model.id === selectedModelKey)
  const resourceSummary = summarizeResources(resources)
  const queueDescription = queueLabel(queue) ?? "No queued prompts"
  const runtimeStatus =
    status === "streaming"
      ? "Streaming"
      : status === "submitted"
        ? "Submitting"
        : status === "error"
          ? "Error"
          : "Ready"

  return (
    <div className="space-y-3" data-testid="configurations-tab">
      <ConfigurationSection icon={Activity} label="Runtime">
        <ConfigurationRow
          description={activityLabel ?? "Idle and waiting for the next prompt."}
          status={runtimeStatus}
          title="Request status"
        />
        <ConfigurationRow
          description={queueDescription}
          status={
            queue.followUp.length + queue.steering.length > 0
              ? "Active"
              : "Idle"
          }
          title="Prompt queue"
        />
        <ConfigurationRow
          description={
            planLabel ??
            (mode === "plan"
              ? "Plan mode is enabled and ready for the next planning turn."
              : "No active plan decision is pending.")
          }
          status={mode === "plan" ? "Plan mode" : "Agent mode"}
          title="Plan state"
        />
      </ConfigurationSection>

      <ConfigurationSection icon={Wrench} label="Tools">
        <ConfigurationRow
          description={
            mode === "plan"
              ? "Plan mode keeps the active session read-only and exposes only planning-safe tools."
              : "Agent mode enables the active session's coding tools plus approved external Pi integrations."
          }
          status={mode === "plan" ? "Plan" : "Agent"}
          title="Current mode"
        />
        <ConfigurationRow
          description={
            resourceSummary.total > 0
              ? `${resourceSummary.active} active, ${resourceSummary.staged} staged, and ${resourceSummary.reloadRequired} reload-required workspace resources are visible to the runtime.`
              : "No workspace-installed Pi resources are currently visible."
          }
          status={resourceSummary.total > 0 ? "Loaded" : "Empty"}
          title="Workspace installs"
        />
      </ConfigurationSection>

      <ConfigurationSection icon={Cable} label="Resources">
        <ConfigurationRow
          description={
            resourceSummary.total > 0
              ? `${resourceSummary.total} resources across skills, prompts, extensions, packages, themes, and context files are cataloged.`
              : "No resources are currently cataloged."
          }
          status={resourceSummary.total > 0 ? "Cataloged" : "Empty"}
          title="Resource catalog"
        />
        <ConfigurationRow
          description={
            resourceSummary.diagnostics.length > 0
              ? (resourceSummary.diagnostics[0] ??
                "Runtime diagnostics available.")
              : "No resource diagnostics were reported by the runtime."
          }
          status={
            resourceSummary.diagnostics.length > 0
              ? `${resourceSummary.diagnostics.length} notices`
              : "Clear"
          }
          title="Diagnostics"
        />
      </ConfigurationSection>

      <ConfigurationSection icon={Cpu} label="LLM Providers">
        <ConfigurationRow
          description={
            selectedModel
              ? `${selectedModel.name} is the active model for new requests in this session.`
              : "Select a model from the chat header to choose the active runtime model."
          }
          status={selectedModel ? "Active" : "Unset"}
          title={selectedModel?.provider ?? "Model selection"}
        />
        <ConfigurationRow
          description={
            selectedModel?.thinkingLevel
              ? `${selectedModel.name} defaults to ${selectedModel.thinkingLevel} thinking for this runtime.`
              : "The selected model does not advertise a default thinking level."
          }
          status={selectedModel?.reasoning ? "Reasoning" : "Standard"}
          title="Thinking profile"
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

      <ConfigurationSection icon={Bot} label="Runtime Models">
        {models.length === 0 ? (
          <div className="rounded-[6px] px-2 py-1.5 text-[12px] text-foreground/35">
            No models loaded.
          </div>
        ) : (
          <div
            className="space-y-1 pr-1 lg:max-h-100 lg:overflow-y-auto"
            data-testid="runtime-models-list"
          >
            {models.map((model) => (
              <ModelRuntimeRow
                key={model.id}
                model={model}
                selected={model.id === selectedModelKey}
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
  description,
  status,
  title,
}: {
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
    </div>
  )
}

function ModelRuntimeRow({
  model,
  selected,
}: {
  model: ConfigModelInfo
  selected: boolean
}) {
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-[8px] border border-border/60 bg-foreground/2 px-2.5 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0 truncate text-[12px] font-medium text-foreground/75">
            {model.name}
          </span>
          {selected ? (
            <StatusPill className="bg-emerald-500/10 text-emerald-200">
              Selected
            </StatusPill>
          ) : null}
          {model.reasoning ? <StatusPill>Reasoning</StatusPill> : null}
          {model.thinkingLevel ? (
            <StatusPill>Thinking {model.thinkingLevel}</StatusPill>
          ) : null}
          <span className="shrink-0 rounded-lg bg-foreground/5 px-1.5 py-0.5 text-[10px] text-foreground/35">
            {model.available === false ? "Unavailable" : "Available"}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[11px] leading-4 text-foreground/40">
          {model.provider} / {model.modelId}
        </p>
      </div>
    </div>
  )
}

function StatusPill({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={`shrink-0 rounded-lg bg-foreground/5 px-1.5 py-0.5 text-[10px] text-foreground/35 ${className ?? ""}`}
    >
      {children}
    </span>
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

function summarizeResources(resources: ChatResourcesResponse | null) {
  const catalog = resources
    ? [
        ...resources.skills,
        ...resources.prompts,
        ...resources.extensions,
        ...resources.packages,
        ...resources.themes,
        ...resources.agentsFiles,
      ]
    : []

  return {
    active: catalog.filter((item) => item.activationStatus === "active").length,
    staged: catalog.filter((item) => item.activationStatus === "staged").length,
    reloadRequired: catalog.filter(
      (item) => item.activationStatus === "reload-required"
    ).length,
    diagnostics: resources?.diagnostics ?? [],
    total: catalog.length,
  }
}
