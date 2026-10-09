// The id here must match the value recorded in the live fleet_pi_chat_migrations
// ledger (20260807_db_optimization_2). If it drifts, `pnpm chat:migrate` re-runs
// the already-applied migration; the SQL is idempotent so this is safe, but it
// wastes a migration run and takes unnecessary locks on the pi_* tables.
export const CHAT_POSTGRES_OPTIMIZATION_2_MIGRATION_ID =
  "20260807_db_optimization_2"

/**
 * Second round of chat mirror table optimization (2026-08-07), grounded in
 * live pg_stat_* diagnostics:
 *
 * 1. Drop `pi_file_mutations_path_idx` (0 idx_scan; the table is a write-only
 *    audit trail per its own COMMENT, and the unique `(run_id, canonical_path)`
 *    key covers per-run path lookups).
 * 2. Add `pi_run_events(recorded_at)` so the 90-day TTL purge and any
 *    time-bucketed reads use an index instead of scanning the PK prefix.
 * 3. Add a CHECK on `pi_run_events.event_type` — the 11 types produced by the
 *    protocol (ChatStreamEvent union) today, including `retry` (Pi's built-in
 *    auto-retry emits `auto_retry_start`/`auto_retry_end`, surfaced as
 *    `{ type: "retry" }`). Mirror writes stay fail-open: a future protocol
 *    type would be logged, not fatal to chat streaming.
 * 4. Lower autovacuum/analyze thresholds on `pi_user_settings` and
 *    `pi_user_providers`: tiny hot tables (110+ updates on 2 rows) never cross
 *    the 50-row default threshold, so they accumulate bloat and stale planner
 *    stats (pi_user_settings had a 512 kB index for 2 rows).
 *
 * All statements are idempotent. VACUUM/REINDEX are intentionally not included
 * (they cannot run inside a transaction) — see scripts/maintain-chat-mirror.ts.
 */
export const CHAT_POSTGRES_OPTIMIZATION_2_SQL = `
-- 1. Drop the never-scanned index on the write-only audit table
DROP INDEX IF EXISTS pi_file_mutations_path_idx;

-- 2. Time-bucketed index for the 90-day TTL purge on pi_run_events
CREATE INDEX IF NOT EXISTS pi_run_events_recorded_at_idx
  ON pi_run_events(recorded_at);

-- 3. CHECK the stream event type domain (protocol union: start, state, delta,
--    thinking, plan, tool, error, done, queue, compaction, retry)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pi_run_events_event_type_check'
      AND conrelid = 'pi_run_events'::regclass
  ) THEN
    ALTER TABLE pi_run_events ADD CONSTRAINT pi_run_events_event_type_check
      CHECK (event_type IN ('start', 'state', 'delta', 'thinking', 'plan', 'tool', 'error', 'done', 'queue', 'compaction', 'retry'));
  END IF;
END $$;

-- 4. Autovacuum thresholds for tiny hot tables that never reach the 50-row
--    default (pi_user_settings: 110 updates / 2 rows, last autoanalyze Jul 19;
--    pi_user_providers: never autoanalyzed)
ALTER TABLE IF EXISTS pi_user_settings SET (
  autovacuum_vacuum_threshold = 10,
  autovacuum_analyze_threshold = 10
);
ALTER TABLE IF EXISTS pi_user_providers SET (
  autovacuum_vacuum_threshold = 10,
  autovacuum_analyze_threshold = 10
);
`
