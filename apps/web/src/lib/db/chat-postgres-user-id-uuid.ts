/**
 * Convert every public `pi_*` auth-user column (`user_id`, `owner_id`, …) from
 * TEXT to UUID with a foreign key to Neon Auth's `neon_auth."user"(id)`
 * (ON DELETE CASCADE).
 *
 * Not ledger-gated: it runs on every `pnpm chat:migrate` and is idempotent.
 * A column that is already UUID *and* has its FK is skipped; when nothing is
 * pending the block returns without touching policies. When `neon_auth."user"`
 * does not exist (plain Postgres, local dev) the conversion is skipped.
 *
 * Safe on non-empty databases: rows whose value is not a UUID, or is a UUID
 * with no matching Neon Auth user, are copied as JSONB into
 * `pi_orphan_quarantine` before they are removed from the source table. For
 * `pi_sessions`, the dependent rows that ON DELETE CASCADE would drop
 * (entries, runs, run events, tool executions, file mutations) are
 * quarantined first, so nothing is lost. NULL owners (`pi_sessions` "orphan"
 * state) are kept as-is.
 *
 * The FK is added NOT VALID and then VALIDATEd. Policies that reference the
 * columns are dropped and re-created against `fleet_pi_current_user_uuid()`,
 * a UUID-typed wrapper around `fleet_pi_current_user_id()` that returns NULL
 * for non-UUID subjects (fail closed instead of erroring).
 */

const UUID_RE =
  "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"

/** Column names that hold an auth user id on pi_* tables. */
export const PI_USER_ID_COLUMN_NAMES = [
  "user_id",
  "owner_id",
  "owner_user_id",
  "auth_user_id",
] as const

const COLUMN_LIST = PI_USER_ID_COLUMN_NAMES.map((name) => `'${name}'`).join(
  ", "
)

/** Always (re)created; also used by the policies below. */
export const CHAT_POSTGRES_CURRENT_USER_UUID_SQL = `
CREATE OR REPLACE FUNCTION public.fleet_pi_current_user_uuid()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  subject TEXT := public.fleet_pi_current_user_id();
BEGIN
  IF subject ~ '${UUID_RE}' THEN
    RETURN subject::uuid;
  END IF;
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.fleet_pi_current_user_uuid() FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.fleet_pi_current_user_uuid() TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fleet_pi_app') THEN
    GRANT EXECUTE ON FUNCTION public.fleet_pi_current_user_uuid() TO fleet_pi_app;
  END IF;
END $$;
`

const OWNED = "(SELECT public.fleet_pi_current_user_uuid())"

const sessionScoped = (table: string) => `
    IF to_regclass('public.${table}') IS NOT NULL THEN
      EXECUTE $p$CREATE POLICY ${table}_user_isolation ON public.${table}
        FOR ALL
        USING (EXISTS (SELECT 1 FROM public.pi_sessions
          WHERE public.pi_sessions.id = public.${table}.session_id
            AND public.pi_sessions.user_id = ${OWNED}))
        WITH CHECK (EXISTS (SELECT 1 FROM public.pi_sessions
          WHERE public.pi_sessions.id = public.${table}.session_id
            AND public.pi_sessions.user_id = ${OWNED}))$p$;
    END IF;`

const runScoped = (table: string) => `
    IF to_regclass('public.${table}') IS NOT NULL THEN
      EXECUTE $p$CREATE POLICY ${table}_user_isolation ON public.${table}
        FOR ALL
        USING (EXISTS (SELECT 1 FROM public.pi_runs
          JOIN public.pi_sessions ON public.pi_sessions.id = public.pi_runs.session_id
          WHERE public.pi_runs.id = public.${table}.run_id
            AND public.pi_sessions.user_id = ${OWNED}))
        WITH CHECK (EXISTS (SELECT 1 FROM public.pi_runs
          JOIN public.pi_sessions ON public.pi_sessions.id = public.pi_runs.session_id
          WHERE public.pi_runs.id = public.${table}.run_id
            AND public.pi_sessions.user_id = ${OWNED}))$p$;
    END IF;`

const direct = (table: string, policy: string) => `
    IF to_regclass('public.${table}') IS NOT NULL THEN
      EXECUTE $p$CREATE POLICY ${policy} ON public.${table}
        FOR ALL
        USING (user_id = ${OWNED})
        WITH CHECK (user_id = ${OWNED})$p$;
    END IF;`

/** Rows of `child` (FK `fk_col` → parent ids in `_fp_orphan_sessions`/runs). */
const quarantineChild = (child: string, where: string) => `
      IF to_regclass('public.${child}') IS NOT NULL THEN
        EXECUTE $q$INSERT INTO public.pi_orphan_quarantine
            (source_table, source_column, reason, row_data)
          SELECT '${child}', 'user_id', 'cascade:pi_sessions', to_jsonb(c)
          FROM public.${child} c WHERE ${where}$q$
          USING orphan_ids;
      END IF;`

export const CHAT_POSTGRES_USER_ID_UUID_SQL = `
${CHAT_POSTGRES_CURRENT_USER_UUID_SQL}

DO $migration$
DECLARE
  col RECORD;
  pol RECORD;
  pending INTEGER := 0;
  fk_name TEXT;
  orphan_ids TEXT[];
  moved INTEGER;
  not_owned TEXT;
  not_owned_t TEXT;
BEGIN
  IF to_regclass('neon_auth."user"') IS NULL THEN
    RAISE NOTICE 'pi user_id uuid: neon_auth."user" not found, skipping';
    RETURN;
  END IF;

  -- Pending = a pi_* user column that is not UUID yet or lacks its FK.
  SELECT count(*) INTO pending
  FROM information_schema.columns c
  JOIN information_schema.tables t
    ON t.table_schema = c.table_schema AND t.table_name = c.table_name
  WHERE c.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND c.table_name LIKE 'pi\\_%'
    AND c.table_name <> 'pi_orphan_quarantine'
    AND c.column_name IN (${COLUMN_LIST})
    AND (
      c.data_type <> 'uuid'
      OR NOT EXISTS (
        SELECT 1 FROM pg_constraint k
        WHERE k.contype = 'f'
          AND k.conrelid = format('public.%I', c.table_name)::regclass
          AND k.confrelid = 'neon_auth."user"'::regclass
          AND k.conkey = ARRAY[(
            SELECT a.attnum FROM pg_attribute a
            WHERE a.attrelid = format('public.%I', c.table_name)::regclass
              AND a.attname = c.column_name
          )]::smallint[]
      )
    );

  IF pending = 0 THEN
    RAISE NOTICE 'pi user_id uuid: already converted, skipping';
    RETURN;
  END IF;

  CREATE TABLE IF NOT EXISTS public.pi_orphan_quarantine (
    id BIGSERIAL PRIMARY KEY,
    source_table TEXT NOT NULL,
    source_column TEXT NOT NULL,
    reason TEXT NOT NULL,
    row_data JSONB NOT NULL,
    quarantined_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  -- Owner-only: no policies and no grants, so fleet_pi_app and Data API
  -- roles can never read quarantined rows.
  ALTER TABLE public.pi_orphan_quarantine ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.pi_orphan_quarantine FORCE ROW LEVEL SECURITY;
  REVOKE ALL ON TABLE public.pi_orphan_quarantine FROM PUBLIC;

  -- Policies reference the columns; ALTER COLUMN TYPE refuses while they
  -- exist. Drop every pi_* policy that mentions a user column; the canonical
  -- set is re-created below.
  FOR pol IN
    SELECT p.tablename, p.policyname
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename LIKE 'pi\\_%'
      AND (
        coalesce(p.qual, '') ~ '(user_id|owner_id|owner_user_id|auth_user_id)'
        OR coalesce(p.with_check, '') ~ '(user_id|owner_id|owner_user_id|auth_user_id)'
      )
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;

  FOR col IN
    SELECT c.table_name::text AS tbl, c.column_name::text AS cname,
           c.data_type::text AS dtype
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name LIKE 'pi\\_%'
      AND c.table_name <> 'pi_orphan_quarantine'
      AND c.column_name IN (${COLUMN_LIST})
    ORDER BY (c.table_name = 'pi_sessions') DESC, c.table_name, c.column_name
  LOOP
    -- Predicate for rows that cannot satisfy the FK (%1$s = column expr).
    not_owned := format(
      '%1$s IS NOT NULL AND (%1$s::text !~ %2$L OR NOT EXISTS (
         SELECT 1 FROM neon_auth."user" u
         WHERE u.id = CASE WHEN %1$s::text ~ %2$L THEN %1$s::text::uuid END))',
      quote_ident(col.cname), '${UUID_RE}'
    );
    not_owned_t := format(
      '%1$s IS NOT NULL AND (%1$s::text !~ %2$L OR NOT EXISTS (
         SELECT 1 FROM neon_auth."user" u
         WHERE u.id = CASE WHEN %1$s::text ~ %2$L THEN %1$s::text::uuid END))',
      't.' || quote_ident(col.cname), '${UUID_RE}'
    );

    IF col.tbl = 'pi_sessions' THEN
      EXECUTE format('SELECT coalesce(array_agg(id), ARRAY[]::text[]) FROM public.pi_sessions WHERE %s', not_owned)
        INTO orphan_ids;
      IF cardinality(orphan_ids) > 0 THEN
        ${quarantineChild("pi_session_entries", "c.session_id = ANY($1)")}
        ${quarantineChild("pi_tool_executions", "c.session_id = ANY($1)")}
        ${quarantineChild("pi_file_mutations", "c.run_id IN (SELECT r.id FROM public.pi_runs r WHERE r.session_id = ANY($1))")}
        ${quarantineChild("pi_run_events", "c.run_id IN (SELECT r.id FROM public.pi_runs r WHERE r.session_id = ANY($1))")}
        ${quarantineChild("pi_runs", "c.session_id = ANY($1)")}
      END IF;
    END IF;

    EXECUTE format(
      $q$INSERT INTO public.pi_orphan_quarantine (source_table, source_column, reason, row_data)
         SELECT %1$L, %2$L,
           CASE WHEN t.%2$I::text ~ %3$L THEN 'unknown_user' ELSE 'invalid_uuid' END,
           to_jsonb(t)
         FROM public.%1$I t WHERE %4$s$q$,
      col.tbl, col.cname, '${UUID_RE}', not_owned_t
    );
    GET DIAGNOSTICS moved = ROW_COUNT;
    IF moved > 0 THEN
      EXECUTE format('DELETE FROM public.%I WHERE %s', col.tbl, not_owned);
      RAISE NOTICE 'pi user_id uuid: quarantined % row(s) from %.%', moved, col.tbl, col.cname;
    END IF;

    IF col.dtype <> 'uuid' THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE uuid USING %I::uuid',
        col.tbl, col.cname, col.cname);
    END IF;

    fk_name := left(format('%s_%s_neon_auth_user_fkey', col.tbl, col.cname), 63);
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint k
      WHERE k.conrelid = format('public.%I', col.tbl)::regclass
        AND k.conname = fk_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES neon_auth."user"(id) ON DELETE CASCADE NOT VALID',
        col.tbl, fk_name, col.cname);
    END IF;
    EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I', col.tbl, fk_name);
  END LOOP;

  -- Re-create the canonical isolation policies against the UUID subject.
  ${direct("pi_sessions", "pi_sessions_user_isolation")}
  ${sessionScoped("pi_session_entries")}
  ${sessionScoped("pi_runs")}
  ${runScoped("pi_run_events")}
  ${sessionScoped("pi_tool_executions")}
  ${runScoped("pi_file_mutations")}
  ${direct("pi_user_providers", "pi_user_providers_isolation")}
  ${direct("pi_user_settings", "pi_user_settings_isolation")}
  ${direct("pi_session_tombstones", "pi_session_tombstones_user_isolation")}
END $migration$;
`
