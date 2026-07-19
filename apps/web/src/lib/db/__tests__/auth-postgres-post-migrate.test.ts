import { describe, expect, it } from "vitest"
import { AUTH_POSTGRES_POST_MIGRATE_SQL } from "../auth-postgres-post-migrate"

describe("auth-postgres-post-migrate", () => {
  it("enables RLS on Better Auth tables with fleet_pi_app-only access", () => {
    expect(AUTH_POSTGRES_POST_MIGRATE_SQL).toContain(
      'ALTER TABLE IF EXISTS public."user" ENABLE ROW LEVEL SECURITY'
    )
    expect(AUTH_POSTGRES_POST_MIGRATE_SQL).toContain(
      'ALTER TABLE IF EXISTS public."session" ENABLE ROW LEVEL SECURITY'
    )
    expect(AUTH_POSTGRES_POST_MIGRATE_SQL).toContain(
      'ALTER TABLE IF EXISTS public."account" ENABLE ROW LEVEL SECURITY'
    )
    expect(AUTH_POSTGRES_POST_MIGRATE_SQL).toContain(
      'ALTER TABLE IF EXISTS public."verification" ENABLE ROW LEVEL SECURITY'
    )
    expect(AUTH_POSTGRES_POST_MIGRATE_SQL).toContain(
      'CREATE POLICY fleet_pi_app_auth_access ON public."user"'
    )
    expect(AUTH_POSTGRES_POST_MIGRATE_SQL).toContain("TO fleet_pi_app")
    expect(AUTH_POSTGRES_POST_MIGRATE_SQL).toContain(
      "ALTER TABLE neon_auth.account DISABLE ROW LEVEL SECURITY"
    )
    expect(AUTH_POSTGRES_POST_MIGRATE_SQL).toContain(
      "ALTER TABLE neon_auth.invitation DISABLE ROW LEVEL SECURITY"
    )
  })

  it("drops leftover public auth isolation policies and revokes Data API roles", () => {
    expect(AUTH_POSTGRES_POST_MIGRATE_SQL).toContain(
      'DROP POLICY IF EXISTS user_self_access ON public."user"'
    )
    expect(AUTH_POSTGRES_POST_MIGRATE_SQL).toContain(
      'REVOKE ALL ON TABLE public."user" FROM authenticated'
    )
  })
})
