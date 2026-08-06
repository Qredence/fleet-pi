export const MIRROR_WATERMARK_MIGRATION_ID =
  "20260807_pi_sessions_mirror_watermark"

/**
 * Persisted watermark columns on `pi_sessions` for incremental mirror sync.
 *
 * Without a persisted watermark, `upsertPiSessionEntriesIncremental` re-upserts
 * the whole history every turn (O(N) write amplification on Neon). These two
 * columns record the last synced entry (id + timestamp) and are advanced in the
 * SAME transaction as the entries upsert, so a failed sync never leaves a stale
 * watermark that could cause unmirrored entries to be skipped.
 *
 * Additive only — safe to apply to existing tables via `pnpm chat:migrate`.
 */
export const MIRROR_WATERMARK_MIGRATION_SQL = `
ALTER TABLE IF EXISTS pi_sessions
  ADD COLUMN IF NOT EXISTS last_synced_entry_id TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_entry_timestamp TIMESTAMPTZ;
`
