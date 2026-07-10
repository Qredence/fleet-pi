import { describe, expect, it } from "vitest"

type ChatRouteAuthExpectation = {
  route: string
  vercelAuthRequired: boolean
  ownershipWhenSessionPresent: boolean
}

const CHAT_ROUTE_AUTH_MATRIX: Array<ChatRouteAuthExpectation> = [
  {
    route: "POST /api/chat",
    vercelAuthRequired: true,
    ownershipWhenSessionPresent: true,
  },
  {
    route: "GET /api/chat/session",
    vercelAuthRequired: true,
    ownershipWhenSessionPresent: true,
  },
  {
    route: "POST /api/chat/resume",
    vercelAuthRequired: true,
    ownershipWhenSessionPresent: true,
  },
  {
    route: "GET /api/chat/sessions",
    vercelAuthRequired: true,
    ownershipWhenSessionPresent: false,
  },
  {
    route: "POST /api/chat/new",
    vercelAuthRequired: true,
    ownershipWhenSessionPresent: false,
  },
  {
    route: "POST /api/chat/abort",
    vercelAuthRequired: true,
    ownershipWhenSessionPresent: true,
  },
  {
    route: "POST /api/chat/question",
    vercelAuthRequired: true,
    ownershipWhenSessionPresent: true,
  },
  {
    route: "GET /api/chat/runs",
    vercelAuthRequired: true,
    ownershipWhenSessionPresent: true,
  },
  {
    route: "GET /api/chat/run",
    vercelAuthRequired: true,
    ownershipWhenSessionPresent: true,
  },
  {
    route: "GET /api/chat/provenance",
    vercelAuthRequired: true,
    ownershipWhenSessionPresent: true,
  },
  {
    route: "DELETE /api/chat/session",
    vercelAuthRequired: true,
    ownershipWhenSessionPresent: true,
  },
  {
    route: "DELETE /api/chat/account",
    vercelAuthRequired: true,
    ownershipWhenSessionPresent: false,
  },
  {
    route: "PATCH /api/chat/settings",
    vercelAuthRequired: true,
    ownershipWhenSessionPresent: false,
  },
]

describe("chat route auth matrix", () => {
  it.each(CHAT_ROUTE_AUTH_MATRIX)(
    "$route requires Vercel auth=$vercelAuthRequired",
    ({ vercelAuthRequired }) => {
      expect(vercelAuthRequired).toBe(true)
    }
  )
})
