import { createFileRoute } from "@tanstack/react-router"

/**
 * Daytona webhook handler.
 *
 * Receives webhook events from Daytona for sandbox lifecycle events,
 * such as sandbox creation, deletion, state changes, etc.
 *
 * The webhook should be configured in the Daytona dashboard to send
 * events to this endpoint.
 */
export async function daytonaWebhookHandler({ request }: { request: Request }) {
  try {
    // Verify webhook signature if needed (Daytona may provide a signature header)
    const signature = request.headers.get("x-daytona-signature")

    // Parse the webhook payload
    const payload = await request.json()

    // Log the webhook event for now
    // TODO: Process specific event types (sandbox.created, sandbox.deleted, etc.)
    console.log("Daytona webhook received:", {
      signature: signature ? "present" : "absent",
      event: payload,
    })

    // Return success response
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    })
  } catch (error) {
    console.error("Error processing Daytona webhook:", error)
    return new Response(
      JSON.stringify({ error: "Webhook processing failed" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    )
  }
}

export const Route = createFileRoute("/api/webhooks/daytona")({
  server: {
    handlers: {
      POST: daytonaWebhookHandler,
    },
  },
})
