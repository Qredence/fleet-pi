import { handleChatRuntimeRequest } from "../apps/web/src/lib/pi/chat-runtime/router.ts"

// Neon Functions are not Vercel (`VERCEL=1`). Force chat auth on this entrypoint.
if (!process.env.FLEET_PI_CHAT_RUNTIME_REQUIRE_AUTH) {
  process.env.FLEET_PI_CHAT_RUNTIME_REQUIRE_AUTH = "1"
}

export default {
  fetch: (request: Request) => handleChatRuntimeRequest(request),
}
