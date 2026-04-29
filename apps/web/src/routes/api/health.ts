import { createFileRoute } from "@tanstack/react-router"

export function healthHandler(): Response {
  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  })
}

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: healthHandler,
    },
  },
})
