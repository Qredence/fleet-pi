/**
 * Worker-safe project memory index: parsing, prompt-aware scoring, and
 * formatting for canonical `agent-workspace/memory/project/*` files.
 *
 * No `node:*` imports. Callers supply a {@link ProjectMemoryReader}: the local
 * Pi extension reads the repo with `node:fs`, the hosted Durable Object reads
 * the user's Daytona volume or its own workspace store.
 */

const WORKSPACE_ROOT = "agent-workspace"
const PROJECT_MEMORY_DIR = `${WORKSPACE_ROOT}/memory/project`
const STUB_MARKER = "Seeded stub."

export type ProjectMemoryFile = {
  exists: boolean
  hasContent: boolean
  headings: Array<string>
  key: string
  path: string
  snippets: Array<string>
  title: string
}

export type ProjectMemoryIndex = {
  canonical: Array<ProjectMemoryFile>
  orphaned: Array<ProjectMemoryFile>
  projectMemoryDir: string
}

export const CANONICAL_PROJECT_MEMORY_FILES = [
  {
    key: "architecture",
    path: `${PROJECT_MEMORY_DIR}/architecture.md`,
    title: "Architecture",
  },
  {
    key: "decisions",
    path: `${PROJECT_MEMORY_DIR}/decisions.md`,
    title: "Decisions",
  },
  {
    key: "preferences",
    path: `${PROJECT_MEMORY_DIR}/preferences.md`,
    title: "Preferences",
  },
  {
    key: "open-questions",
    path: `${PROJECT_MEMORY_DIR}/open-questions.md`,
    title: "Open Questions",
  },
  {
    key: "known-issues",
    path: `${PROJECT_MEMORY_DIR}/known-issues.md`,
    title: "Known Issues",
  },
] as const

const CANONICAL_PATHS = new Set<string>(
  CANONICAL_PROJECT_MEMORY_FILES.map((file) => file.path)
)

/** Reads workspace files by `agent-workspace/`-prefixed path. */
export type ProjectMemoryReader = {
  /** File content, or undefined when the path is missing or not a file. */
  readFile: (path: string) => Promise<string | undefined>
  /** Markdown file names (not paths) directly inside `dir`; [] when missing. */
  listMarkdownFiles: (dir: string) => Promise<Array<string>>
}

export async function readProjectMemoryIndexWith(
  reader: ProjectMemoryReader
): Promise<ProjectMemoryIndex> {
  const canonical = await Promise.all(
    CANONICAL_PROJECT_MEMORY_FILES.map((file) =>
      readProjectMemoryFile(reader, file.key, file.path, file.title)
    )
  )

  return {
    canonical,
    orphaned: await readOrphanedProjectMemory(reader),
    projectMemoryDir: PROJECT_MEMORY_DIR,
  }
}

export function formatProjectMemoryForStartupContext(
  index: ProjectMemoryIndex,
  promptText?: string
) {
  const lines = [
    "Project memory index:",
    ...index.canonical.map(
      (file) => `- ${file.key}: ${formatMemoryFileStatus(file)} (${file.path})`
    ),
  ]

  if (index.orphaned.length > 0) {
    lines.push(
      `- orphaned: ${index.orphaned
        .map((file) => markdownBasename(file.path) + ".md")
        .join(
          ", "
        )} (searchable fallback; synthesize into canonical memory when useful)`
    )
  }

  const snippetLines = promptText
    ? selectScoredSnippets(index.canonical, promptText, 10)
    : formatMemorySnippets(index.canonical)
  if (snippetLines.length > 0) {
    lines.push("Project memory recall snippets:", ...snippetLines)
  }

  lines.push(
    "Memory write protocol: for normal 'remember this' requests, update the narrowest canonical project memory file. Use ad hoc project-memory files only when explicitly requested, for temporary harness tests, or for raw material that will be synthesized later."
  )
  lines.push(
    `Recall protocol: for memory/recall questions, inspect canonical project memory first. If the answer is not there, run find/grep across ${PROJECT_MEMORY_DIR} before saying it is missing.`
  )

  return lines.join("\n")
}

export function formatProjectMemoryForWorkspaceIndex(
  index: ProjectMemoryIndex
) {
  const lines = [
    "Memory:",
    ...index.canonical.map(
      (file) => `- ${file.path} (${formatMemoryFileStatus(file)})`
    ),
  ]

  if (index.orphaned.length > 0) {
    lines.push(
      "Orphaned project memory:",
      ...index.orphaned.map(
        (file) =>
          `- ${file.path} (${formatMemoryFileStatus(file)}; synthesize into canonical memory when useful)`
      )
    )
  }

  return lines
}

async function readProjectMemoryFile(
  reader: ProjectMemoryReader,
  key: string,
  path: string,
  fallbackTitle: string
): Promise<ProjectMemoryFile> {
  let content: string | undefined
  try {
    content = await reader.readFile(path)
  } catch {
    content = undefined
  }
  if (content === undefined) {
    return emptyProjectMemoryFile(key, path, fallbackTitle, false)
  }

  const snippets = extractMemorySnippets(content)
  return {
    exists: true,
    hasContent: snippets.length > 0,
    headings: extractSectionHeadings(content),
    key,
    path,
    snippets,
    title: extractTitle(content) ?? fallbackTitle,
  }
}

async function readOrphanedProjectMemory(
  reader: ProjectMemoryReader
): Promise<Array<ProjectMemoryFile>> {
  let entries: Array<string>
  try {
    entries = (await reader.listMarkdownFiles(PROJECT_MEMORY_DIR))
      .filter((name) => name.endsWith(".md"))
      .map((name) => `${PROJECT_MEMORY_DIR}/${name}`)
      .filter((path) => !CANONICAL_PATHS.has(path))
      .sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }

  return Promise.all(
    entries.map((path) =>
      readProjectMemoryFile(
        reader,
        markdownBasename(path),
        path,
        titleFromFilename(path)
      )
    )
  )
}

function markdownBasename(path: string) {
  const name = path.slice(path.lastIndexOf("/") + 1)
  return name.endsWith(".md") ? name.slice(0, -".md".length) : name
}

function emptyProjectMemoryFile(
  key: string,
  path: string,
  title: string,
  exists: boolean
): ProjectMemoryFile {
  return {
    exists,
    hasContent: false,
    headings: [],
    key,
    path,
    snippets: [],
    title,
  }
}

function extractTitle(content: string) {
  for (const line of content.split("\n")) {
    const match = line.match(/^#\s+(.+)/)
    if (match) return match[1].trim()
  }
  return undefined
}

function extractSectionHeadings(content: string) {
  return content
    .split("\n")
    .map((line) => line.match(/^#{2,3}\s+(.+)/)?.[1]?.trim())
    .filter((heading): heading is string => Boolean(heading))
    .filter((heading) => !/^template$/i.test(heading))
    .slice(0, 4)
}

function formatMemoryFileStatus(file: ProjectMemoryFile) {
  if (!file.exists) return "missing"
  if (!file.hasContent) return "template only"
  if (file.headings.length === 0) return "has content"
  return `has content; sections: ${file.headings.join(", ")}`
}

function formatMemorySnippets(files: Array<ProjectMemoryFile>) {
  return files.flatMap((file) =>
    file.snippets.slice(0, 3).map((snippet) => `- ${file.key}: ${snippet}`)
  )
}

function extractMemorySnippets(content: string) {
  if (content.includes(STUB_MARKER)) return []

  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (!line.startsWith("- ")) return false

      const value = line.slice(2).trim()
      if (!value) return false
      if (/^[A-Z][A-Za-z -]*:\s*$/.test(value)) return false
      if (/To be filled/i.test(value)) return false
      return true
    })
    .map((line) => truncateSnippet(line.slice(2).trim()))
}

function truncateSnippet(value: string) {
  const maxLength = 220
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 1).trimEnd()}…`
}

function titleFromFilename(path: string) {
  return markdownBasename(path)
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

const STOP_WORDS = new Set([
  "a",
  "about",
  "above",
  "after",
  "again",
  "against",
  "all",
  "am",
  "an",
  "and",
  "any",
  "are",
  "aren't",
  "as",
  "at",
  "be",
  "because",
  "been",
  "before",
  "being",
  "below",
  "between",
  "both",
  "but",
  "by",
  "can't",
  "cannot",
  "could",
  "couldn't",
  "did",
  "didn't",
  "do",
  "does",
  "doesn't",
  "doing",
  "don't",
  "down",
  "during",
  "each",
  "few",
  "for",
  "from",
  "further",
  "had",
  "hadn't",
  "has",
  "hasn't",
  "have",
  "haven't",
  "having",
  "he",
  "he'd",
  "he'll",
  "he's",
  "her",
  "here",
  "here's",
  "hers",
  "herself",
  "him",
  "himself",
  "his",
  "how",
  "how's",
  "i",
  "i'd",
  "i'll",
  "i'm",
  "i've",
  "if",
  "in",
  "into",
  "is",
  "isn't",
  "it",
  "it's",
  "its",
  "itself",
  "let's",
  "me",
  "more",
  "most",
  "mustn't",
  "my",
  "myself",
  "no",
  "nor",
  "not",
  "of",
  "off",
  "on",
  "once",
  "only",
  "or",
  "other",
  "ought",
  "our",
  "ours",
  "ourselves",
  "out",
  "over",
  "own",
  "same",
  "shan't",
  "she",
  "she'd",
  "she'll",
  "she's",
  "should",
  "shouldn't",
  "so",
  "some",
  "such",
  "than",
  "that",
  "that's",
  "the",
  "their",
  "theirs",
  "them",
  "themselves",
  "then",
  "there",
  "there's",
  "these",
  "they",
  "they'd",
  "they'll",
  "they're",
  "they've",
  "this",
  "those",
  "through",
  "to",
  "too",
  "under",
  "until",
  "up",
  "very",
  "was",
  "wasn't",
  "we",
  "we'd",
  "we'll",
  "we're",
  "we've",
  "were",
  "weren't",
  "what",
  "what's",
  "when",
  "when's",
  "where",
  "where's",
  "which",
  "while",
  "who",
  "who's",
  "whom",
  "why",
  "why's",
  "with",
  "won't",
  "would",
  "wouldn't",
  "you",
  "you'd",
  "you'll",
  "you're",
  "you've",
  "your",
  "yours",
  "yourself",
  "yourselves",
])

export function extractPromptTerms(prompt: string): Set<string> {
  const terms = new Set<string>()
  const words = prompt
    .toLowerCase()
    .replace(/[^\w\s'-]/g, "")
    .split(/\s+/)

  for (const word of words) {
    const trimmed = word.trim()
    if (trimmed && trimmed.length > 1 && !STOP_WORDS.has(trimmed)) {
      terms.add(trimmed)
    }
  }

  return terms
}

export function selectScoredSnippets(
  files: Array<ProjectMemoryFile>,
  promptText: string,
  limit = 10
): Array<string> {
  const terms = extractPromptTerms(promptText)
  if (terms.size === 0) {
    return files.flatMap((file) =>
      file.snippets.slice(0, 2).map((snippet) => `- ${file.key}: ${snippet}`)
    )
  }

  type ScoredSnippet = {
    fileKey: string
    snippet: string
    score: number
    index: number
  }

  const scored: Array<ScoredSnippet> = []
  let globalIndex = 0

  for (const file of files) {
    for (const snippet of file.snippets) {
      const snippetLower = snippet.toLowerCase()
      let score = 0
      for (const term of terms) {
        if (snippetLower.includes(term)) {
          score += 1
        }
      }
      scored.push({
        fileKey: file.key,
        snippet,
        score,
        index: globalIndex++,
      })
    }
  }

  const sorted = scored
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.index - b.index
    })

  if (sorted.length < limit) {
    const matchedSet = new Set(sorted.map((item) => item.snippet))
    for (const file of files) {
      for (const snippet of file.snippets) {
        if (!matchedSet.has(snippet)) {
          sorted.push({
            fileKey: file.key,
            snippet,
            score: 0,
            index: globalIndex++,
          })
          matchedSet.add(snippet)
          if (sorted.length >= limit) break
        }
      }
      if (sorted.length >= limit) break
    }
  }

  const formatted: Array<string> = []
  const seen = new Set<string>()

  for (const item of sorted) {
    const key = `${item.fileKey}:${item.snippet}`
    if (!seen.has(key)) {
      seen.add(key)
      formatted.push(`- ${item.fileKey}: ${item.snippet}`)
      if (formatted.length >= limit) break
    }
  }

  return formatted
}
