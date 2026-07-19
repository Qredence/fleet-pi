/**
 * Post-migration grants for the Neon Better Auth database.
 *
 * Better Auth / Neon Managed Auth operate as the auth authority — legacy
 * `public` auth tables must not use user-scoped RLS (that pattern is reserved
 * for `pi_*` mirror tables). Drop leftover isolation policies, disable RLS,
 * grant DML to `fleet_pi_app`, and revoke Data API roles that should not touch
 * auth or Pi mirror tables without dedicated JWT policies.
 */
export const AUTH_POSTGRES_POST_MIGRATE_SQL = `
DROP POLICY IF EXISTS user_self_access ON public."user";
DROP POLICY IF EXISTS session_user_isolation ON public."session";
DROP POLICY IF EXISTS account_user_isolation ON public."account";
DROP POLICY IF EXISTS verification_user_isolation ON public."verification";

ALTER TABLE IF EXISTS public."user" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."session" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."account" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."verification" DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."user" TO fleet_pi_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."session" TO fleet_pi_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."account" TO fleet_pi_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."verification" TO fleet_pi_app;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public."user" FROM authenticated;
    REVOKE ALL ON TABLE public."session" FROM authenticated;
    REVOKE ALL ON TABLE public."account" FROM authenticated;
    REVOKE ALL ON TABLE public."verification" FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anonymous') THEN
    REVOKE ALL ON TABLE public."user" FROM anonymous;
    REVOKE ALL ON TABLE public."session" FROM anonymous;
    REVOKE ALL ON TABLE public."account" FROM anonymous;
    REVOKE ALL ON TABLE public."verification" FROM anonymous;
  END IF;
END $$;
`
