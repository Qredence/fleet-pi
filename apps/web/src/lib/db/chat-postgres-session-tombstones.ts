import { FLEET_PI_CHECK_SESSION_OWNER_SQL } from "./chat-postgres-session-owner-fn"

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
  USING (user_id = (SELECT current_setting('app.current_user_id', true)))
  WITH CHECK (user_id = (SELECT current_setting('app.current_user_id', true)));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fleet_pi_app') THEN
    GRANT SELECT, INSERT ON pi_session_tombstones TO fleet_pi_app;
  END IF;
END $$;

${FLEET_PI_CHECK_SESSION_OWNER_SQL}
`
