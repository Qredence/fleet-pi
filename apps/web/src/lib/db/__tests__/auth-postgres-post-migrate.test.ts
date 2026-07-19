import { describe, expect, it } from "vitest"
import { AUTH_POSTGRES_POST_MIGRATE_SQL } from "../auth-postgres-post-migrate"

describe("auth-postgres-post-migrate", () => {
  it("disables RLS on Better Auth tables", () => {
    expect(AUTH_POSTGRES_POST_MIGRATE_SQL).toContain(
      'ALTER TABLE IF EXISTS public."user" DISABLE ROW LEVEL SECURITY'
    )
    expect(AUTH_POSTGRES_POST_MIGRATE_SQL).toContain(
      'ALTER TABLE IF EXISTS public."session" DISABLE ROW LEVEL SECURITY'
    )
    expect(AUTH_POSTGRES_POST_MIGRATE_SQL).toContain(
      'ALTER TABLE IF EXISTS public."account" DISABLE ROW LEVEL SECURITY'
    )
    expect(AUTH_POSTGRES_POST_MIGRATE_SQL).toContain(
      'ALTER TABLE IF EXISTS public."verification" DISABLE ROW LEVEL SECURITY'
    )
    expect(AUTH_POSTGRES_POST_MIGRATE_SQL).toContain(
      "ALTER TABLE neon_auth.account DISABLE ROW LEVEL SECURITY"
    )
    expect(AUTH_POSTGRES_POST_MIGRATE_SQL).toContain(
      "ALTER TABLE neon_auth.invitation DISABLE ROW LEVEL SECURITY"
    )
  })

  it("drops leftover public auth isolation policies", () => {
    expect(AUTH_POSTGRES_POST_MIGRATE_SQL).toContain(
      'DROP POLICY IF EXISTS user_self_access ON public."user"'
    )
    expect(AUTH_POSTGRES_POST_MIGRATE_SQL).toContain(
      'REVOKE ALL ON TABLE public."user" FROM authenticated'
    )
  })
})
