export type SessionOwnershipRow = {
  user_id: string | null
}

/**
 * Resolves mirror-backed session ownership for an authenticated user.
 * Returns true when access is allowed, false when it must be denied.
 */
export function resolveSessionOwnershipFromRow(
  row: SessionOwnershipRow | undefined,
  userId: string
): boolean {
  if (!row) {
    // Not mirrored yet (e.g. first turn before upsert).
    return true
  }

  if (!row.user_id) {
    return false
  }

  return row.user_id === userId
}
