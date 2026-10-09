// The id here must match the value recorded in the live fleet_pi_chat_migrations
// ledger (20260807_drop_recreated_unused_indexes).
export const CHAT_POSTGRES_DROP_RECREATED_INDEXES_MIGRATION_ID =
  "20260807_drop_recreated_unused_indexes"

/**
 * Drop the four indexes that the base schema (chat-postgres-schema.ts) used to
 * recreate on every `pnpm chat:migrate` run before the recorded drop migrations
 * executed — undoing 20260803_drop_unused_indexes and
 * 20260807_db_optimization_2 on each subsequent run.
 *
 * The base schema no longer creates them (schema fix), so this migration only
 * needs to run once to clean environments that already re-ran the schema:
 *
 * - pi_sessions_cwd_updated_idx: no query filters pi_sessions by cwd.
 * - pi_runs_status_idx: no query filters pi_runs by status.
 * - pi_file_mutations_run_idx: exact duplicate of the UNIQUE
 *   (run_id, canonical_path) key.
 * - pi_file_mutations_path_idx: never scanned (0 idx_scan); the table is a
 *   write-only audit trail.
 *
 * Idempotent (IF EXISTS) and safe to apply anywhere.
 */
export const CHAT_POSTGRES_DROP_RECREATED_INDEXES_SQL = `
DROP INDEX IF EXISTS pi_sessions_cwd_updated_idx;
DROP INDEX IF EXISTS pi_runs_status_idx;
DROP INDEX IF EXISTS pi_file_mutations_run_idx;
DROP INDEX IF EXISTS pi_file_mutations_path_idx;
`
