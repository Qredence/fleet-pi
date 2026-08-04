import { UiErrorBoundary } from "@workspace/hax-design/components/fleet-pi/ui-error-boundary"
import { FleetPiAgentChat } from "@workspace/hax-design/components/fleet-pi/chat/fleet-pi-agent-chat"
import type { FleetPiAgentChatProps } from "@workspace/hax-design/components/fleet-pi/chat/fleet-pi-agent-chat"
import type { ChatMessage, ChatStatus } from "@workspace/pi-protocol/chat-types"
import type { QuestionAnswer } from "@workspace/hax-design/components/agent-elements/question/question-prompt"

type ChatPanelProps = {
  messages: Array<ChatMessage>
  status: ChatStatus
  error: Error | undefined
  inputSuggestionItems: FleetPiAgentChatProps["suggestions"]
  suppressQuestionTool: boolean
  inputBar: FleetPiAgentChatProps["inputBar"]
  onSend: (text: string) => void
  onOpenUIAction: (text: string) => void
  onStop: () => void
  onQuestionAnswer: (input: {
    toolCallId?: string
    answer: QuestionAnswer
  }) => void
}

export function ChatPanel({
  messages,
  status,
  error,
  inputSuggestionItems,
  suppressQuestionTool,
  inputBar,
  onSend,
  onOpenUIAction,
  onStop,
  onQuestionAnswer,
}: ChatPanelProps) {
  return (
    <UiErrorBoundary>
      <FleetPiAgentChat
        messages={messages}
        status={status}
        onSend={(msg) => onSend(msg.content)}
        onOpenUIAction={(message) => onOpenUIAction(message)}
        onStop={onStop}
        questionTool={{
          submitLabel: "Continue",
          allowSkip: true,
          onAnswer: ({ toolCallId, answer }) => {
            void onQuestionAnswer({ toolCallId, answer })
          },
        }}
        suppressQuestionTool={suppressQuestionTool}
        error={error ?? undefined}
        emptyStatePosition="default"
        suggestions={inputSuggestionItems}
        inputBar={inputBar}
      />
    </UiErrorBoundary>
  )
}
