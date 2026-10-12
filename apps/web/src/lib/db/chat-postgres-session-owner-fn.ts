/**
 * Canonical `fleet_pi_check_session_owner`.
 *
 * `chat:migrate` applies this on every run, after the base schema. The base
 * schema must not define this function: it used to `CREATE OR REPLACE` a copy
 * without the tombstone branch, and the ledger then skipped the migration
 * that had added `deleted`.
 */
export const FLEET_PI_CHECK_SESSION_OWNER_SQL = `
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

REVOKE ALL ON FUNCTION fleet_pi_check_session_owner(TEXT, TEXT) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION fleet_pi_check_session_owner(TEXT, TEXT) FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anonymous') THEN
    REVOKE ALL ON FUNCTION fleet_pi_check_session_owner(TEXT, TEXT) FROM anonymous;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fleet_pi_app') THEN
    GRANT EXECUTE ON FUNCTION fleet_pi_check_session_owner(TEXT, TEXT) TO fleet_pi_app;
  END IF;
END $$;
`

export const CHAT_RUNTIME_ROLE_SQL = `
SELECT rolname, rolbypassrls, rolsuper
FROM pg_roles
WHERE rolname = current_user
`

export function chatRuntimeRoleBypassesRls(
  row: { rolbypassrls?: boolean; rolsuper?: boolean } | undefined
) {
  if (!row) return true
  return row.rolbypassrls === true || row.rolsuper === true
}

export function chatRuntimeRoleLabel(row: { rolname?: string } | undefined) {
  return row?.rolname || "unknown"
}
