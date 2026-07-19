export type RemapRow = {
  email: string
  oldUserId?: string
  newUserId: string
}

export function parseRemapFile(contents: string): Array<RemapRow> {
  return contents
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => {
      const parts = line.split(",").map((part) => part.trim())
      if (parts.length === 2) {
        const [email, newUserId] = parts
        if (!email || !newUserId) {
          throw new Error(`Invalid remap row: ${line}`)
        }
        return { email, newUserId }
      }
      if (parts.length === 3) {
        const [email, oldUserId, newUserId] = parts
        if (!email || !oldUserId || !newUserId) {
          throw new Error(`Invalid remap row: ${line}`)
        }
        return { email, oldUserId, newUserId }
      }
      throw new Error(
        `Invalid remap row (expected email,newUserId or email,oldUserId,newUserId): ${line}`
      )
    })
}

export function resolveOldUserId(
  row: RemapRow,
  legacyIdsByEmail: ReadonlyMap<string, string>
): string | undefined {
  if (row.oldUserId) {
    return row.oldUserId
  }
  return legacyIdsByEmail.get(row.email.toLowerCase())
}

export function assertNeonAuthUserIdMatch(
  email: string,
  csvNewUserId: string,
  neonAuthIdsByEmail: ReadonlyMap<string, string>
): void {
  const neonAuthId = neonAuthIdsByEmail.get(email.toLowerCase())
  if (!neonAuthId) {
    return
  }
  if (neonAuthId !== csvNewUserId) {
    throw new Error(
      `Remap mismatch for ${email}: CSV newUserId ${csvNewUserId} does not match neon_auth.user id ${neonAuthId}`
    )
  }
}
