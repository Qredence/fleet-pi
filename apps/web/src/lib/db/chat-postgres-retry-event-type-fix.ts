// The id here must match the value recorded in the live fleet_pi_chat_migrations
// ledger (20260807_run_events_retry_event_type_fix). If it drifts, `pnpm
// chat:migrate` re-runs the already-applied migration; the SQL is idempotent
// so this is safe, but it wastes a migration run and takes unnecessary locks.
export const CHAT_POSTGRES_RETRY_EVENT_TYPE_FIX_MIGRATION_ID =
  "20260807_run_events_retry_event_type_fix"

/**
 * Corrects the `pi_run_events.event_type` CHECK domain to include `retry` —
 * the 11th ChatStreamEvent discriminator
 * (packages/pi-protocol/src/chat-protocol.ts). 20260807_db_optimization_2
 * shipped a 10-type list that omitted it, so any run that hits Pi's built-in
 * auto-retry (auto_retry_start/auto_retry_end -> { type: "retry" }) fails the
 * finalize flush: appendPiRunEvents rejects the whole batch (all of the run's
 * mirror events dropped) and the chained finalizePiRun is skipped, leaving
 * the pi_runs row stuck `in_progress`.
 *
 * The 20260807_db_optimization_2 SQL is fixed for fresh databases; this
 * migration repairs environments that already recorded the old list.
 * Idempotent: drops the constraint only when its definition lacks `retry`,
 * then re-adds it (with all 11 types) only when it is missing.
 */
export const CHAT_POSTGRES_RETRY_EVENT_TYPE_FIX_SQL = `
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pi_run_events_event_type_check'
      AND conrelid = 'pi_run_events'::regclass
      AND pg_get_constraintdef(oid) NOT LIKE '%retry%'
  ) THEN
    ALTER TABLE pi_run_events DROP CONSTRAINT pi_run_events_event_type_check;
  END IF;
END $$;

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
`
