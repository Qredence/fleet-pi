/**
 * Post-migration grants for the Neon Better Auth database.
 *
 * Better Auth operates as the auth authority — auth tables must not use
 * user-scoped RLS (that pattern is reserved for pi_* mirror tables).
 * The app role `fleet_pi_app` needs DML on all Better Auth tables.
 */
export const AUTH_POSTGRES_POST_MIGRATE_SQL = `
ALTER TABLE IF EXISTS public."user" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."session" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."account" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."verification" DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."user" TO fleet_pi_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."session" TO fleet_pi_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."account" TO fleet_pi_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."verification" TO fleet_pi_app;
`
