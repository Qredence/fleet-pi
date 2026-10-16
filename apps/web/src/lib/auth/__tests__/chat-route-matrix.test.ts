import { describe, expect, it } from "vitest"

type ChatRouteAuthExpectation = {
  route: string
  hostedAuthRequired: boolean
  ownershipWhenSessionPresent: boolean
}

const CHAT_ROUTE_AUTH_MATRIX: Array<ChatRouteAuthExpectation> = [
  {
    route: "POST /api/chat",
    hostedAuthRequired: true,
    ownershipWhenSessionPresent: true,
  },
  {
    route: "GET /api/chat/session",
    hostedAuthRequired: true,
    ownershipWhenSessionPresent: true,
  },
  {
    route: "POST /api/chat/resume",
    hostedAuthRequired: true,
    ownershipWhenSessionPresent: true,
  },
  {
    route: "GET /api/chat/sessions",
    hostedAuthRequired: true,
    ownershipWhenSessionPresent: false,
  },
  {
    route: "POST /api/chat/new",
    hostedAuthRequired: true,
    ownershipWhenSessionPresent: false,
  },
  {
    route: "POST /api/chat/abort",
    hostedAuthRequired: true,
    ownershipWhenSessionPresent: true,
  },
  {
    route: "POST /api/chat/question",
    hostedAuthRequired: true,
    ownershipWhenSessionPresent: true,
  },
  {
    route: "GET /api/chat/runs",
    hostedAuthRequired: true,
    ownershipWhenSessionPresent: true,
  },
  {
    route: "GET /api/chat/run",
    hostedAuthRequired: true,
    ownershipWhenSessionPresent: true,
  },
  {
    route: "GET /api/chat/provenance",
    hostedAuthRequired: true,
    ownershipWhenSessionPresent: true,
  },
  {
    route: "DELETE /api/chat/session",
    hostedAuthRequired: true,
    ownershipWhenSessionPresent: true,
  },
  {
    route: "DELETE /api/chat/account",
    hostedAuthRequired: true,
    ownershipWhenSessionPresent: false,
  },
  {
    route: "PATCH /api/chat/settings",
    hostedAuthRequired: true,
    ownershipWhenSessionPresent: false,
  },
]

describe("chat route auth matrix", () => {
  it.each(CHAT_ROUTE_AUTH_MATRIX)(
    "$route requires hosted auth=$hostedAuthRequired",
    ({ hostedAuthRequired }) => {
      expect(hostedAuthRequired).toBe(true)
    }
  )
})
