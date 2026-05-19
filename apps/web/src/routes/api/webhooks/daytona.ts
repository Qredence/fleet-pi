import { timingSafeEqual } from "node:crypto"
import { createFileRoute } from "@tanstack/react-router"
import {
  clearSandboxCache,
  getCachedUserSandbox,
} from "@/lib/daytona/user-sandbox"

interface DaytonaWebhookPayload {
  event?: string
  sandboxId?: string
  sandboxName?: string
  state?: string
  [key: string]: unknown
}

export async function daytonaWebhookHandler({ request }: { request: Request }) {
  try {
    const signature = request.headers.get("x-daytona-signature")
    const payload = (await request.json()) as DaytonaWebhookPayload

    console.log("Daytona webhook received:", {
      signature: signature ? "present" : "absent",
      event: payload.event,
      sandboxId: payload.sandboxId,
      state: payload.state,
    })

    if (payload.event && payload.sandboxName && isVerifiedWebhook(signature)) {
      handleSandboxEvent(payload)
    }

    return Response.json({ received: true })
  } catch (error) {
    console.error("Error processing Daytona webhook:", error)
    return Response.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    )
  }
}

function isVerifiedWebhook(signature: string | null): boolean {
  const secret = process.env.DAYTONA_WEBHOOK_SECRET
  if (!secret) {
    console.warn(
      "Ignoring Daytona webhook side effects: DAYTONA_WEBHOOK_SECRET is not set"
    )
    return false
  }
  if (!signature) return false

  const expected = Buffer.from(secret)
  const received = Buffer.from(signature)
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  )
}

function handleSandboxEvent(payload: DaytonaWebhookPayload) {
  const { event, sandboxName, state } = payload

  if (state === "error" || event === "sandbox.error") {
    const userId = extractUserIdFromSandboxName(sandboxName)
    if (userId) {
      const cached = getCachedUserSandbox(userId)
      if (cached) {
        console.warn(
          `Sandbox ${sandboxName} entered error state for user ${userId}, clearing cache`
        )
        clearSandboxCache()
      }
    }
  }
}

function extractUserIdFromSandboxName(name?: string): string | undefined {
  if (!name?.startsWith("fleet-pi-user-")) return undefined
  return name.slice("fleet-pi-user-".length)
}

export const Route = createFileRoute("/api/webhooks/daytona")({
  server: {
    handlers: {
      POST: daytonaWebhookHandler,
    },
  },
})
