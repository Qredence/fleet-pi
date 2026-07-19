export const CHAT_POSTGRES_OWNERSHIP_EXECUTE_REVOKE_MIGRATION_ID =
  "20260719_revoke_ownership_probe_execute"

/**
 * Ownership probes are SECURITY DEFINER. Postgres defaults EXECUTE to PUBLIC;
 * table Data API revokes do not remove RPC. Lock EXECUTE to `fleet_pi_app` only
 * so `authenticated`/`anonymous` cannot enumerate session ownership via Data API.
 *
 * Idempotent for databases that already applied the ownership probe migration.
 */
export const CHAT_POSTGRES_OWNERSHIP_EXECUTE_REVOKE_SQL = `
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
