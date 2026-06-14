import { createFileRoute } from "@tanstack/react-router"
import { auth } from "@/lib/auth/server"

export const Route = createFileRoute("/api/auth/session")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api
          .getSession({ headers: request.headers })
          .catch(() => null)

        return Response.json(session)
      },
    },
  },
})
