const maxUserIdBytes = 1024

export function userPiDurableName(userId: string): string {
  if (userId.length === 0) {
    throw new Error("Pi Durable object name must be a non-empty user id")
  }
  if (new TextEncoder().encode(userId).byteLength > maxUserIdBytes) {
    throw new Error(
      "Pi Durable object name must be a user id within 1024 bytes"
    )
  }
  return userId
}

export function userPiDurableStub<Stub>(
  namespace: { getByName: (name: string) => Stub },
  userId: string
): Stub {
  return namespace.getByName(userPiDurableName(userId))
}
