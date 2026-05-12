import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { chatClient } from "./chat-client"
import type { ChatSettingsUpdateRequest } from "./chat-protocol"

const keys = {
  models: ["chat", "models"] as const,
  resources: ["chat", "resources"] as const,
  settings: ["chat", "settings"] as const,
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

export function useChatSettings() {
  return useQuery({
    queryKey: keys.settings,
    queryFn: () => chatClient.getSettings(),
  })
}

export function useUpdateChatSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: ChatSettingsUpdateRequest) =>
      chatClient.updateSettings(request),
    onSuccess: (settings) => {
      queryClient.setQueryData(keys.settings, settings)
      void queryClient.invalidateQueries({ queryKey: keys.models })
      void queryClient.invalidateQueries({ queryKey: keys.resources })
    },
  })
}

export function useWorkspaceTree(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: keys.workspace,
    queryFn: () => chatClient.getWorkspaceTree(),
    enabled: options?.enabled,
  })
}
