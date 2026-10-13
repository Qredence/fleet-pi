import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"

const webRoot = join(import.meta.dirname, "../../../../../")
const webSrc = join(webRoot, "src")

function productionSources(dir: string, files: Array<string> = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "__tests__" || entry.endsWith(".test.ts")) continue
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      productionSources(path, files)
      continue
    }
    if (path.endsWith(".ts") || path.endsWith(".tsx")) files.push(path)
  }
  return files
}

function readWrangler(): {
  durable_objects: {
    bindings: Array<{ name: string; class_name: string }>
  }
  exports: Record<string, { type: string; storage: string }>
  previews?: { durable_objects?: unknown }
} {
  const source = readFileSync(join(webRoot, "wrangler.jsonc"), "utf8")
  const json = source.replace(/^\s*\/\/.*$/gm, "").replace(/,\s*([}\]])/g, "$1")
  return JSON.parse(json)
}

describe("UserPiDurable binding", () => {
  it("binds one sqlite class in wrangler.jsonc", () => {
    const wrangler = readWrangler()
    expect(wrangler.durable_objects.bindings).toEqual([
      { name: "USER_PI_DURABLE", class_name: "UserPiDurable" },
    ])
    expect(wrangler.exports.UserPiDurable).toEqual({
      type: "durable-object",
      storage: "sqlite",
    })
    expect(wrangler.previews?.durable_objects).toEqual({
      bindings: [{ name: "USER_PI_DURABLE", class_name: "UserPiDurable" }],
    })
  })

  it("opens Pi Durable storage only inside the Durable Object", () => {
    const importers = productionSources(webSrc).filter((path) =>
      readFileSync(path, "utf8").includes("openDurableObjectSqliteStorage")
    )
    expect(importers.map((path) => relative(webSrc, path))).toEqual([
      "lib/pi/durable/user-pi-durable.ts",
    ])
  })

  it("does not construct an AgentSession", () => {
    const owner = readFileSync(
      join(webSrc, "lib/pi/durable/user-pi-durable.ts"),
      "utf8"
    )
    const server = readFileSync(join(webSrc, "server.ts"), "utf8")
    for (const source of [owner, server]) {
      expect(source).not.toContain("AgentSession")
      expect(source).not.toContain("createAgentSessionServices")
    }
    expect(server).toContain(
      'export { UserPiDurable } from "@/lib/pi/durable/user-pi-durable"'
    )
    expect(server).not.toContain("USER_PI_DURABLE")
  })

  it("leaves production /api/chat on Pi 1.0+", () => {
    const chat = readFileSync(join(webSrc, "routes/api/chat.ts"), "utf8")
    const sessionFactory = readFileSync(
      join(webSrc, "lib/pi/runtime/session-factory.ts"),
      "utf8"
    )
    expect(chat).not.toContain("UserPiDurable")
    expect(chat).not.toContain("durable-spike")
    expect(chat).toContain("postChatHandler")
    expect(sessionFactory).toContain("createAgentSessionServices")
    expect(sessionFactory).not.toContain("Harness.open")
  })
})
