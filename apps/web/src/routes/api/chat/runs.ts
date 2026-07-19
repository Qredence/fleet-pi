import { createFileRoute } from "@tanstack/react-router"
import {
  chatRunsHandler,
  listChatRunsHandler,
} from "@/lib/pi/chat-runtime/handlers/runs"

export { chatRunsHandler }

export const Route = createFileRoute("/api/chat/runs")({
  server: {
    handlers: {
      GET: ({ request }) => listChatRunsHandler(request),
    },
  },
})
