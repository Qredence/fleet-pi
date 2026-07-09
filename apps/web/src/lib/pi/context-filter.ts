/**
 * Shared context filtering for Pi transcript custom message types.
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
    }

    if (customType !== activeType) return true
    return index === lastActiveIndex
  })

  if (filtered.length === messages.length) return undefined
  return { messages: filtered }
}
