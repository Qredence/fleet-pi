/**
 * Historical probe. It runs before `pi_session_tombstones` exists, so it cannot
 * install the tombstone-aware function. `chat:migrate` re-applies
 * `FLEET_PI_CHECK_SESSION_OWNER_SQL` after that table exists, on every run.
 */
export const CHAT_POSTGRES_SESSION_OWNERSHIP_MIGRATION_ID =
  "20260710_pi_session_ownership_probe"

export const CHAT_POSTGRES_SESSION_OWNERSHIP_SQL = `
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
    WHEN NOT EXISTS (SELECT 1 FROM pi_sessions WHERE id = p_session_id) THEN 'missing'
    WHEN (SELECT user_id FROM pi_sessions WHERE id = p_session_id) IS NULL THEN 'orphan'
    WHEN (SELECT user_id FROM pi_sessions WHERE id = p_session_id) = p_user_id THEN 'owned'
    ELSE 'foreign'
  END
$$;

CREATE OR REPLACE FUNCTION fleet_pi_lookup_session_id_by_file(
  p_session_file_path TEXT
)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM pi_sessions
  WHERE session_file_path = p_session_file_path
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION fleet_pi_check_session_owner(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION fleet_pi_lookup_session_id_by_file(TEXT) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION fleet_pi_check_session_owner(TEXT, TEXT) FROM authenticated;
    REVOKE ALL ON FUNCTION fleet_pi_lookup_session_id_by_file(TEXT) FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anonymous') THEN
    REVOKE ALL ON FUNCTION fleet_pi_check_session_owner(TEXT, TEXT) FROM anonymous;
    REVOKE ALL ON FUNCTION fleet_pi_lookup_session_id_by_file(TEXT) FROM anonymous;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fleet_pi_app') THEN
    GRANT EXECUTE ON FUNCTION fleet_pi_check_session_owner(TEXT, TEXT) TO fleet_pi_app;
    GRANT EXECUTE ON FUNCTION fleet_pi_lookup_session_id_by_file(TEXT) TO fleet_pi_app;
  END IF;
END $$;
`
