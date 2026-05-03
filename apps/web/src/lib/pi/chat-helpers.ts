import { Bot, ClipboardList } from "lucide-react"
import type { ModelOption } from "@workspace/ui/components/agent-elements/types"
import type { ChatModelInfo, ChatModelSelection } from "./chat-protocol"

export type ChatModelOption = ModelOption & {
  provider: string
  modelId: string
  available?: boolean
  reasoning?: boolean
  thinkingLevel?: ChatModelInfo["defaultThinkingLevel"]
}

export const CHAT_MODES = [
  {
    id: "agent",
    label: "Agent",
    icon: Bot,
    description: "Full tool access",
  },
  {
    id: "plan",
    label: "Plan",
    icon: ClipboardList,
    description: "Read-only planning",
  },
]

export function toModelOption(model: ChatModelInfo): ChatModelOption {
  return {
    id: model.key,
    name: model.name,
    provider: model.provider,
    modelId: model.id,
    available: model.available,
    reasoning: model.reasoning,
    thinkingLevel: model.defaultThinkingLevel,
  }
}

export function toModelSelection(
  model: ChatModelOption | undefined
): ChatModelSelection | undefined {
  if (!model) return undefined
  return {
    provider: model.provider,
    id: model.modelId,
    thinkingLevel: model.thinkingLevel,
  }
}

export function displayNameFromPath(path: string | undefined) {
  if (!path) return "Project"
  const segments = path.split(/[\\/]/).filter(Boolean)
  return segments.at(-1) ?? path
}

export function queueLabel(queue: {
  steering: Array<string>
  followUp: Array<string>
}) {
  const count = queue.followUp.length + queue.steering.length
  if (count === 0) return undefined
  if (queue.followUp.length > 0) {
    return `${queue.followUp.length} follow-up queued`
  }
  return `${queue.steering.length} steering message queued`
}
