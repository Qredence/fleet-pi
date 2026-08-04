export const CHAT_POSTGRES_DROP_UNUSED_INDEXES_MIGRATION_ID =
  "20260803_drop_unused_indexes"

/**
 * Drop indexes confirmed unused by Neon stats (0 idx_scan) and by code review
 * (no query references them). All are non-destructive and idempotent.
 *
 * - pi_runs_status_idx: no query filters pi_runs by status.
 * - pi_sessions_cwd_updated_idx: no query filters pi_sessions by cwd.
 * - pi_file_mutations_run_idx: duplicate of the unique
 *   pi_file_mutations_run_id_canonical_path_key (same leading columns).
 */
export const CHAT_POSTGRES_DROP_UNUSED_INDEXES_SQL = `
DROP INDEX IF EXISTS pi_runs_status_idx;
DROP INDEX IF EXISTS pi_sessions_cwd_updated_idx;
DROP INDEX IF EXISTS pi_file_mutations_run_idx;
`
