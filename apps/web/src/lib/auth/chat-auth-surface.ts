import { AsyncLocalStorage } from "node:async_hooks"

export type ChatAuthSurface = "web" | "neon-function"

const chatAuthSurface = new AsyncLocalStorage<ChatAuthSurface>()

export function runWithChatAuthSurface<T>(
  surface: ChatAuthSurface,
  fn: () => T
): T {
  return chatAuthSurface.run(surface, fn)
}

export function getChatAuthSurface(): ChatAuthSurface {
  return chatAuthSurface.getStore() ?? "web"
}
