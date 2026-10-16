import type { UserPiDurableStub } from "@/lib/pi/durable/user-pi-durable"
import { withAuthenticatedChatRequest } from "@/lib/auth/chat-api-auth"
import { userPiDurableStub } from "@/lib/pi/durable/durable-binding"

export const DURABLE_SPIKE_PATH = "/api/chat/durable-spike"

type SpikeAction = "echo" | "model" | "restart"

type SpikeNamespace = {
  getByName: (name: string) => UserPiDurableStub
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function readNamespace(env: unknown): SpikeNamespace {
  if (!isRecord(env) || !isRecord(env.USER_PI_DURABLE)) {
    throw new Error("USER_PI_DURABLE is not bound")
  }
  const getByName = env.USER_PI_DURABLE.getByName
  if (typeof getByName !== "function") {
    throw new Error("USER_PI_DURABLE is not bound")
  }
  return env.USER_PI_DURABLE as SpikeNamespace
}

/** The spike reopens the harness, so it stays off unless a deploy opts in. */
function spikeEnabled(env: unknown) {
  return isRecord(env) && env.FLEET_PI_DURABLE_SPIKE === "1"
}

function isSpikeAction(value: unknown): value is SpikeAction {
  return value === "echo" || value === "model" || value === "restart"
}

/**
 * Spike HTTP entry, served only when `FLEET_PI_DURABLE_SPIKE=1`. Production
 * `/api/chat` never calls this. The signed-in user id is the Durable Object
 * name; the body cannot choose another user.
 */
export async function handleDurableSpikeRequest(
  request: Request,
  env: unknown
): Promise<Response | null> {
  const url = new URL(request.url)
  if (url.pathname !== DURABLE_SPIKE_PATH) return null
  if (!spikeEnabled(env)) return null
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 })
  }

  return withAuthenticatedChatRequest(request, async (ctx) => {
    const userId = ctx.userId ?? "local-spike"
    const stub = userPiDurableStub(readNamespace(env), userId)
    const body = (await request.json()) as {
      action?: unknown
      prompt?: unknown
    }
    if (!isSpikeAction(body.action)) {
      return Response.json({ message: "Unknown spike action" }, { status: 400 })
    }
    const action = body.action
    switch (action) {
      case "echo":
        return Response.json(await stub.scriptedBashEcho())
      case "restart":
        return Response.json(await stub.restart())
      case "model": {
        const prompt = typeof body.prompt === "string" ? body.prompt : "hello"
        return Response.json(await stub.modelOnlyReply(prompt))
      }
      default: {
        const exhaustive: never = action
        return exhaustive
      }
    }
  })
}
