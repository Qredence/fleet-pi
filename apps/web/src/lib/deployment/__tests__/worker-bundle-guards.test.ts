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

  it("keeps Object Storage limited to the fleet-pi-spike proof bucket", () => {
    const neonConfig = readFileSync(join(WEB_SRC, "../../../neon.ts"), "utf8")
    expect(neonConfig).not.toMatch(/objectStorage|storageBuckets|bucketName/)
    expect(neonConfig).toContain("dataApi: false")
    expect(neonConfig).not.toMatch(/dataApi:\s*true/)
    expect(neonConfig).toContain("fleet-pi-pg18")
    expect(neonConfig).toMatch(/buckets:\s*\{\s*"fleet-pi-spike":\s*\{\s*\}/)
    expect(neonConfig).not.toMatch(
      /buckets:\s*\{[^}]*"[^"]+"\s*:\s*\{[^}]*\}[^}]*"[^"]+"/s
    )
  })

  it("does not import the S3 client or an R2 binding", () => {
    const offenders = productionSources(WEB_SRC).filter((path) => {
      const source = readFileSync(path, "utf8")
      return /@aws-sdk\/client-s3|lib\/storage\/object-storage|session-blob-store/.test(
        source
      )
    })
    expect(offenders).toEqual([])
    const wrangler = readFileSync(join(WEB_SRC, "../wrangler.jsonc"), "utf8")
    expect(wrangler).not.toMatch(/"r2_buckets"/)
    const migrations = readFileSync(
      join(WEB_SRC, "lib/db/chat-migrations.ts"),
      "utf8"
    )
    expect(migrations).not.toContain('from "./chat-postgres-data-api-auth"')
    expect(migrations).toContain("chat-postgres-data-api-auth")
  })
})
