import { readdir, readFile, stat } from "node:fs/promises"
import { basename, resolve } from "node:path"

const WORKSPACE_ROOT = "agent-workspace"
const PROJECT_MEMORY_DIR = `${WORKSPACE_ROOT}/memory/project`
const STUB_MARKER = "Seeded stub."

export type ProjectMemoryFile = {
  exists: boolean
  hasContent: boolean
  headings: Array<string>
  key: string
  path: string
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

export async function readProjectMemoryIndex(
  cwd: string
): Promise<ProjectMemoryIndex> {
  const canonical = await Promise.all(
    CANONICAL_PROJECT_MEMORY_FILES.map((file) =>
      readProjectMemoryFile(cwd, file.key, file.path, file.title)
    )
  )

  return {
    canonical,
    orphaned: await readOrphanedProjectMemory(cwd),
    projectMemoryDir: PROJECT_MEMORY_DIR,
  }
}

export function formatProjectMemoryForStartupContext(
  index: ProjectMemoryIndex
) {
  const lines = [
    "Project memory index:",
    ...index.canonical.map(
      (file) =>
        `- ${file.key}: ${formatMemoryFileStatus(file)} (${file.path})`
    ),
  ]

  if (index.orphaned.length > 0) {
    lines.push(
      `- orphaned: ${index.orphaned
        .map((file) => basename(file.path))
        .join(", ")} (searchable fallback; synthesize into canonical memory when useful)`
    )
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
  cwd: string,
  key: string,
  path: string,
  fallbackTitle: string
): Promise<ProjectMemoryFile> {
  try {
    const absolutePath = resolve(cwd, path)
    const info = await stat(absolutePath)
    if (!info.isFile()) {
      return emptyProjectMemoryFile(key, path, fallbackTitle, false)
    }

    const content = await readFile(absolutePath, "utf8")
    return {
      exists: true,
      hasContent: hasDurableContent(content),
      headings: extractSectionHeadings(content),
      key,
      path,
      title: extractTitle(content) ?? fallbackTitle,
    }
  } catch {
    return emptyProjectMemoryFile(key, path, fallbackTitle, false)
  }
}

async function readOrphanedProjectMemory(
  cwd: string
): Promise<Array<ProjectMemoryFile>> {
  const projectDir = resolve(cwd, PROJECT_MEMORY_DIR)
  let entries: Array<string>

  try {
    entries = (await readdir(projectDir, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => `${PROJECT_MEMORY_DIR}/${entry.name}`)
      .filter((path) => !CANONICAL_PATHS.has(path))
      .sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }

  return Promise.all(
    entries.map((path) =>
      readProjectMemoryFile(
        cwd,
        basename(path, ".md"),
        path,
        titleFromFilename(path)
      )
    )
  )
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

function hasDurableContent(content: string) {
  if (content.includes(STUB_MARKER)) return false

  return content
    .split("\n")
    .map((line) => line.trim())
    .some((line) => {
      if (!line.startsWith("- ")) return false

      const value = line.slice(2).trim()
      if (!value) return false
      if (/^[A-Z][A-Za-z -]*:\s*$/.test(value)) return false
      if (/To be filled/i.test(value)) return false
      return true
    })
}

function titleFromFilename(path: string) {
  return basename(path, ".md")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
