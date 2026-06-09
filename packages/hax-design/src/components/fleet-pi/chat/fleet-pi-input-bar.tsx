import { InputBar } from "../../agent-elements/input-bar"
import { ModeSelector } from "../../agent-elements/input/mode-selector"
import { ModelPicker } from "../../agent-elements/input/model-picker"
import { CHAT_MODES } from "../../../lib/pi/chat-helpers"
import { ChatStopControl } from "./chat-stop-control"
import type { ChatMode } from "../../../lib/pi/chat-protocol"
import type { InputBarProps } from "../../agent-elements/input-bar"
import type { ChatStatus } from "../../agent-elements/chat-types"
import type { ModelOption } from "../../agent-elements/types"

const FLEET_PI_SUGGESTION_CLASSNAME = "!px-0 flex-col items-start gap-1.5"
export const FLEET_PI_SUGGESTION_ITEM_CLASSNAME =
  "h-auto justify-start rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-foreground/65 shadow-sm transition-colors hover:border-border hover:bg-foreground/6 hover:text-foreground"

export function withFleetPiSuggestionStyles(
  suggestions: InputBarProps["suggestions"]
): InputBarProps["suggestions"] {
  if (!suggestions) return suggestions

  if (Array.isArray(suggestions)) {
    return {
      items: suggestions,
      className: FLEET_PI_SUGGESTION_CLASSNAME,
      itemClassName: FLEET_PI_SUGGESTION_ITEM_CLASSNAME,
    }
  }

  return {
    ...suggestions,
    className: suggestions.className ?? FLEET_PI_SUGGESTION_CLASSNAME,
    itemClassName:
      suggestions.itemClassName ?? FLEET_PI_SUGGESTION_ITEM_CLASSNAME,
  }
}

export type FleetPiInputBarProps = Omit<
  InputBarProps,
  "leftActions" | "rightActions" | "status"
> & {
  mode: ChatMode
  modelKey: string | undefined
  models: Array<ModelOption>
  status: ChatStatus
  infoDescription?: string | null
  onModeChange: (mode: ChatMode) => void
  onModelChange: (modelKey: string) => void
}

export function FleetPiInputBar({
  mode,
  modelKey,
  models,
  status,
  infoDescription,
  suggestions,
  onModeChange,
  onModelChange,
  onStop,
  ...inputBarProps
}: FleetPiInputBarProps) {
  const displayStatus = status === "streaming" ? "ready" : status

  return (
    <InputBar
      {...inputBarProps}
      status={displayStatus}
      onStop={onStop}
      suggestions={suggestions}
      infoBar={
        infoDescription
          ? { description: infoDescription, position: "top" }
          : undefined
      }
      leftActions={
        <>
          <ModeSelector
            modes={CHAT_MODES}
            value={mode}
            onChange={(modeId) => onModeChange(modeId as ChatMode)}
          />
          <ModelPicker
            models={models}
            value={modelKey}
            onChange={onModelChange}
            placeholder="Model"
          />
        </>
      }
      rightActions={<ChatStopControl status={status} onStop={onStop} />}
    />
  )
}
