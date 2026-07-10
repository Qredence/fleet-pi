export type SessionOwnershipRow = {
  user_id: string | null
}

export type SessionOwnershipStatus = "owned" | "foreign" | "missing" | "orphan"

/**
 * Resolves mirror-backed session ownership for an authenticated user.
 * Returns true when access is allowed, false when it must be denied.
 */
export function resolveSessionOwnershipFromRow(
  row: SessionOwnershipRow | undefined,
  userId: string
): boolean {
  return isSessionAccessAllowed(
    resolveSessionOwnershipStatusFromRow(row, userId)
  )
}

export function resolveSessionOwnershipStatusFromRow(
  row: SessionOwnershipRow | undefined,
  userId: string
): SessionOwnershipStatus {
  if (!row) {
    return "missing"
  }

  if (!row.user_id) {
    return "orphan"
  }

  return row.user_id === userId ? "owned" : "foreign"
}

export function isSessionAccessAllowed(
  status: SessionOwnershipStatus
): boolean {
  switch (status) {
    case "owned":
    case "missing":
      return true
    case "foreign":
    case "orphan":
      return false
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}

export function isSessionOwnershipStatus(
  value: string
): value is SessionOwnershipStatus {
  return (
    value === "owned" ||
    value === "foreign" ||
    value === "missing" ||
    value === "orphan"
  )
}
