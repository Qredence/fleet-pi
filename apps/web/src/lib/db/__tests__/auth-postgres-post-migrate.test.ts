import { describe, expect, it } from "vitest"
import { AUTH_POSTGRES_POST_MIGRATE_SQL } from "../auth-postgres-post-migrate"

describe("auth-postgres-post-migrate", () => {
  it("drops legacy public auth tables when neon_auth is present", () => {
    expect(AUTH_POSTGRES_POST_MIGRATE_SQL).toContain(
      "WHERE table_schema = 'neon_auth' AND table_name = 'user'"
    )
    expect(AUTH_POSTGRES_POST_MIGRATE_SQL).toContain(
      'DROP TABLE IF EXISTS public."verification"'
    )
    expect(AUTH_POSTGRES_POST_MIGRATE_SQL).toContain(
      'DROP TABLE IF EXISTS public."session"'
    )
    expect(AUTH_POSTGRES_POST_MIGRATE_SQL).toContain(
      'DROP TABLE IF EXISTS public."account"'
    )
    expect(AUTH_POSTGRES_POST_MIGRATE_SQL).toContain(
      'DROP TABLE IF EXISTS public."user"'
    )
  })

  it("keeps legacy self-hosted Better Auth RLS path when neon_auth is absent", () => {
    expect(AUTH_POSTGRES_POST_MIGRATE_SQL).toContain(
      'ALTER TABLE IF EXISTS public."user" ENABLE ROW LEVEL SECURITY'
    )
    expect(AUTH_POSTGRES_POST_MIGRATE_SQL).toContain(
      'CREATE POLICY fleet_pi_app_auth_access ON public."user"'
    )
    expect(AUTH_POSTGRES_POST_MIGRATE_SQL).toContain("TO fleet_pi_app")
    expect(AUTH_POSTGRES_POST_MIGRATE_SQL).toContain(
      'REVOKE ALL ON TABLE public."user" FROM authenticated'
    )
  })

  it("does not alter neon_auth RLS (leave Managed Auth schema to Neon)", () => {
    expect(AUTH_POSTGRES_POST_MIGRATE_SQL).not.toContain(
      "ALTER TABLE neon_auth"
    )
  })
})
