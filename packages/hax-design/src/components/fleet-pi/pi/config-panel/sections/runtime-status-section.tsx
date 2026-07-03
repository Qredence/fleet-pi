import { Activity, Loader2 } from "lucide-react"
import { Badge } from "../../../../badge"
import { RowSurface, SectionSurface } from "../../../primitives/surface"
import { ConfigurationSection } from "../shared/fields"
import type {
  ChatMode,
  ChatSettingsResponse,
  QueueState,
} from "../../../../../lib/pi/chat-protocol"

export function RuntimeStatusSection({
  activityLabel,
  mode,
  planLabel,
  queue,
  queueDescription,
  runtimeStatus,
  settings,
  settingsError,
  settingsLoading,
}: {
  activityLabel?: string
  mode: ChatMode
  planLabel?: string
  queue: QueueState
  queueDescription: string
  runtimeStatus: string
  settings: ChatSettingsResponse | null
  settingsError: Error | null
  settingsLoading: boolean
}) {
  const isQueueActive = queue.followUp.length + queue.steering.length > 0

  return (
    <ConfigurationSection icon={Activity} label="Runtime">
      <SectionSurface
        elevation="raised"
        padding="compact"
        className="space-y-3"
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="shrink-0 rounded-lg border border-border/15 bg-foreground/5 p-1.5 text-foreground/50 shadow-sm transition-transform duration-300 hover:scale-105">
            <Activity className="h-4 w-4 text-foreground/60" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-bold tracking-wide text-foreground/80">
              System Core Telemetry
            </div>
            <p className="text-[10px] leading-relaxed text-foreground/45">
              Live observability monitors for active streaming controllers,
              prompts backlog, and workspace settings.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Core Request Status */}
          <RowSurface
            tone="muted"
            interactive="lift"
            className="group flex-col rounded-[8px] p-3"
          >
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[9.5px] font-bold tracking-wide text-foreground/45 uppercase">
                Core Request
              </span>
              {runtimeStatus === "Streaming" ? (
                <Badge
                  variant="outline"
                  className="gap-1.5 border-amber-500/25 bg-amber-500/8 font-semibold text-amber-600 shadow-sm dark:text-amber-400"
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75"></span>
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                  </span>
                  Streaming
                </Badge>
              ) : runtimeStatus === "Submitting" ? (
                <Badge
                  variant="outline"
                  className="gap-1.5 border-violet-500/25 bg-violet-500/8 font-semibold text-violet-600 shadow-sm dark:text-violet-400"
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-500 opacity-75"></span>
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-500"></span>
                  </span>
                  Submitting
                </Badge>
              ) : runtimeStatus === "Error" ? (
                <Badge
                  variant="destructive"
                  className="font-semibold shadow-sm"
                >
                  Error
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="gap-1.5 border-emerald-500/25 bg-emerald-500/8 font-semibold text-emerald-600 shadow-sm dark:text-emerald-400"
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75"></span>
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  </span>
                  Ready
                </Badge>
              )}
            </div>
            <p className="mt-2 line-clamp-2 text-[10px] leading-snug text-foreground/40 transition-colors group-hover:text-foreground/60">
              {activityLabel ?? "Idle and waiting for the next prompt."}
            </p>
          </RowSurface>

          {/* Prompts Queue Status */}
          <RowSurface
            tone="muted"
            interactive="lift"
            className="group flex-col rounded-[8px] p-3"
          >
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[9.5px] font-bold tracking-wide text-foreground/45 uppercase">
                Prompts Queue
              </span>
              {isQueueActive ? (
                <Badge
                  variant="outline"
                  className="gap-1.5 border-sky-500/25 bg-sky-500/8 font-semibold text-sky-600 shadow-sm dark:text-sky-400"
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-500 opacity-75"></span>
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-500"></span>
                  </span>
                  Active ({queue.followUp.length + queue.steering.length})
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-transparent bg-foreground/5 font-medium text-foreground/40"
                >
                  Idle
                </Badge>
              )}
            </div>
            <p className="mt-2 line-clamp-2 text-[10px] leading-snug text-foreground/40 transition-colors group-hover:text-foreground/60">
              {queueDescription}
            </p>
          </RowSurface>

          {/* Plan Context Status */}
          <RowSurface
            tone="muted"
            interactive="lift"
            className="group flex-col rounded-[8px] p-3"
          >
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[9.5px] font-bold tracking-wide text-foreground/45 uppercase">
                Plan Context
              </span>
              {mode === "plan" ? (
                <Badge
                  variant="outline"
                  className="gap-1.5 border-pink-500/25 bg-pink-500/8 font-semibold text-pink-600 shadow-sm dark:text-pink-400"
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pink-500 opacity-75"></span>
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-pink-500"></span>
                  </span>
                  Planning
                </Badge>
              ) : mode === "harness" ? (
                <Badge
                  variant="outline"
                  className="border-teal-500/20 bg-teal-500/8 font-semibold text-teal-600 shadow-sm dark:text-teal-400"
                >
                  Harness
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-transparent bg-foreground/5 font-medium text-foreground/40"
                >
                  Agent
                </Badge>
              )}
            </div>
            <p className="mt-2 line-clamp-2 text-[10px] leading-snug text-foreground/40 transition-colors group-hover:text-foreground/60">
              {planLabel ??
                (mode === "plan"
                  ? "Planning Turn: Streaming steps proposal."
                  : mode === "harness"
                    ? "Harness Turn: Sandbox active."
                    : "Autonomous coding execution active.")}
            </p>
          </RowSurface>

          {/* Settings Sync Status */}
          <RowSurface
            tone="muted"
            interactive="lift"
            className="group flex-col rounded-[8px] p-3"
          >
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[9.5px] font-bold tracking-wide text-foreground/45 uppercase">
                Settings Sync
              </span>
              {settingsError ? (
                <Badge
                  variant="destructive"
                  className="font-semibold shadow-sm"
                >
                  Error
                </Badge>
              ) : settingsLoading ? (
                <Badge
                  variant="outline"
                  className="gap-1.5 border-foreground/10 bg-foreground/5 font-medium text-foreground/50"
                >
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  Loading
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-emerald-500/20 bg-emerald-500/8 font-semibold text-emerald-600 shadow-sm dark:text-emerald-400"
                >
                  Synced
                </Badge>
              )}
            </div>
            <p className="mt-2 line-clamp-2 font-mono text-[9px] leading-snug tracking-tight text-foreground/40 transition-colors group-hover:text-foreground/60">
              {settingsError
                ? settingsError.message
                : settings
                  ? `pi/settings.json [${settings.projectPath.replace(/^.*\/fleet-pi\//, "")}]`
                  : "Resolving active project-scoped Pi properties..."}
            </p>
          </RowSurface>
        </div>
      </SectionSurface>
    </ConfigurationSection>
  )
}
