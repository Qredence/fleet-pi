import { createFileRoute } from "@tanstack/react-router"
import { resumeChatHandler } from "@/lib/pi/chat-runtime/handlers/resume"

export const Route = createFileRoute("/api/chat/resume")({
  server: {
    handlers: {
      POST: async ({ request }) => resumeChatHandler(request),
    },
  },
})
