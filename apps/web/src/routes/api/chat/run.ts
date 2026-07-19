import { createFileRoute } from "@tanstack/react-router"
import {
  chatRunHandler,
  getChatRunHandler,
} from "@/lib/pi/chat-runtime/handlers/run"

export { chatRunHandler }

export const Route = createFileRoute("/api/chat/run")({
  server: {
    handlers: {
      GET: ({ request }) => getChatRunHandler(request),
    },
  },
})
