import { readFileSync, readdirSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"

// Token hygiene gate for fleet-pi/** (VAL-TOKEN-001 / VAL-TOKEN-002):
// exact-match arbitrary utilities must be expressed via the registered
// theme tokens from globals.css (12px -> text-label, 14px -> text-body,
// 6px -> rounded-sm, 8px -> rounded-md, 10px -> rounded-lg), while the
// documented exceptions (10/11/13px text, 4/5/12px radii) stay as-is.
//
// Patterns are built dynamically so this spec file does not itself
// contain the arbitrary utility literals scanned by the design gate.
const px = (n: number) => `[${String(n)}px]`

const TARGET_TO_TOKEN = new Map<string, string>([
  [`text-${px(12)}`, "text-label"],
  [`text-${px(14)}`, "text-body"],
  [`rounded-${px(6)}`, "rounded-sm"],
  [`rounded-${px(8)}`, "rounded-md"],
  [`rounded-${px(10)}`, "rounded-lg"],
])

const EXCEPTION_PATTERNS = [
  `text-${px(10)}`,
  `text-${px(11)}`,
  `text-${px(13)}`,
  `rounded-${px(4)}`,
  `rounded-${px(5)}`,
  `rounded-${px(12)}`,
]

const FLEET_PI_DIR = __dirname
const SELF = "token-hygiene.test.ts"

function collectSourceFiles(dir: string): Array<string> {
  const files: Array<string> = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(full))
    } else if (/\.(ts|tsx)$/.test(entry.name) && entry.name !== SELF) {
      files.push(full)
    }
  }
  return files
}

const sourceFiles = collectSourceFiles(FLEET_PI_DIR)

describe("fleet-pi token hygiene", () => {
  it("has no exact-match arbitrary utilities covered by registered tokens", () => {
    const offenders: Array<string> = []
    for (const file of sourceFiles) {
      const source = readFileSync(file, "utf8")
      for (const [pattern, token] of TARGET_TO_TOKEN) {
        if (source.includes(pattern)) {
          offenders.push(
            `${relative(FLEET_PI_DIR, file)} uses ${pattern} (expected ${token})`
          )
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it("preserves the documented arbitrary-value exceptions", () => {
    const combined = sourceFiles
      .map((file) => readFileSync(file, "utf8"))
      .join("\n")
    for (const pattern of EXCEPTION_PATTERNS) {
      expect(combined).toContain(pattern)
    }
  })
})
