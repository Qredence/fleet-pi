import { describe, expect, it } from "vitest"

import { withAppRole } from "../app-role"
import { CHAT_POSTGRES_DATA_API_REVOKE_RECONCILE_SQL } from "../chat-postgres-data-api-revoke-reconcile"

const SQL = CHAT_POSTGRES_DATA_API_REVOKE_RECONCILE_SQL

describe("chat-postgres-data-api-revoke-reconcile", () => {
  it("drops the legacy migrations read-only policy", () => {
    expect(SQL).toContain(
      "DROP POLICY IF EXISTS fleet_pi_chat_migrations_read_only ON public.fleet_pi_chat_migrations"
    )
  })

  it("targets both Data API roles and skips missing ones", () => {
    expect(SQL).toContain("ARRAY['authenticated', 'anonymous']")
    expect(SQL).toContain(
      "IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = target)"
    )
  })

  it("revokes neondb_owner default privileges on tables, sequences, and functions", () => {
    for (const kind of ["TABLES", "SEQUENCES", "FUNCTIONS"]) {
      expect(SQL).toContain(
        `ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public REVOKE ALL ON ${kind} FROM %I`
      )
    }
    // Guarded: pg_has_role errors on a missing role, so existence is checked first.
    expect(SQL).toContain(
      "IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'neondb_owner')"
    )
    expect(SQL).toContain("pg_has_role(current_user, 'neondb_owner', 'MEMBER')")
    expect(SQL).not.toContain("cloud_admin")
  })

  it("revokes table privileges only on pi_* and fleet_pi_* objects in public", () => {
    // Escaped underscores so LIKE does not treat `_` as a wildcard; this
    // covers pi_orphan_quarantine and any future pi_* table.
    expect(SQL).toContain("c.relname LIKE 'pi\\_%'")
    expect(SQL).toContain("c.relname LIKE 'fleet\\_pi\\_%'")
    expect(SQL).toContain("REVOKE ALL ON TABLE public.%I FROM %I")
    expect(SQL).toContain("REVOKE ALL ON SEQUENCE public.%I FROM %I")
    expect(SQL).not.toMatch(/ALL TABLES IN SCHEMA/i)
  })

  it("revokes fleet_pi_* function EXECUTE from Data API roles and PUBLIC", () => {
    expect(SQL).toContain("p.proname LIKE 'fleet\\_pi\\_%'")
    expect(SQL).toContain("REVOKE ALL ON ROUTINE %s FROM %I")
    expect(SQL).toContain("REVOKE ALL ON ROUTINE %s FROM PUBLIC")
    expect(SQL).not.toMatch(/ALL FUNCTIONS IN SCHEMA/i)
  })

  it("re-grants function EXECUTE to the default app role", () => {
    expect(SQL).toContain(
      "IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fleet_pi_app')"
    )
    expect(SQL).toContain(
      "GRANT EXECUTE ON ROUTINE %s TO %I', r.signature, 'fleet_pi_app')"
    )
  })

  it("re-targets the app-role grant via withAppRole without touching fleet_pi_% patterns", () => {
    const sql = withAppRole(SQL, "fleet_pi_app_v2")
    expect(sql).toContain("rolname = 'fleet_pi_app_v2'")
    expect(sql).toContain("r.signature, 'fleet_pi_app_v2')")
    expect(sql).not.toMatch(/'fleet_pi_app'/)
    expect(sql).toContain("p.proname LIKE 'fleet\\_pi\\_%'")
    expect(sql).toContain("fleet_pi_chat_migrations_read_only")
  })

  it("never grants anything to the Data API roles", () => {
    expect(SQL).not.toMatch(/GRANT [^;]* TO (authenticated|anonymous)/)
  })
})
