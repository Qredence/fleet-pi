/**
 * Shared Context Filtering Utility
 *
 * Implements a unified helper to filter array transcripts and ensure only the
 * latest message of a given custom type is retained, preventing transcript bloating.
 */

export function getCustomType(message: unknown): string | undefined {
  return typeof message === "object" &&
    message !== null &&
    "customType" in message &&
    typeof message.customType === "string"
    ? message.customType
    : undefined
}

export function keepLastCustomType(
  messages: Array<any>,
  activeType: string,
  typesToFilter?: Set<string>
) {
  // Find the index of the last message matching the active type
  const lastActiveIndex = messages.reduce(
    (lastIndex, message, index) =>
      getCustomType(message) === activeType ? index : lastIndex,
    -1
  )
  if (lastActiveIndex === -1) return undefined

  const filtered = messages.filter((message, index) => {
    const customType = getCustomType(message)
    if (!customType) return true

    if (typesToFilter) {
      if (!typesToFilter.has(customType)) return true
      return customType === activeType && index === lastActiveIndex
    } else {
      if (customType !== activeType) return true
      return index === lastActiveIndex
    }
  })

  if (filtered.length === messages.length) return undefined
  return { messages: filtered }
}
