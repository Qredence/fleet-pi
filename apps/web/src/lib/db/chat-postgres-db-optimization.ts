// The id here must match the value recorded in the live fleet_pi_chat_migrations
// ledger (20260725_db_optimization). If it drifts, `pnpm chat:migrate` re-runs the
// already-applied optimization; the SQL is idempotent so this is safe, but it
// wastes a migration run and takes unnecessary locks on the pi_* tables.
export const CHAT_POSTGRES_DB_OPTIMIZATION_MIGRATION_ID =
  "20260725_db_optimization"

/**
 * Drop duplicate/unused indexes, redundant unique constraint, add schema
 * improvements, and document table purpose.
 *
 * All statements use IF EXISTS / IF NOT EXISTS for idempotency.
 * VACUUM ANALYZE is not included because it cannot run inside a transaction.
 */
export const CHAT_POSTGRES_DB_OPTIMIZATION_SQL = `
-- 1. Drop exact duplicate index on pi_run_events (pi_run_events_pkey covers same columns)
DROP INDEX IF EXISTS pi_run_events_run_idx;

-- 2. Drop five never-scanned indexes on pi_session_entries
DROP INDEX IF EXISTS pi_session_entries_raw_gin_idx;
DROP INDEX IF EXISTS pi_session_entries_content_fts_idx;
DROP INDEX IF EXISTS pi_session_entries_parent_idx;
DROP INDEX IF EXISTS pi_session_entries_type_idx;
DROP INDEX IF EXISTS pi_session_entries_role_idx;

-- 3. Drop redundant unique constraint on pi_runs (non-unique pi_runs_session_idx covers same columns)
ALTER TABLE IF EXISTS pi_runs DROP CONSTRAINT IF EXISTS pi_runs_session_id_session_turn_index_key;

-- 4. Add FORCE ROW LEVEL SECURITY to fleet_pi_chat_migrations (consistency with other pi_* tables)
ALTER TABLE IF EXISTS fleet_pi_chat_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS fleet_pi_chat_migrations FORCE ROW LEVEL SECURITY;

-- 5. Add CHECK constraint on pi_sessions.version to catch migration drift
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pi_sessions_version_check'
      AND conrelid = 'pi_sessions'::regclass
  ) THEN
    ALTER TABLE pi_sessions ADD CONSTRAINT pi_sessions_version_check CHECK (version >= 3);
  END IF;
END $$;

-- 6. Document pi_file_mutations purpose
COMMENT ON TABLE pi_file_mutations IS 'Write-only audit trail of file mutations per run. Only mutation_count on pi_runs reads the aggregate. No detail reads exist yet.';
`
