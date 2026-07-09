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
  })

  it("grants DML on auth tables to fleet_pi_app", () => {
    expect(AUTH_POSTGRES_POST_MIGRATE_SQL).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."user" TO fleet_pi_app'
    )
    expect(AUTH_POSTGRES_POST_MIGRATE_SQL).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."verification" TO fleet_pi_app'
    )
  })
})
