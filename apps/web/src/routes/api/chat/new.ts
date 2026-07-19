import { createFileRoute } from "@tanstack/react-router"
import { newChatHandler } from "@/lib/pi/chat-runtime/handlers/new"

export const Route = createFileRoute("/api/chat/new")({
  server: {
    handlers: {
      POST: async ({ request }) => newChatHandler(request),
    },
  },
})
