import { describe, expect, it } from "vitest"
import { runChatMigrations } from "../chat-migrations"
import { CHAT_POSTGRES_SESSION_OWNER_FUNCTION_SQL } from "../chat-postgres-session-tombstones"
import type { ChatMigrationClient } from "../chat-migrations"

const OWNER_FN = /CREATE OR REPLACE FUNCTION fleet_pi_check_session_owner\(/

/**
 * Fake Postgres that keeps the migration ledger and tracks which definition of
 * fleet_pi_check_session_owner is live after each statement batch, in order.
 */
function createFakeDatabase() {
  const ledger = new Set<string>()
  let ownerFunction: string | undefined
  const client: ChatMigrationClient = {
    query: (text: string, params?: Array<unknown>) => {
      if (text.includes("SELECT id FROM fleet_pi_chat_migrations")) {
        const id = String(params?.[0])
        return Promise.resolve({
          rows: (ledger.has(id) ? [{ id }] : []) as never,
        })
      }
      if (text.includes("INSERT INTO fleet_pi_chat_migrations")) {
        ledger.add(String(params?.[0]))
        return Promise.resolve({ rows: [] })
      }
      // Within one batch the last CREATE OR REPLACE wins.
      const parts = text.split(OWNER_FN)
      if (parts.length > 1) {
        const last = parts[parts.length - 1] ?? ""
        ownerFunction = last.slice(0, last.indexOf("$$;") + 3)
      }
      return Promise.resolve({ rows: [] })
    },
  }
  return {
    client,
    get ownerFunction() {
      return ownerFunction
    },
    ledger,
  }
}

describe("runChatMigrations", () => {
  it("keeps the tombstone 'deleted' check in fleet_pi_check_session_owner across repeated runs", async () => {
    const db = createFakeDatabase()
    const silent = () => {}

    await runChatMigrations(db.client, silent)
    expect(db.ownerFunction).toContain("pi_session_tombstones")
    expect(db.ownerFunction).toContain("'deleted'")
    const ledgerAfterFirstRun = db.ledger.size

    // Second run: every numbered migration (including the tombstones one) is
    // ledger-skipped, but the base schema is re-applied. The reconcile step
    // must still leave the tombstone-aware definition live.
    await runChatMigrations(db.client, silent)
    expect(db.ledger.size).toBe(ledgerAfterFirstRun)
    expect(db.ownerFunction).toContain("pi_session_tombstones")
    expect(db.ownerFunction).toContain("'deleted'")
  })

  it("checks tombstones before ownership in the shared definition", () => {
    const sql = CHAT_POSTGRES_SESSION_OWNER_FUNCTION_SQL
    expect(sql.indexOf("'deleted'")).toBeGreaterThan(-1)
    expect(sql.indexOf("'deleted'")).toBeLessThan(sql.indexOf("'missing'"))
  })
})
