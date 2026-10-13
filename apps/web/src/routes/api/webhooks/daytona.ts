import { createHmac, timingSafeEqual } from "node:crypto"
import { createFileRoute } from "@tanstack/react-router"
import {
  clearUserSandboxCache,
  getCachedUserSandbox,
} from "@/lib/daytona/user-sandbox"
import {
  isCloudflareDeployment,
  isVercelDeployment,
} from "@/lib/deployment/environment"

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
    const rawBody = await request.text()
    const secret = process.env.DAYTONA_WEBHOOK_SECRET

    if (!secret) {
      if (isCloudflareDeployment() || isVercelDeployment()) {
        console.error("DAYTONA_WEBHOOK_SECRET is unset on a hosted deployment")
        return Response.json(
          { error: "webhook secret is not configured" },
          { status: 503 }
        )
      }
      console.warn(
        "Ignoring Daytona webhook side effects: DAYTONA_WEBHOOK_SECRET is not set"
      )
      return Response.json({ received: true })
    }

    if (!isValidWebhookSignature(signature, rawBody, secret)) {
      return Response.json({ error: "invalid signature" }, { status: 401 })
    }

    const payload = JSON.parse(rawBody) as DaytonaWebhookPayload

    console.log("Daytona webhook received:", {
      signature: "present",
      event: payload.event,
      sandboxId: payload.sandboxId,
      state: payload.state,
    })

    if (payload.event && payload.sandboxName) {
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

function isValidWebhookSignature(
  signature: string | null,
  rawBody: string,
  secret: string
): boolean {
  if (!signature) return false

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest()
  const received = Buffer.from(signature, "hex")
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
        clearUserSandboxCache(userId)
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
