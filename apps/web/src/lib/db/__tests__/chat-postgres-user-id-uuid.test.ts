// @vitest-environment node
import { PGlite } from "@electric-sql/pglite"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { runChatMigrations } from "../chat-migrations"
import { CHAT_POSTGRES_USER_ID_UUID_SQL } from "../chat-postgres-user-id-uuid"
import type { ChatMigrationClient } from "../chat-migrations"

const ALICE = "11111111-1111-4111-8111-111111111111"
const BOB = "22222222-2222-4222-8222-222222222222"
const GHOST = "33333333-3333-4333-8333-333333333333" // valid uuid, no user

const USER_COLUMNS = [
  "pi_session_tombstones.user_id",
  "pi_sessions.user_id",
  "pi_user_providers.user_id",
  "pi_user_settings.user_id",
]

function clientFor(db: PGlite): ChatMigrationClient {
  return {
    query: async <T>(text: string, params?: Array<unknown>) => {
      if (params && params.length > 0) {
        const result = await db.query<T>(text, params)
        return { rows: result.rows }
      }
      const results = await db.exec(text)
      return { rows: (results.at(-1)?.rows ?? []) as Array<T> }
    },
  }
}

const silent = () => {}

async function bootstrap(db: PGlite, withNeonAuth = true) {
  await db.exec(`
    CREATE ROLE fleet_pi_app NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE anonymous NOLOGIN;
  `)
  if (withNeonAuth) {
    await db.exec(`
      CREATE SCHEMA neon_auth;
      CREATE TABLE neon_auth."user" (id uuid PRIMARY KEY, email text);
      INSERT INTO neon_auth."user" VALUES ('${ALICE}', 'a@x'), ('${BOB}', 'b@x');
    `)
  }
}

async function seedLegacyRows(db: PGlite) {
  const session = (id: string, user: string | null) =>
    `('${id}', ${user === null ? "NULL" : `'${user}'`}, '/s/${id}.jsonl', '/w', now(), now())`
  await db.exec(`
    INSERT INTO pi_sessions (id, user_id, session_file_path, cwd, created_at, updated_at) VALUES
      ${session("s-alice", ALICE)}, ${session("s-bob", BOB)},
      ${session("s-legacy", "legacy-better-auth-id")}, ${session("s-ghost", GHOST)},
      ${session("s-null", null)};
    INSERT INTO pi_runs (id, session_id, assistant_message_id, session_turn_index, status, started_at)
      VALUES ('r-legacy', 's-legacy', 'm1', 0, 'completed', now()),
             ('r-alice', 's-alice', 'm2', 0, 'completed', now());
    INSERT INTO pi_run_events (run_id, sequence, event_type, payload, recorded_at)
      VALUES ('r-legacy', 1, 'start', '{}', now());
    INSERT INTO pi_session_entries (session_id, entry_id, entry_type, raw_entry, entry_timestamp)
      VALUES ('s-legacy', 'e1', 'message', '{}', now()), ('s-alice', 'e1', 'message', '{}', now());
    INSERT INTO pi_user_providers (user_id, provider_id, encrypted_key) VALUES
      ('${ALICE}', 'openai', 'k'), ('not-a-uuid', 'openai', 'k');
    INSERT INTO pi_user_settings (user_id, settings) VALUES ('${BOB}', '{}'), ('${GHOST}', '{}');
    INSERT INTO pi_session_tombstones (session_id, user_id) VALUES ('old', 'legacy-better-auth-id');
  `)
}

async function columnTypes(db: PGlite) {
  const { rows } = await db.query<{ col: string; data_type: string }>(`
    SELECT table_name || '.' || column_name AS col, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name LIKE 'pi\\_%'
      AND table_name <> 'pi_orphan_quarantine' AND column_name = 'user_id'
    ORDER BY 1`)
  return rows
}

async function asApp<T>(db: PGlite, userId: string, sql: string) {
  await db.exec("BEGIN; SET LOCAL ROLE fleet_pi_app;")
  try {
    await db.query("SELECT set_config('app.current_user_id', $1, true)", [
      userId,
    ])
    return (await db.query<T>(sql)).rows
  } finally {
    await db.exec("ROLLBACK")
  }
}

describe("pi_* user_id → uuid migration", () => {
  let db: PGlite
  beforeEach(async () => {
    db = new PGlite()
  })
  afterEach(async () => {
    await db.close()
  })

  it("converts every pi_* user_id to uuid with a validated neon_auth FK", async () => {
    await bootstrap(db)
    await runChatMigrations(clientFor(db), silent)

    const types = await columnTypes(db)
    expect(types.map((r) => r.col)).toEqual(USER_COLUMNS)
    expect(types.every((r) => r.data_type === "uuid")).toBe(true)

    const { rows: fks } = await db.query<{
      conname: string
      convalidated: boolean
      confdeltype: string
    }>(`
      SELECT conname, convalidated, confdeltype FROM pg_constraint
      WHERE contype = 'f' AND confrelid = 'neon_auth."user"'::regclass ORDER BY conname`)
    expect(fks).toHaveLength(4)
    expect(fks.every((fk) => fk.convalidated && fk.confdeltype === "c")).toBe(
      true
    )
  })

  it("is idempotent: a second run changes nothing", async () => {
    await bootstrap(db)
    const client = clientFor(db)
    await runChatMigrations(client, silent)
    const snapshot = async () =>
      (
        await db.query(`
          SELECT (SELECT json_agg(conname ORDER BY conname) FROM pg_constraint
                  WHERE confrelid = 'neon_auth."user"'::regclass) AS fks,
                 (SELECT json_agg(policyname || ':' || qual ORDER BY policyname)
                  FROM pg_policies WHERE schemaname = 'public') AS policies,
                 (SELECT count(*) FROM pi_orphan_quarantine) AS quarantined`)
      ).rows
    const before = await snapshot()
    await runChatMigrations(client, silent)
    await db.exec(CHAT_POSTGRES_USER_ID_UUID_SQL)
    expect(await snapshot()).toEqual(before)
    expect((await columnTypes(db)).every((r) => r.data_type === "uuid")).toBe(
      true
    )
  })

  it("quarantines invalid and unknown owners (with cascaded children) instead of deleting them", async () => {
    await bootstrap(db)
    // Build the legacy TEXT schema first (no neon_auth effect yet: drop FK target temporarily).
    await db.exec(`ALTER SCHEMA neon_auth RENAME TO neon_auth_hidden`)
    await runChatMigrations(clientFor(db), silent)
    expect((await columnTypes(db)).every((r) => r.data_type === "text")).toBe(
      true
    )
    await seedLegacyRows(db)
    await db.exec(`ALTER SCHEMA neon_auth_hidden RENAME TO neon_auth`)

    await runChatMigrations(clientFor(db), silent)

    const { rows } = await db.query<{
      source_table: string
      reason: string
      n: number
    }>(`
      SELECT source_table, reason, count(*)::int AS n FROM pi_orphan_quarantine
      GROUP BY 1, 2 ORDER BY 1, 2`)
    expect(rows).toEqual([
      { source_table: "pi_run_events", reason: "cascade:pi_sessions", n: 1 },
      { source_table: "pi_runs", reason: "cascade:pi_sessions", n: 1 },
      {
        source_table: "pi_session_entries",
        reason: "cascade:pi_sessions",
        n: 1,
      },
      { source_table: "pi_session_tombstones", reason: "invalid_uuid", n: 1 },
      { source_table: "pi_sessions", reason: "invalid_uuid", n: 1 },
      { source_table: "pi_sessions", reason: "unknown_user", n: 1 },
      { source_table: "pi_user_providers", reason: "invalid_uuid", n: 1 },
      { source_table: "pi_user_settings", reason: "unknown_user", n: 1 },
    ])
    const { rows: kept } = await db.query<{ id: string }>(
      "SELECT id FROM pi_sessions ORDER BY id"
    )
    // Valid owners and the ownerless (NULL) session stay.
    expect(kept.map((r) => r.id)).toEqual(["s-alice", "s-bob", "s-null"])
    const { rows: original } = await db.query<{
      row_data: { user_id: string }
    }>(
      "SELECT row_data FROM pi_orphan_quarantine WHERE source_table = 'pi_sessions' AND reason = 'invalid_uuid'"
    )
    expect(original[0]?.row_data.user_id).toBe("legacy-better-auth-id")
  })

  it("keeps RLS isolating users and fleet_pi_app grants intact", async () => {
    await bootstrap(db)
    await db.exec(`ALTER SCHEMA neon_auth RENAME TO neon_auth_hidden`)
    await runChatMigrations(clientFor(db), silent)
    await seedLegacyRows(db)
    await db.exec(`ALTER SCHEMA neon_auth_hidden RENAME TO neon_auth`)
    await runChatMigrations(clientFor(db), silent)

    expect(
      await asApp<{ id: string }>(db, ALICE, "SELECT id FROM pi_sessions")
    ).toEqual([{ id: "s-alice" }])
    expect(
      await asApp<{ id: string }>(db, BOB, "SELECT id FROM pi_sessions")
    ).toEqual([{ id: "s-bob" }])
    expect(await asApp(db, ALICE, "SELECT * FROM pi_runs")).toHaveLength(1)
    expect(await asApp(db, BOB, "SELECT * FROM pi_runs")).toHaveLength(0)
    expect(
      await asApp(db, ALICE, "SELECT * FROM pi_user_providers")
    ).toHaveLength(1)
    // A non-uuid subject fails closed instead of erroring.
    expect(
      await asApp(db, "legacy-better-auth-id", "SELECT * FROM pi_sessions")
    ).toHaveLength(0)
    // Ownership probe still works with text arguments.
    expect(
      await asApp<{ s: string }>(
        db,
        ALICE,
        `SELECT fleet_pi_check_session_owner('s-bob', '${BOB}') AS s`
      )
    ).toEqual([{ s: "owned" }])
    // App role can write its own rows but cannot claim another user's.
    await expect(
      asApp(
        db,
        ALICE,
        `INSERT INTO pi_user_settings (user_id, settings) VALUES ('${ALICE}', '{}') RETURNING user_id`
      )
    ).resolves.toHaveLength(1)
    await expect(
      asApp(
        db,
        ALICE,
        `INSERT INTO pi_user_settings (user_id, settings) VALUES ('${BOB}', '{}')`
      )
    ).rejects.toThrow(/row-level security/)
    // Quarantine is owner-only.
    await expect(
      asApp(db, ALICE, "SELECT * FROM pi_orphan_quarantine")
    ).rejects.toThrow(/permission denied/)

    const { rows: grants } = await db.query<{
      table_name: string
      privs: string
    }>(`
      SELECT table_name, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs
      FROM information_schema.role_table_grants
      WHERE grantee = 'fleet_pi_app' AND table_schema = 'public' GROUP BY 1 ORDER BY 1`)
    expect(grants).toEqual([
      { table_name: "pi_file_mutations", privs: "DELETE,INSERT,SELECT,UPDATE" },
      { table_name: "pi_run_events", privs: "DELETE,INSERT,SELECT,UPDATE" },
      { table_name: "pi_runs", privs: "DELETE,INSERT,SELECT,UPDATE" },
      {
        table_name: "pi_session_entries",
        privs: "DELETE,INSERT,SELECT,UPDATE",
      },
      { table_name: "pi_session_tombstones", privs: "INSERT,SELECT" },
      { table_name: "pi_sessions", privs: "DELETE,INSERT,SELECT,UPDATE" },
      {
        table_name: "pi_tool_executions",
        privs: "DELETE,INSERT,SELECT,UPDATE",
      },
      { table_name: "pi_user_providers", privs: "DELETE,INSERT,SELECT,UPDATE" },
      { table_name: "pi_user_settings", privs: "DELETE,INSERT,SELECT,UPDATE" },
    ])
  })

  it("skips the conversion when neon_auth is absent", async () => {
    await bootstrap(db, false)
    await runChatMigrations(clientFor(db), silent)
    await runChatMigrations(clientFor(db), silent)
    expect((await columnTypes(db)).every((r) => r.data_type === "text")).toBe(
      true
    )
  })
})
