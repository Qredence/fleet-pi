import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const authModePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../auth-mode.ts"
)

describe("auth-mode client boundary", () => {
  it("does not import Node-only chat auth surface helpers", async () => {
    const source = await readFile(authModePath, "utf8")

    expect(source).not.toMatch(/node:async_hooks/)
    expect(source).not.toMatch(/chat-auth-surface/)
  })
})
