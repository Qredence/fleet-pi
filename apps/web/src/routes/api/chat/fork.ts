import { createFileRoute } from "@tanstack/react-router"
import { forkChatHandler } from "@/lib/pi/chat-runtime/handlers/fork"

export const Route = createFileRoute("/api/chat/fork")({
  server: {
    handlers: {
      POST: async ({ request }) => forkChatHandler(request),
    },
  },
})
