export type OpenUIContentSegment =
  | { content: string; type: "markdown" }
  | { content: string; type: "openui" }

const OPENUI_FENCE_PATTERN = /```(?:openui|openui-lang)\s*\n([\s\S]*?)```/gi

export function stripOpenUIWrapper(content: string) {
  const cleaned = content.trim()

  if (cleaned.startsWith("```")) {
    const firstLineEnd = cleaned.indexOf("\n")
    if (firstLineEnd === -1) return cleaned

    const rest = cleaned.slice(firstLineEnd + 1).trim()
    return rest.endsWith("```") ? rest.slice(0, -3).trim() : rest
  }

  if (cleaned.startsWith("`") && cleaned.endsWith("`")) {
    return cleaned.slice(1, -1).trim()
  }

  return cleaned
}

export function isOpenUIProgram(content: string) {
  return stripOpenUIWrapper(content).startsWith("root =")
}

export function segmentOpenUIContent(
  content: string
): Array<OpenUIContentSegment> {
  const stripped = stripOpenUIWrapper(content)
  if (stripped.startsWith("root =")) {
    return [{ type: "openui", content: stripped }]
  }

  const segments: Array<OpenUIContentSegment> = []
  let lastIndex = 0

  for (const match of content.matchAll(OPENUI_FENCE_PATTERN)) {
    const index = match.index
    const markdown = content.slice(lastIndex, index)
    if (markdown.trim()) {
      segments.push({ type: "markdown", content: markdown })
    }

    const openUI = stripOpenUIWrapper(match[1])
    segments.push(
      isOpenUIProgram(openUI)
        ? { type: "openui", content: openUI }
        : { type: "markdown", content: match[0] }
    )

    lastIndex = index + match[0].length
  }

  const trailingMarkdown = content.slice(lastIndex)
  if (trailingMarkdown.trim()) {
    segments.push({ type: "markdown", content: trailingMarkdown })
  }

  return segments.length > 0 ? segments : [{ type: "markdown", content }]
}
