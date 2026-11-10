import { describe, expect, it } from "vitest"

import { runChatMigrations } from "../chat-migrations"
import { CHAT_POSTGRES_DATA_API_REVOKE_RECONCILE_SQL } from "../chat-postgres-data-api-revoke-reconcile"
import { CHAT_POSTGRES_SESSION_OWNER_FUNCTION_SQL } from "../chat-postgres-session-tombstones"

import type { ChatMigrationClient } from "../chat-migrations"

const OWNER_FN = /CREATE OR REPLACE FUNCTION fleet_pi_check_session_owner\(/

function noop() {}

function isReconcile(text: string) {
  return text.includes("ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner")
}

const SELECT_LEDGER = "SELECT id FROM fleet_pi_chat_migrations"
const INSERT_LEDGER = "INSERT INTO fleet_pi_chat_migrations"

/**
 * Ledger-backed reply shared by every fake below: answers the ledger SELECT
 * from `ledger` and records ledger INSERTs into it. Returns `undefined` for
 * any other statement so the caller can keep its own bookkeeping. Rows are
 * `never`-typed so the reply satisfies the client's generic `query`.
 */
function answerLedger(
  text: string,
  params: Array<unknown> | undefined,
  ledger: Set<string>
) {
  if (text.includes(SELECT_LEDGER)) {
    const id = String(params?.[0])
    return Promise.resolve({
      rows: (ledger.has(id) ? [{ id }] : []) as never,
    })
  }
  if (text.includes(INSERT_LEDGER)) {
    ledger.add(String(params?.[0]))
    return Promise.resolve({ rows: [] as never })
  }
  return undefined
}

/**
 * Fake Postgres that keeps the migration ledger and tracks which definition of
 * fleet_pi_check_session_owner is live after each statement batch, in order.
 */
function createFakeDatabase() {
  const ledger = new Set<string>()
  let ownerFunction: string | undefined
  let forceRlsStatements = 0
  const client: ChatMigrationClient = {
    query: (text: string, params?: Array<unknown>) => {
      const ledgerReply = answerLedger(text, params, ledger)
      if (ledgerReply) return ledgerReply
      // Within one batch the last CREATE OR REPLACE wins.
      const parts = text.split(OWNER_FN)
      if (parts.length > 1) {
        const last = parts[parts.length - 1] ?? ""
        ownerFunction = last.slice(0, last.indexOf("$$;") + 3)
      }
      if (
        text.includes("FORCE ROW LEVEL SECURITY") &&
        text.includes("public.pi_sessions")
      ) {
        forceRlsStatements += 1
      }
      return Promise.resolve({ rows: [] })
    },
  }
  return {
    client,
    get ownerFunction() {
      return ownerFunction
    },
    get forceRlsStatements() {
      return forceRlsStatements
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
    const forceRlsAfterFirstRun = db.forceRlsStatements
    expect(forceRlsAfterFirstRun).toBeGreaterThan(0)

    await runChatMigrations(db.client, silent)
    expect(db.ledger.size).toBe(ledgerAfterFirstRun)
    expect(db.ownerFunction).toContain("pi_session_tombstones")
    expect(db.ownerFunction).toContain("'deleted'")
    expect(db.forceRlsStatements).toBeGreaterThan(forceRlsAfterFirstRun)
  })

  it("re-applies the Data API revoke reconcile last on every run, even when revoke migrations are recorded", async () => {
    const statements: Array<string> = []
    const ledger = new Set<string>()
    const client: ChatMigrationClient = {
      query: (text: string, params?: Array<unknown>) => {
        const ledgerReply = answerLedger(text, params, ledger)
        if (ledgerReply) return ledgerReply
        statements.push(text)
        return Promise.resolve({ rows: [] })
      },
    }
    await runChatMigrations(client, noop)
    expect(statements.at(-1)).toBe(CHAT_POSTGRES_DATA_API_REVOKE_RECONCILE_SQL)
    expect(ledger.has("20260719_revoke_data_api_pi_grants")).toBe(true)
    expect(ledger.has("20260723_revoke_data_api_pi_grants_again")).toBe(true)
    expect(ledger.has("20260719_revoke_ownership_probe_execute")).toBe(true)

    statements.length = 0
    await runChatMigrations(client, noop)
    expect(statements.filter(isReconcile)).toHaveLength(1)
    expect(statements.at(-1)).toBe(CHAT_POSTGRES_DATA_API_REVOKE_RECONCILE_SQL)
  })

  it("points the reconcile app-role grant at FLEET_PI_APP_ROLE", async () => {
    const statements: Array<string> = []
    const client: ChatMigrationClient = {
      query: (text: string) => {
        statements.push(text)
        return Promise.resolve({ rows: [] })
      },
    }
    await runChatMigrations(client, noop, { appRole: "fleet_pi_app_v2" })
    const reconcile = statements.at(-1) ?? ""
    expect(reconcile).toContain(
      "ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner"
    )
    expect(reconcile).toContain("rolname = 'fleet_pi_app_v2'")
    expect(reconcile).not.toMatch(/'fleet_pi_app'/)
  })

  it("checks tombstones before ownership in the shared definition", () => {
    const sql = CHAT_POSTGRES_SESSION_OWNER_FUNCTION_SQL
    expect(sql.indexOf("'deleted'")).toBeGreaterThan(-1)
    expect(sql.indexOf("'deleted'")).toBeLessThan(sql.indexOf("'missing'"))
  })
})
