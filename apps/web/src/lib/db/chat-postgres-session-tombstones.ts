export const CHAT_POSTGRES_SESSION_TOMBSTONES_MIGRATION_ID =
  "20260711_pi_session_tombstones"

export const CHAT_POSTGRES_SESSION_TOMBSTONES_SQL = `
CREATE TABLE IF NOT EXISTS pi_session_tombstones (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pi_session_tombstones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pi_session_tombstones_user_isolation ON pi_session_tombstones;
CREATE POLICY pi_session_tombstones_user_isolation ON pi_session_tombstones
  FOR ALL
  USING (user_id = current_setting('app.current_user_id', true))
  WITH CHECK (user_id = current_setting('app.current_user_id', true));

CREATE OR REPLACE FUNCTION fleet_pi_check_session_owner(
  p_session_id TEXT,
  p_user_id TEXT
)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM pi_session_tombstones WHERE session_id = p_session_id
    ) THEN 'deleted'
    WHEN NOT EXISTS (SELECT 1 FROM pi_sessions WHERE id = p_session_id) THEN 'missing'
    WHEN (SELECT user_id FROM pi_sessions WHERE id = p_session_id) IS NULL THEN 'orphan'
    WHEN (SELECT user_id FROM pi_sessions WHERE id = p_session_id) = p_user_id THEN 'owned'
    ELSE 'foreign'
  END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fleet_pi_app') THEN
    GRANT SELECT, INSERT ON pi_session_tombstones TO fleet_pi_app;
    GRANT EXECUTE ON FUNCTION fleet_pi_check_session_owner(TEXT, TEXT) TO fleet_pi_app;
  END IF;
END $$;
`
