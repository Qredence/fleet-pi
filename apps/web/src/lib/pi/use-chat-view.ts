import { useMemo } from "react"
import type { SuggestionItem } from "@workspace/ui/components/agent-elements/input/suggestions"
import type { ChatMessage } from "@workspace/ui/components/agent-elements/chat-types"
import type {
  ChatMode,
  ChatResourcesResponse,
  ChatSessionInfo,
  WorkspaceTreeResponse,
} from "./chat-protocol"

export function useActiveSessionLabel({
  activeSessionId,
  messages,
  sessions,
}: {
  activeSessionId: string | undefined
  messages: Array<ChatMessage>
  sessions: Array<ChatSessionInfo>
}) {
  return useMemo(
    () => getActiveSessionLabel(activeSessionId, sessions, messages),
    [activeSessionId, messages, sessions]
  )
}

export function useChatSuggestions({
  messages,
  mode,
  resources,
  workspaceTree,
}: {
  messages: Array<ChatMessage>
  mode: ChatMode
  resources: ChatResourcesResponse | null
  workspaceTree: WorkspaceTreeResponse | null
}) {
  return useMemo(
    () =>
      buildContextSuggestions({
        messages,
        mode,
        resources,
        workspaceTree,
      }),
    [messages, mode, resources, workspaceTree]
  )
}

function buildContextSuggestions({
  messages,
  mode,
  resources,
  workspaceTree,
}: {
  messages: Array<ChatMessage>
  mode: ChatMode
  resources: ChatResourcesResponse | null
  workspaceTree: WorkspaceTreeResponse | null
}): Array<SuggestionItem> {
  const hasAgentsFile = Boolean(
    resources?.agentsFiles.some((file) => file.name === "AGENTS.md")
  )
  const hasFrontendSkill =
    Boolean(
      resources?.skills.some((skill) =>
        `${skill.name} ${skill.description ?? ""}`
          .toLowerCase()
          .includes("frontend")
      )
    ) ||
    Boolean(
      workspaceTree?.nodes.some((node) =>
        JSON.stringify(node).toLowerCase().includes("frontend")
      )
    )
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user")
  const lastUserText = extractMessageText(lastUserMessage).toLowerCase()

  if (mode === "plan") {
    return [
      suggestionItem("plan-codebase", "Plan a codebase walkthrough"),
      suggestionItem("plan-skill", 'Plan around the "frontend" skill'),
      suggestionItem("plan-tests", "Plan the next validation steps"),
    ]
  }

  if (mode === "harness") {
    return [
      suggestionItem(
        "harness-architecture",
        "Review agent-workspace architecture"
      ),
      suggestionItem("harness-memory", "Update project memory architecture"),
      suggestionItem("harness-pi", "Check Pi resource alignment"),
    ]
  }

  if (!lastUserText) {
    return [
      suggestionItem("overview", "Summarize this project"),
      suggestionItem(
        "frontend",
        hasFrontendSkill
          ? 'Find a skill "frontend"'
          : "Explore available skills"
      ),
      suggestionItem(
        "docs",
        hasAgentsFile ? "Read AGENTS.md" : "Tell me about this project"
      ),
    ]
  }

  if (
    lastUserText.includes("what can you do") ||
    lastUserText.includes("help")
  ) {
    return [
      suggestionItem("frontend", 'Find a skill "frontend"'),
      suggestionItem(
        "agents",
        hasAgentsFile ? "Read AGENTS.md" : "Read the repo docs"
      ),
      suggestionItem("workspace", "Show workspace files"),
    ]
  }

  if (lastUserText.includes("frontend")) {
    return [
      suggestionItem("frontend-skill", 'Find a skill "frontend"'),
      suggestionItem("frontend-route", "Read apps/web/src/routes/index.tsx"),
      suggestionItem("frontend-workspace", "Show workspace files"),
    ]
  }

  if (lastUserText.includes("skill")) {
    return [
      suggestionItem("frontend-skill", 'Find a skill "frontend"'),
      suggestionItem("memory-skill", 'Find a skill "memory"'),
      suggestionItem(
        "skill-docs",
        hasAgentsFile ? "Read AGENTS.md" : "Show workspace files"
      ),
    ]
  }

  if (lastUserText.includes("read") || lastUserText.includes("doc")) {
    return [
      suggestionItem(
        "read-agents",
        hasAgentsFile ? "Read AGENTS.md" : "Read README.md"
      ),
      suggestionItem("project-summary", "Summarize the repo conventions"),
      suggestionItem("workspace-files", "Show workspace files"),
    ]
  }

  return [
    suggestionItem("continue", "Continue from the last task"),
    suggestionItem("workspace", "Show workspace files"),
    suggestionItem("frontend", 'Find a skill "frontend"'),
  ]
}

function suggestionItem(id: string, label: string): SuggestionItem {
  return { id, label, value: label }
}

function extractMessageText(message: ChatMessage | undefined) {
  if (!message) return ""

  return message.parts
    .filter(
      (
        part
      ): part is Extract<(typeof message.parts)[number], { type: "text" }> =>
        part.type === "text" && typeof part.text === "string"
    )
    .map((part) => part.text)
    .join(" ")
}

function getActiveSessionLabel(
  activeSessionId: string | undefined,
  sessions: Array<ChatSessionInfo>,
  messages: Array<ChatMessage>
) {
  const activeSession = sessions.find(
    (session) => session.id === activeSessionId
  )
  if (activeSession) {
    return (
      activeSession.name ||
      activeSession.firstMessage ||
      activeSession.id.slice(0, 8)
    )
  }

  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user")
  const label = extractMessageText(lastUserMessage).trim()
  return label || "Session"
}
