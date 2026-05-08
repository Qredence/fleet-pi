import { useQuery } from "@tanstack/react-query"
import { chatClient } from "./chat-client"

const keys = {
  models: ["chat", "models"] as const,
  resources: ["chat", "resources"] as const,
  workspace: ["workspace", "tree"] as const,
} as const

export function useChatModels() {
  return useQuery({
    queryKey: keys.models,
    queryFn: () => chatClient.getModels(),
  })
}

export function useChatResources() {
  return useQuery({
    queryKey: keys.resources,
    queryFn: () => chatClient.getResources(),
  })
}

export function useWorkspaceTree(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: keys.workspace,
    queryFn: () => chatClient.getWorkspaceTree(),
    enabled: options?.enabled,
  })
}
