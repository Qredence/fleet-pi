/**
 * Post-migration grants for the Neon Better Auth database.
 *
 * Better Auth / Neon Managed Auth operate as the auth authority — auth tables
 * must not use user-scoped RLS (that pattern is reserved for `pi_*` mirror
 * tables). Instead:
 * - Enable RLS so Neon Console / Data API Advisors fail closed by default
 * - Allow only `fleet_pi_app` (app DML role) via a dedicated policy
 * - Keep Data API roles (`authenticated` / `anonymous`) revoked and without
 *   permissive policies (deny-all under RLS)
 *
 * Neon Managed Auth stores identity in `neon_auth`. Leave `neon_auth` RLS off
 * for Neon-owned roles (those tables are not in the Data API public surface);
 * empty policy sets there are a deny-all trap for non-owners.
 */
export const AUTH_POSTGRES_POST_MIGRATE_SQL = `
DROP POLICY IF EXISTS user_self_access ON public."user";
DROP POLICY IF EXISTS session_user_isolation ON public."session";
DROP POLICY IF EXISTS account_user_isolation ON public."account";
DROP POLICY IF EXISTS verification_user_isolation ON public."verification";
DROP POLICY IF EXISTS fleet_pi_app_auth_access ON public."user";
DROP POLICY IF EXISTS fleet_pi_app_auth_access ON public."session";
DROP POLICY IF EXISTS fleet_pi_app_auth_access ON public."account";
DROP POLICY IF EXISTS fleet_pi_app_auth_access ON public."verification";

ALTER TABLE IF EXISTS public."user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."verification" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fleet_pi_app') THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'user'
    ) THEN
      CREATE POLICY fleet_pi_app_auth_access ON public."user"
        FOR ALL
        TO fleet_pi_app
        USING (true)
        WITH CHECK (true);
    END IF;
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'session'
    ) THEN
      CREATE POLICY fleet_pi_app_auth_access ON public."session"
        FOR ALL
        TO fleet_pi_app
        USING (true)
        WITH CHECK (true);
    END IF;
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'account'
    ) THEN
      CREATE POLICY fleet_pi_app_auth_access ON public."account"
        FOR ALL
        TO fleet_pi_app
        USING (true)
        WITH CHECK (true);
    END IF;
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'verification'
    ) THEN
      CREATE POLICY fleet_pi_app_auth_access ON public."verification"
        FOR ALL
        TO fleet_pi_app
        USING (true)
        WITH CHECK (true);
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'neon_auth' AND table_name = 'account'
  ) THEN
    ALTER TABLE neon_auth.account DISABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'neon_auth' AND table_name = 'invitation'
  ) THEN
    ALTER TABLE neon_auth.invitation DISABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'neon_auth' AND table_name = 'user'
  ) THEN
    ALTER TABLE neon_auth."user" DISABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'neon_auth' AND table_name = 'session'
  ) THEN
    ALTER TABLE neon_auth."session" DISABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'neon_auth' AND table_name = 'verification'
  ) THEN
    ALTER TABLE neon_auth.verification DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

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
