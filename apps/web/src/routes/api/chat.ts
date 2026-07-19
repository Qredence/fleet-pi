import { createFileRoute } from "@tanstack/react-router"
import { postChatHandler } from "@/lib/pi/chat-runtime/handlers/post-chat"

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => postChatHandler(request),
    },
  },
})
