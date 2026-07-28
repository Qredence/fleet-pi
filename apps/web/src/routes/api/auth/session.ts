import { createFileRoute } from "@tanstack/react-router"
import { auth } from "@/lib/auth/server"
import { getErrorMessage } from "@/lib/pi/server"

export const Route = createFileRoute("/api/auth/session")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api
          .getSession({ headers: request.headers })
          .catch((err) => {
            console.error(
              "[auth/session] Error fetching session:",
              getErrorMessage(err)
            )
            return null
          })

        return Response.json(session)
      },
    },
  },
})
