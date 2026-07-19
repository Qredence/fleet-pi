import { createFileRoute } from "@tanstack/react-router"
import { abortChatHandler } from "@/lib/pi/chat-runtime/handlers/abort"

export const Route = createFileRoute("/api/chat/abort")({
  server: {
    handlers: {
      POST: async ({ request }) => abortChatHandler(request),
    },
  },
})
