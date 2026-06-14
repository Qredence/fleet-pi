export const CHAT_POSTGRES_MIGRATION_ID = "20260522_pi_session_mirror"

export const CHAT_POSTGRES_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS fleet_pi_chat_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on pi_sessions to enforce user ownership at the database level
ALTER TABLE IF EXISTS pi_sessions ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'pi_sessions' AND policyname = 'pi_sessions_user_isolation'
  ) THEN
    CREATE POLICY pi_sessions_user_isolation ON pi_sessions
      FOR ALL
      USING (user_id IS NULL OR user_id = current_setting('app.current_user_id', true));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS pi_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NULL,
  session_file_path TEXT UNIQUE NOT NULL,
  cwd TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 3,
  parent_session_file_path TEXT,
  name TEXT,
  first_message_preview TEXT,
  leaf_entry_id TEXT,
  entry_count INTEGER NOT NULL DEFAULT 0,
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pi_sessions_user_updated_idx
ON pi_sessions(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS pi_sessions_cwd_updated_idx
ON pi_sessions(cwd, updated_at DESC);

CREATE TABLE IF NOT EXISTS pi_session_entries (
  session_id TEXT NOT NULL REFERENCES pi_sessions(id) ON DELETE CASCADE,
  entry_id TEXT NOT NULL,
  parent_entry_id TEXT,
  entry_type TEXT NOT NULL,
  role TEXT,
  custom_type TEXT,
  provider TEXT,
  model_id TEXT,
  thinking_level TEXT,
  target_entry_id TEXT,
  from_entry_id TEXT,
  content_text TEXT,
  summary TEXT,
  is_error BOOLEAN NOT NULL DEFAULT false,
  tokens_total INTEGER,
  cost_total NUMERIC,
  raw_entry JSONB NOT NULL,
  entry_timestamp TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, entry_id)
);

CREATE INDEX IF NOT EXISTS pi_session_entries_parent_idx
ON pi_session_entries(session_id, parent_entry_id);

CREATE INDEX IF NOT EXISTS pi_session_entries_timestamp_idx
ON pi_session_entries(session_id, entry_timestamp);

CREATE INDEX IF NOT EXISTS pi_session_entries_type_idx
ON pi_session_entries(entry_type);

CREATE INDEX IF NOT EXISTS pi_session_entries_role_idx
ON pi_session_entries(role);

CREATE INDEX IF NOT EXISTS pi_session_entries_raw_gin_idx
ON pi_session_entries USING GIN(raw_entry);

CREATE INDEX IF NOT EXISTS pi_session_entries_content_fts_idx
ON pi_session_entries
USING GIN(to_tsvector('english', COALESCE(content_text, '')));

CREATE TABLE IF NOT EXISTS pi_runs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES pi_sessions(id) ON DELETE CASCADE,
  assistant_message_id TEXT NOT NULL,
  session_turn_index INTEGER NOT NULL,
  mode TEXT,
  plan_action TEXT,
  status TEXT NOT NULL
    CHECK (status IN ('in_progress', 'completed', 'errored', 'aborted')),
  assistant_preview TEXT,
  error_message TEXT,
  event_count INTEGER NOT NULL DEFAULT 0,
  tool_call_count INTEGER NOT NULL DEFAULT 0,
  mutation_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  UNIQUE(session_id, session_turn_index)
);

CREATE INDEX IF NOT EXISTS pi_runs_session_idx
ON pi_runs(session_id, session_turn_index);

CREATE INDEX IF NOT EXISTS pi_runs_status_idx
ON pi_runs(status, completed_at, started_at);

CREATE TABLE IF NOT EXISTS pi_run_events (
  run_id TEXT NOT NULL REFERENCES pi_runs(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  summary TEXT,
  payload JSONB NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (run_id, sequence)
);

CREATE INDEX IF NOT EXISTS pi_run_events_run_idx
ON pi_run_events(run_id, sequence);

CREATE TABLE IF NOT EXISTS pi_tool_executions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES pi_sessions(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL REFERENCES pi_runs(id) ON DELETE CASCADE,
  tool_call_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  state TEXT NOT NULL,
  is_error BOOLEAN NOT NULL DEFAULT false,
  input JSONB NOT NULL,
  output JSONB,
  claimed_paths TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  first_sequence INTEGER NOT NULL,
  last_sequence INTEGER NOT NULL,
  UNIQUE(run_id, tool_call_id)
);

CREATE INDEX IF NOT EXISTS pi_tool_executions_run_idx
ON pi_tool_executions(run_id, first_sequence, last_sequence);

CREATE INDEX IF NOT EXISTS pi_tool_executions_session_idx
ON pi_tool_executions(session_id, tool_name);

CREATE TABLE IF NOT EXISTS pi_file_mutations (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES pi_runs(id) ON DELETE CASCADE,
  canonical_path TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('created', 'updated', 'deleted')),
  tool_call_id TEXT,
  event_sequence INTEGER,
  before_digest TEXT,
  after_digest TEXT,
  before_size INTEGER,
  after_size INTEGER,
  summary TEXT,
  recorded_at TIMESTAMPTZ NOT NULL,
  UNIQUE(run_id, canonical_path)
);

CREATE INDEX IF NOT EXISTS pi_file_mutations_run_idx
ON pi_file_mutations(run_id, canonical_path);

CREATE INDEX IF NOT EXISTS pi_file_mutations_path_idx
ON pi_file_mutations(canonical_path, recorded_at, run_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fleet_pi_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
      pi_sessions,
      pi_session_entries,
      pi_runs,
      pi_run_events,
      pi_tool_executions,
      pi_file_mutations
    TO fleet_pi_app;
  END IF;
END $$;
`
