import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const WEB_SRC = join(import.meta.dirname, "../../../")

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

describe("Cloudflare worker bundle guards", () => {
  it("does not value-import better-sqlite3 from production modules", () => {
    const offenders = productionSources(WEB_SRC).filter((path) => {
      const source = readFileSync(path, "utf8")
      return (
        /require\(["']better-sqlite3["']\)/.test(source) ||
        (/from ["']better-sqlite3["']/.test(source) &&
          !/import type .* from ["']better-sqlite3["']/.test(source))
      )
    })

    expect(offenders).toEqual([])
  })

  it("does not declare Neon object storage buckets", () => {
    const neonConfig = readFileSync(join(WEB_SRC, "../../../neon.ts"), "utf8")
    expect(neonConfig).not.toMatch(/objectStorage|storageBuckets|bucketName/)
    expect(neonConfig).toContain("fleet-pi-pg18")
  })
})
