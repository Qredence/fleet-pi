import { createFileRoute } from "@tanstack/react-router"
import { auth } from "@/lib/auth/server"
import {
  getCachedUserSandbox,
  isDaytonaEnabled,
} from "@/lib/daytona/user-sandbox"

export const Route = createFileRoute("/api/sandbox/preview")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api
          .getSession({ headers: request.headers })
          .catch(() => null)

        const user = session?.user
        if (!user) {
          return Response.json(
            { error: "Authentication required" },
            { status: 401 }
          )
        }

        if (!isDaytonaEnabled(user.id)) {
          return Response.json(
            { error: "Sandbox not available" },
            { status: 503 }
          )
        }

        const url = new URL(request.url)
        const port = Number(url.searchParams.get("port") ?? "3000")
        if (!Number.isFinite(port) || port < 1 || port > 65535) {
          return Response.json({ error: "Invalid port" }, { status: 400 })
        }

        const handle = getCachedUserSandbox(user.id)
        if (!handle) {
          return Response.json(
            { error: "No active sandbox for user" },
            { status: 404 }
          )
        }

        try {
          const preview = await handle.sandbox.getPreviewLink(port)
          return Response.json({
            url: preview.url,
            token: preview.token,
            port,
          })
        } catch (error) {
          return Response.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to get preview URL",
            },
            { status: 500 }
          )
        }
      },
    },
  },
})
