/**
 * Post-migration grants for the Neon Better Auth database.
 *
 * When Neon Managed Auth is present (`neon_auth."user"` exists), identity lives
 * in `neon_auth` and legacy public Better Auth tables are dropped — do not
 * RLS-harden leftovers. Tenant isolation stays on `pi_*` via `app.current_user_id`.
 *
 * When Managed Auth is absent (legacy self-hosted Better Auth only), public
 * `user` / `session` / `account` / `verification` remain the auth store: enable
 * RLS, allow only `fleet_pi_app`, and revoke Data API roles.
 */
export const AUTH_POSTGRES_POST_MIGRATE_SQL = `
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'neon_auth' AND table_name = 'user'
  ) THEN
    DROP TABLE IF EXISTS public."verification";
    DROP TABLE IF EXISTS public."session";
    DROP TABLE IF EXISTS public."account";
    DROP TABLE IF EXISTS public."user";
  ELSE
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

    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."user" TO fleet_pi_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."session" TO fleet_pi_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."account" TO fleet_pi_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."verification" TO fleet_pi_app;

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
  END IF;
END $$;
`
