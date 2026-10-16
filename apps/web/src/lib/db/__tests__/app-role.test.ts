// @vitest-environment node
import { PGlite } from "@electric-sql/pglite"
import { describe, expect, it } from "vitest"
import {
  DEFAULT_APP_ROLE,
  assertSafeAppRole,
  resolveAppRole,
  withAppRole,
} from "../app-role"
import { AUTH_POSTGRES_POST_MIGRATE_SQL } from "../auth-postgres-post-migrate"
import { runChatMigrations } from "../chat-migrations"
import type { ChatMigrationClient } from "../chat-migrations"

describe("resolveAppRole", () => {
  it("defaults to fleet_pi_app", () => {
    expect(resolveAppRole({})).toBe(DEFAULT_APP_ROLE)
    expect(resolveAppRole({ FLEET_PI_APP_ROLE: "  " })).toBe(DEFAULT_APP_ROLE)
  })

  it("accepts a safe identifier", () => {
    expect(resolveAppRole({ FLEET_PI_APP_ROLE: "fleet_pi_app_2026" })).toBe(
      "fleet_pi_app_2026"
    )
  })

  it.each([
    'x"; DROP ROLE neondb_owner; --',
    "fleet pi",
    "Fleet_Pi_App",
    "1role",
    "pg_monitor",
    "a".repeat(64),
    "role'",
  ])("rejects unsafe name %j", (name) => {
    expect(() => resolveAppRole({ FLEET_PI_APP_ROLE: name })).toThrow(
      /FLEET_PI_APP_ROLE/
    )
    expect(() => assertSafeAppRole(name)).toThrow()
  })
})

describe("withAppRole", () => {
  it("leaves SQL unchanged for the default role", () => {
    expect(withAppRole(AUTH_POSTGRES_POST_MIGRATE_SQL, DEFAULT_APP_ROLE)).toBe(
      AUTH_POSTGRES_POST_MIGRATE_SQL
    )
  })

  it("rewrites identifiers and literals but not longer names", () => {
    const sql = withAppRole(
      `IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fleet_pi_app') THEN
         GRANT SELECT ON t TO fleet_pi_app;
         CREATE POLICY fleet_pi_app_auth_access ON t TO fleet_pi_app USING (true);`,
      "app_next"
    )
    expect(sql).toContain("rolname = 'app_next'")
    expect(sql).toContain('GRANT SELECT ON t TO "app_next";')
    expect(sql).toContain(
      'CREATE POLICY fleet_pi_app_auth_access ON t TO "app_next"'
    )
    expect(sql).not.toMatch(/\bfleet_pi_app\b/)
  })

  it("refuses an unsafe role even when called directly", () => {
    expect(() => withAppRole("GRANT x TO fleet_pi_app", 'a"b')).toThrow()
  })
})

const ALICE = "11111111-1111-4111-8111-111111111111"
const BOB = "22222222-2222-4222-8222-222222222222"

function clientFor(db: PGlite): ChatMigrationClient {
  return {
    query: async <T>(text: string, params?: Array<unknown>) => {
      if (params && params.length > 0) {
        return { rows: (await db.query<T>(text, params)).rows }
      }
      const results = await db.exec(text)
      return { rows: (results.at(-1)?.rows ?? []) as Array<T> }
    },
  }
}

async function grantsOf(db: PGlite, role: string) {
  const tables = await db.query<{ t: string }>(
    `SELECT table_name || ':' || privilege_type AS t
     FROM information_schema.role_table_grants
     WHERE grantee = $1 AND table_schema = 'public' ORDER BY 1`,
    [role]
  )
  const fns = await db.query<{ f: string }>(
    `SELECT p.proname AS f FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND has_function_privilege($1, p.oid, 'EXECUTE')
     ORDER BY 1`,
    [role]
  )
  return {
    tables: tables.rows.map((r) => r.t),
    functions: fns.rows.map((r) => r.f),
  }
}

describe("chat:migrate with a custom app role (PGlite)", () => {
  it("grants the custom role the same privileges and RLS still applies", async () => {
    const db = new PGlite()
    try {
      await db.exec(`
        CREATE ROLE fleet_pi_app NOLOGIN;
        CREATE ROLE authenticated NOLOGIN;
        CREATE SCHEMA neon_auth;
        CREATE TABLE neon_auth."user" (id uuid PRIMARY KEY);
        INSERT INTO neon_auth."user" VALUES ('${ALICE}'), ('${BOB}');
      `)
      const silent = () => {}
      await runChatMigrations(clientFor(db), silent)
      const baseline = await grantsOf(db, "fleet_pi_app")
      expect(baseline.tables.length).toBeGreaterThan(0)

      await db.exec("CREATE ROLE fleet_pi_app_next NOLOGIN NOBYPASSRLS")
      expect((await grantsOf(db, "fleet_pi_app_next")).tables).toEqual([])
      await runChatMigrations(clientFor(db), silent, {
        appRole: "fleet_pi_app_next",
      })
      expect(await grantsOf(db, "fleet_pi_app_next")).toEqual(baseline)
      // The default role keeps its grants.
      expect(await grantsOf(db, "fleet_pi_app")).toEqual(baseline)

      await db.exec(`
        INSERT INTO pi_sessions (id, user_id, session_file_path, cwd, created_at, updated_at)
        VALUES ('a', '${ALICE}', '/a', '/', now(), now()),
               ('b', '${BOB}', '/b', '/', now(), now());
      `)
      await db.exec("BEGIN; SET LOCAL ROLE fleet_pi_app_next;")
      await db.query("SELECT set_config('app.current_user_id', $1, true)", [
        ALICE,
      ])
      const seen = await db.query<{ id: string }>("SELECT id FROM pi_sessions")
      await db.exec("ROLLBACK")
      expect(seen.rows).toEqual([{ id: "a" }])
    } finally {
      await db.close()
    }
  })
})
