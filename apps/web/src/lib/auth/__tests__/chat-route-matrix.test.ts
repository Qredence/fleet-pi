import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

type ChatRouteAuthExpectation = {
  route: string
  file: string
  hostedAuthRequired: boolean
  ownershipWhenSessionPresent: boolean
}

const WEB_SRC = join(import.meta.dirname, "../../../")

const CHAT_SESSION_REQUEST_HELPER = "lib/pi/chat-runtime/session-request.ts"

const CHAT_ROUTE_AUTH_MATRIX: Array<ChatRouteAuthExpectation> = [
  {
    route: "POST /api/chat",
    file: "lib/pi/chat-runtime/handlers/post-chat.ts",
    hostedAuthRequired: true,
    ownershipWhenSessionPresent: true,
  },
  {
    route: "GET /api/chat/session",
    file: "lib/pi/chat-runtime/handlers/session.ts",
    hostedAuthRequired: true,
    ownershipWhenSessionPresent: true,
  },
  {
    route: "POST /api/chat/resume",
    file: "lib/pi/chat-runtime/handlers/resume.ts",
    hostedAuthRequired: true,
    ownershipWhenSessionPresent: true,
  },
  {
    route: "POST /api/chat/fork",
    file: "lib/pi/chat-runtime/handlers/fork.ts",
    hostedAuthRequired: true,
    ownershipWhenSessionPresent: true,
  },
  {
    route: "GET /api/chat/sessions",
    file: "lib/pi/chat-runtime/handlers/sessions.ts",
    hostedAuthRequired: true,
    ownershipWhenSessionPresent: false,
  },
  {
    route: "POST /api/chat/new",
    file: "lib/pi/chat-runtime/handlers/new.ts",
    hostedAuthRequired: true,
    ownershipWhenSessionPresent: false,
  },
  {
    route: "POST /api/chat/abort",
    file: "lib/pi/chat-runtime/handlers/abort.ts",
    hostedAuthRequired: true,
    ownershipWhenSessionPresent: true,
  },
  {
    route: "POST /api/chat/question",
    file: "lib/pi/chat-runtime/handlers/question.ts",
    hostedAuthRequired: true,
    ownershipWhenSessionPresent: true,
  },
  {
    route: "GET /api/chat/runs",
    file: "lib/pi/chat-runtime/handlers/runs.ts",
    hostedAuthRequired: true,
    ownershipWhenSessionPresent: true,
  },
  {
    route: "GET /api/chat/run",
    file: "lib/pi/chat-runtime/handlers/run.ts",
    hostedAuthRequired: true,
    ownershipWhenSessionPresent: true,
  },
  {
    route: "GET /api/chat/provenance",
    file: "routes/api/chat/provenance.ts",
    hostedAuthRequired: true,
    ownershipWhenSessionPresent: true,
  },
  {
    route: "DELETE /api/chat/session",
    file: "lib/pi/chat-runtime/handlers/session.ts",
    hostedAuthRequired: true,
    ownershipWhenSessionPresent: true,
  },
  {
    route: "DELETE /api/chat/account",
    file: "routes/api/chat/account.ts",
    hostedAuthRequired: true,
    ownershipWhenSessionPresent: false,
  },
  {
    route: "GET /api/chat/settings",
    file: "routes/api/chat/settings.ts",
    hostedAuthRequired: true,
    ownershipWhenSessionPresent: false,
  },
  {
    route: "PATCH /api/chat/settings",
    file: "routes/api/chat/settings.ts",
    hostedAuthRequired: true,
    ownershipWhenSessionPresent: false,
  },
  {
    route: "GET /api/chat/providers",
    file: "routes/api/chat/providers.ts",
    hostedAuthRequired: true,
    ownershipWhenSessionPresent: false,
  },
]

describe("chat route auth matrix", () => {
  it.each(CHAT_ROUTE_AUTH_MATRIX)(
    "$route enforces hosted auth and ownership in $file",
    ({ file, hostedAuthRequired, ownershipWhenSessionPresent }) => {
      const source = readFileSync(join(WEB_SRC, file), "utf8")
      expect(hostedAuthRequired).toBe(true)
      expect(source).toContain("withAuthenticatedChatRequest")
      if (ownershipWhenSessionPresent) {
        expect(source).toMatch(
          /enforceChatSessionOwnership|enforceRunOwnership|fetchUserSessionIds|authorizeChatSessionRequest/
        )
      }
    }
  )

  it("the shared chat session request helper enforces ownership", () => {
    const source = readFileSync(
      join(WEB_SRC, CHAT_SESSION_REQUEST_HELPER),
      "utf8"
    )
    expect(source).toContain("enforceChatSessionOwnership")
  })
})
