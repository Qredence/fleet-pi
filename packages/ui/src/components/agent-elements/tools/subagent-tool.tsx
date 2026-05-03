import { memo } from "react"
import { formatElapsedTime, getToolStatus } from "../utils/format-tool"
import { useElapsedTime } from "../hooks/use-elapsed-time"
import { cn } from "../utils/cn"
import { toolRegistry } from "./tool-registry"
import { GenericTool } from "./generic-tool"
import { ToolRowBase } from "./tool-row-base"

export type SubagentToolProps = {
  part: any
  nestedTools?: Array<any>
  chatStatus?: string
}

const MAX_VISIBLE_TOOLS = 5

export const SubagentTool = memo(function SubagentTool({
  part,
  nestedTools = [],
  chatStatus,
}: SubagentToolProps) {
  const { isPending, isInterrupted } = getToolStatus(part, chatStatus)
  const description = part.input?.description || ""
  const startedAt =
    (part.callProviderMetadata?.custom?.startedAt as number | undefined) ??
    (part.startedAt as number | undefined)
  const hasNestedTools = nestedTools.length > 0
  const outputDuration =
    part.output?.totalDurationMs ||
    part.output?.duration ||
    part.output?.duration_ms
  const elapsedMs = useElapsedTime(startedAt, isPending)

  const subtitle = (() => {
    if (isPending && hasNestedTools) {
      const lastTool = nestedTools[nestedTools.length - 1]
      const meta = lastTool ? toolRegistry[lastTool.type] : null
      if (meta) {
        const title = meta.title(lastTool)
        const nestedSubtitle = meta.subtitle?.(lastTool)
        return nestedSubtitle ? `${title} ${nestedSubtitle}` : title
      }
    }

    if (!description) return ""
    return description.length > 60
      ? `${description.slice(0, 57)}...`
      : description
  })()
  const elapsedTimeDisplay = formatElapsedTime(
    !isPending && outputDuration ? outputDuration : elapsedMs
  )

  if (isInterrupted && !part.output) {
    return (
      <ToolRowBase completeLabel="Subagent interrupted" isAnimating={false} />
    )
  }

  return (
    <div className="an-tool-task">
      <ToolRowBase
        completeLabel="Completed Subagent"
        shimmerLabel="Running Subagent"
        isAnimating={isPending}
        detail={subtitle}
        expandable={hasNestedTools}
        trailingContent={
          elapsedTimeDisplay ? (
            <span className="shrink-0 font-normal text-an-foreground-muted/60 tabular-nums">
              {elapsedTimeDisplay}
            </span>
          ) : undefined
        }
      >
        <div className="relative">
          {isPending && nestedTools.length > MAX_VISIBLE_TOOLS && (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-linear-to-b from-an-background to-transparent" />
          )}
          <div
            className={cn(
              nestedTools.length > 1 ? "space-y-2" : "space-y-0",
              isPending &&
                nestedTools.length > MAX_VISIBLE_TOOLS &&
                "max-h-[120px] overflow-y-auto"
            )}
          >
            {nestedTools.map((nestedPart, idx) => {
              const nestedMeta = toolRegistry[nestedPart.type]
              if (!nestedMeta) {
                return (
                  <ToolRowBase
                    key={idx}
                    completeLabel={
                      nestedPart.type?.replace("tool-", "") ?? "Tool"
                    }
                    isAnimating={false}
                  />
                )
              }
              const { isPending: nestedIsPending, isError: nestedIsError } =
                getToolStatus(nestedPart, chatStatus)
              return (
                <GenericTool
                  key={idx}
                  icon={nestedMeta.icon}
                  title={nestedMeta.title(nestedPart)}
                  subtitle={nestedMeta.subtitle?.(nestedPart)}
                  isPending={nestedIsPending}
                  isError={nestedIsError}
                />
              )
            })}
          </div>
        </div>
      </ToolRowBase>
    </div>
  )
})
