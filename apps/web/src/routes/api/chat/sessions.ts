import { createFileRoute } from "@tanstack/react-router"
import { listChatSessionsHandler } from "@/lib/pi/chat-runtime/handlers/sessions"

export const Route = createFileRoute("/api/chat/sessions")({
  server: {
    handlers: {
      GET: async ({ request }) => listChatSessionsHandler(request),
    },
  },
})
