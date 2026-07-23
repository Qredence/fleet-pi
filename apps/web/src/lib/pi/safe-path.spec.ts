import { mkdir, mkdtemp, readFile, rm, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  assertSafePath,
  removeNoFollowFile,
  writeNoFollowFile,
} from "../../../../../.pi/extensions/lib/safe-path"

const roots: Array<string> = []

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true }))
  )
})

describe("safe filesystem paths", () => {
  it("rejects symlinked parents and permits regular nested writes", async () => {
    const root = await mkdtemp(join(tmpdir(), "fleet-pi-safe-path-"))
    roots.push(root)
    await mkdir(join(root, "agent-workspace", "scratch"), { recursive: true })
    const outside = await mkdtemp(join(tmpdir(), "fleet-pi-safe-outside-"))
    roots.push(outside)
    await symlink(outside, join(root, "agent-workspace", "scratch", "link"))

    await expect(
      assertSafePath(
        join(root, "agent-workspace"),
        join(root, "agent-workspace", "scratch", "link", "escaped.txt"),
        { allowMissingLeaf: true }
      )
    ).rejects.toThrow()

    const safe = join(root, "agent-workspace", "scratch", "safe.txt")
    await assertSafePath(join(root, "agent-workspace"), safe, {
      allowMissingLeaf: true,
    })
    await writeNoFollowFile(join(root, "agent-workspace"), safe, "safe")
    await expect(readFile(safe, "utf8")).resolves.toBe("safe")
  })

  it("refuses symlink targets during delete", async () => {
    const root = await mkdtemp(join(tmpdir(), "fleet-pi-safe-delete-"))
    roots.push(root)
    const outside = await mkdtemp(
      join(tmpdir(), "fleet-pi-safe-delete-outside-")
    )
    roots.push(outside)
    const outsideFile = join(outside, "keep.txt")
    await writeNoFollowFile(outside, outsideFile, "keep")
    const link = join(root, "link.txt")
    await symlink(outsideFile, link)

    await expect(removeNoFollowFile(root, link)).rejects.toThrow()
    await expect(readFile(outsideFile, "utf8")).resolves.toBe("keep")
  })
})
