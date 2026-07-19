import { constants } from "node:fs"
import { lstat, open, unlink } from "node:fs/promises"
import { dirname, relative, resolve, sep } from "node:path"

export async function assertSafePath(
  root: string,
  target: string,
  options: { allowMissingLeaf?: boolean } = {}
) {
  const absoluteRoot = resolve(root)
  const rootInfo = await lstat(absoluteRoot)
  if (rootInfo.isSymbolicLink()) {
    throw new Error("Symlinked paths are not allowed.")
  }
  const absoluteTarget = resolve(target)
  const rel = relative(absoluteRoot, absoluteTarget)
  if (
    rel.startsWith(`..${sep}`) ||
    rel === ".." ||
    absoluteTarget === absoluteRoot
  ) {
    throw new Error("Path escapes the approved root.")
  }

  const parts = rel.split(sep)
  let current = absoluteRoot
  for (const [index, part] of parts.entries()) {
    current = resolve(current, part)
    try {
      const info = await lstat(current)
      if (info.isSymbolicLink()) {
        throw new Error("Symlinked paths are not allowed.")
      }
      if (index === parts.length - 1 && !info.isFile()) {
        throw new Error("Target must be a regular file.")
      }
    } catch (error) {
      if (
        options.allowMissingLeaf &&
        index === parts.length - 1 &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        const parent = dirname(current)
        const parentRel = relative(absoluteRoot, parent)
        if (parentRel.startsWith(`..${sep}`) || parentRel === "..") {
          throw new Error("Path escapes the approved root.")
        }
        return current
      }
      throw error
    }
  }
  return absoluteTarget
}

export async function writeNoFollowFile(
  root: string,
  path: string,
  content: string
) {
  let created = false
  let handle
  try {
    handle = await open(path, constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    handle = await open(
      path,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        (constants.O_NOFOLLOW ?? 0),
      0o600
    )
    created = true
  }
  try {
    await assertSafePath(root, path)
    const [opened, current] = await Promise.all([handle.stat(), lstat(path)])
    if (
      current.isSymbolicLink() ||
      !current.isFile() ||
      opened.dev !== current.dev ||
      opened.ino !== current.ino
    ) {
      throw new Error("Path changed while opening the target.")
    }
    await handle.truncate(0)
    await handle.writeFile(content, "utf8")
  } catch (error) {
    if (created) {
      const opened = await handle.stat().catch(() => null)
      const current = await lstat(path).catch(() => null)
      if (
        opened &&
        current &&
        opened.dev === current.dev &&
        opened.ino === current.ino
      ) {
        await unlink(path).catch(() => undefined)
      }
    }
    throw error
  } finally {
    await handle.close()
  }
}

export async function removeNoFollowFile(root: string, path: string) {
  let handle
  try {
    handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
    await assertSafePath(root, path)
    const [opened, current] = await Promise.all([handle.stat(), lstat(path)])
    if (
      current.isSymbolicLink() ||
      !current.isFile() ||
      opened.dev !== current.dev ||
      opened.ino !== current.ino
    ) {
      throw new Error("Target must be a regular file.")
    }
    await unlink(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return
    throw error
  } finally {
    await handle?.close()
  }
}
