import { createFileRoute } from "@tanstack/react-router"
import { questionChatHandler } from "@/lib/pi/chat-runtime/handlers/question"

export const Route = createFileRoute("/api/chat/question")({
  server: {
    handlers: {
      POST: async ({ request }) => questionChatHandler(request),
    },
  },
})
