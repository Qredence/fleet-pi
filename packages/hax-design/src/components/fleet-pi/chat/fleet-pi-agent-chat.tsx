import { useMemo } from "react"
import { AgentChat } from "../../agent-elements/agent-chat"
import { cn } from "../../agent-elements/utils/cn"
import { GenerativeTextRenderer } from "../../openui/inline-renderer"
import { PI_TOOL_RENDERERS } from "../pi/tool-renderers"
import {
  FleetPiInputBar,
  withFleetPiSuggestionStyles,
} from "./fleet-pi-input-bar"
import type { AgentChatProps } from "../../agent-elements/types"
import type { ChatStatus } from "../../agent-elements/chat-types"
import type { FleetPiInputBarProps } from "./fleet-pi-input-bar"
import type { InputBarProps } from "../../agent-elements/input-bar"

export type FleetPiAgentChatProps = Omit<
  AgentChatProps,
  "slots" | "toolRenderers" | "style" | "suggestions"
> & {
  toolRenderers?: AgentChatProps["toolRenderers"]
  suggestions?: AgentChatProps["suggestions"]
  className?: string
  inputBar: Omit<
    FleetPiInputBarProps,
    "onSend" | "onStop" | "status" | "suggestions"
  >
}

type FleetPiInputBarSlotProps = InputBarProps & {
  inputBar: FleetPiAgentChatProps["inputBar"]
  status: ChatStatus
  onStop: () => void
}

function FleetPiInputBarSlot({
  inputBar,
  status,
  onStop,
  ...props
}: FleetPiInputBarSlotProps) {
  return (
    <FleetPiInputBar {...props} {...inputBar} status={status} onStop={onStop} />
  )
}

export function FleetPiAgentChat({
  toolRenderers = PI_TOOL_RENDERERS,
  suggestions,
  status,
  onStop,
  inputBar,
  className,
  ...agentChatProps
}: FleetPiAgentChatProps) {
  const styledSuggestions = withFleetPiSuggestionStyles(suggestions)

  const slots = useMemo(
    () => ({
      TextRenderer: GenerativeTextRenderer,
      InputBar: (props: InputBarProps) => (
        <FleetPiInputBarSlot
          {...props}
          inputBar={inputBar}
          status={status}
          onStop={onStop}
        />
      ),
    }),
    [inputBar, onStop, status]
  )

  return (
    <AgentChat
      {...agentChatProps}
      className={cn("fleet-pi-agent-chat", className)}
      status={status}
      onStop={onStop}
      suggestions={styledSuggestions}
      toolRenderers={toolRenderers}
      slots={slots}
    />
  )
}
