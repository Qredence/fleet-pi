import { handleChatRuntimeRequest } from "../apps/web/src/lib/pi/chat-runtime/router.ts"

export default {
  fetch: (request: Request) => handleChatRuntimeRequest(request),
}
