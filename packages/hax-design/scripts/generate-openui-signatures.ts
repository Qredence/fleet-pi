import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { openUILibrary } from "../src/components/openui/openui-library.js"

const scriptDir = dirname(fileURLToPath(import.meta.url))
const outPath = join(scriptDir, "../../pi-protocol/src/openui-signatures.ts")

const spec = openUILibrary.toSpec()
const content = `// @generated — do not edit

import type { PromptSpec } from "@openuidev/lang-core"

export const openUIPromptSpec = ${JSON.stringify(spec, null, 2)} as PromptSpec
`

const isCheck = process.argv.includes("--check")

if (isCheck) {
  let existing: string
  try {
    existing = readFileSync(outPath, "utf-8")
  } catch {
    console.error(`${outPath} is missing. Run pnpm generate:openui-signatures`)
    process.exit(1)
  }

  if (existing !== content) {
    console.error(`${outPath} is stale. Run pnpm generate:openui-signatures`)
    process.exit(1)
  }

  console.log("openui-signatures.ts is up to date")
  process.exit(0)
}

writeFileSync(outPath, content)
console.log(`Wrote ${outPath}`)
