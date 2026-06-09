import { Activity, Loader2 } from "lucide-react"
import { Badge } from "../../../../badge"
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
      <div className="space-y-2.5 rounded-[10px] border border-border/40 bg-background/30 p-3 shadow-lg backdrop-blur-md">
        <div className="flex min-w-0 items-start gap-2">
          <div className="rounded-md border border-border/20 bg-foreground/5 p-1 text-foreground/50 shadow-sm">
            <Activity className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold tracking-wide text-foreground/80">
              System Core Telemetry
            </div>
            <p className="text-[10px] leading-relaxed text-foreground/45">
              Live observability monitors for active streaming controllers,
              prompts backlog, and workspace settings.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="group flex flex-col rounded-[8px] border border-border/20 bg-foreground/[0.015] p-2 transition-all duration-200 hover:-translate-y-[1px] hover:border-border/45 hover:bg-foreground/[0.035] hover:shadow-sm">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[10px] font-bold tracking-wide text-foreground/50 uppercase">
                Core Request
              </span>
              {runtimeStatus === "Streaming" ? (
                <Badge variant="default" className="gap-1.5 shadow-sm">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-background opacity-75"></span>
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-background"></span>
                  </span>
                  Streaming
                </Badge>
              ) : runtimeStatus === "Submitting" ? (
                <Badge variant="secondary" className="gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground opacity-75"></span>
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-foreground"></span>
                  </span>
                  Submitting
                </Badge>
              ) : runtimeStatus === "Error" ? (
                <Badge variant="destructive">Error</Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="gap-1.5 border-primary/20 bg-primary/10 text-primary"
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary"></span>
                  </span>
                  Ready
                </Badge>
              )}
            </div>
            <p className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-foreground/40 transition-colors group-hover:text-foreground/60">
              {activityLabel ?? "Idle and waiting for the next prompt."}
            </p>
          </div>

          <div className="group flex flex-col rounded-[8px] border border-border/20 bg-foreground/[0.015] p-2 transition-all duration-200 hover:-translate-y-[1px] hover:border-border/45 hover:bg-foreground/[0.035] hover:shadow-sm">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[10px] font-bold tracking-wide text-foreground/50 uppercase">
                Prompts Queue
              </span>
              {isQueueActive ? (
                <Badge variant="secondary" className="gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground opacity-75"></span>
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-foreground"></span>
                  </span>
                  Active ({queue.followUp.length + queue.steering.length})
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-transparent bg-foreground/5 text-foreground/50"
                >
                  Idle
                </Badge>
              )}
            </div>
            <p className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-foreground/40 transition-colors group-hover:text-foreground/60">
              {queueDescription}
            </p>
          </div>

          <div className="group flex flex-col rounded-[8px] border border-border/20 bg-foreground/[0.015] p-2 transition-all duration-200 hover:-translate-y-[1px] hover:border-border/45 hover:bg-foreground/[0.035] hover:shadow-sm">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[10px] font-bold tracking-wide text-foreground/50 uppercase">
                Plan Context
              </span>
              {mode === "plan" ? (
                <Badge variant="default" className="gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-background opacity-75"></span>
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-background"></span>
                  </span>
                  Planning
                </Badge>
              ) : mode === "harness" ? (
                <Badge
                  variant="outline"
                  className="border-primary/20 bg-primary/10 text-primary"
                >
                  Harness
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-transparent bg-foreground/5 text-foreground/50"
                >
                  Agent
                </Badge>
              )}
            </div>
            <p className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-foreground/40 transition-colors group-hover:text-foreground/60">
              {planLabel ??
                (mode === "plan"
                  ? "Planning Turn: Streaming steps proposal."
                  : mode === "harness"
                    ? "Harness Turn: Sandbox active."
                    : "Autonomous coding execution active.")}
            </p>
          </div>

          <div className="group flex flex-col rounded-[8px] border border-border/20 bg-foreground/[0.015] p-2 transition-all duration-200 hover:-translate-y-[1px] hover:border-border/45 hover:bg-foreground/[0.035] hover:shadow-sm">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[10px] font-bold tracking-wide text-foreground/50 uppercase">
                Settings Sync
              </span>
              {settingsError ? (
                <Badge variant="destructive">Error</Badge>
              ) : settingsLoading ? (
                <Badge variant="outline" className="gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading
                </Badge>
              ) : (
                <Badge variant="default" className="shadow-sm">
                  Synced
                </Badge>
              )}
            </div>
            <p className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-foreground/40 transition-colors group-hover:text-foreground/60">
              {settingsError
                ? settingsError.message
                : settings
                  ? `Active config loaded from ${settings.projectPath.replace(/^.*\/fleet-pi\//, "")}`
                  : "Resolving active project-scoped Pi properties..."}
            </p>
          </div>
        </div>
      </div>
    </ConfigurationSection>
  )
}
