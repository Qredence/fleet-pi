import { readFile, readdir, stat } from "node:fs/promises"
import { resolve } from "node:path"

import { readProjectMemoryIndexWith } from "../../../apps/web/src/lib/pi/workspace-memory-core"

import type {
  ProjectMemoryIndex,
  ProjectMemoryReader,
} from "../../../apps/web/src/lib/pi/workspace-memory-core"

export {
  CANONICAL_PROJECT_MEMORY_FILES,
  extractPromptTerms,
  formatProjectMemoryForStartupContext,
  formatProjectMemoryForWorkspaceIndex,
  selectScoredSnippets,
} from "../../../apps/web/src/lib/pi/workspace-memory-core"
export type {
  ProjectMemoryFile,
  ProjectMemoryIndex,
} from "../../../apps/web/src/lib/pi/workspace-memory-core"

/** Reads canonical project memory from the local repo checkout. */
export function readProjectMemoryIndex(
  cwd: string
): Promise<ProjectMemoryIndex> {
  return readProjectMemoryIndexWith(createLocalProjectMemoryReader(cwd))
}

function createLocalProjectMemoryReader(cwd: string): ProjectMemoryReader {
  return {
    readFile: async (path) => {
      try {
        const absolutePath = resolve(cwd, path)
        const info = await stat(absolutePath)
        if (!info.isFile()) return undefined
        return await readFile(absolutePath, "utf8")
      } catch {
        return undefined
      }
    },
    listMarkdownFiles: async (dir) => {
      try {
        const entries = await readdir(resolve(cwd, dir), {
          withFileTypes: true,
        })
        return entries
          .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
          .map((entry) => entry.name)
      } catch {
        return []
      }
    },
  }
}
