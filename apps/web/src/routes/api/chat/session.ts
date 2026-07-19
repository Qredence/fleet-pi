import { createFileRoute } from "@tanstack/react-router"
import {
  deleteChatSessionHandler,
  getChatSessionHandler,
} from "@/lib/pi/chat-runtime/handlers/session"

export const Route = createFileRoute("/api/chat/session")({
  server: {
    handlers: {
      GET: async ({ request }) => getChatSessionHandler(request),
      DELETE: async ({ request }) => deleteChatSessionHandler(request),
    },
  },
})
