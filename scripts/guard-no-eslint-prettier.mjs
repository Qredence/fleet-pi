#!/usr/bin/env node
/**
 * Fails when a retired ESLint/Prettier config file reappears.
 *
 * The Oxc toolchain (Oxlint + Oxfmt via Vite+) replaced both. Dependency
 * enforcement lives in `.syncpackrc` (`isBanned`), which already reads every
 * workspace manifest — this script only catches the config files themselves,
 * matched by prefix so new variants cannot slip through.
 *
 * Run with `pnpm guard:no-eslint-prettier`. CI runs it in the `lint` job.
 */

import { readdirSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = fileURLToPath(new URL("..", import.meta.url))

/** Filenames/prefixes that only exist to configure a retired tool. */
const FORBIDDEN_FILE_PREFIXES = [
  "eslint.config.",
  ".eslintrc",
  ".eslintignore",
  ".prettierrc",
  ".prettierignore",
]

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".turbo",
  ".vercel",
  ".output",
  ".nitro",
  ".tanstack",
  ".vinxi",
  "coverage",
  ".git",
  "bundle-report",
])

const violations = []

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name))
      continue
    }
    if (
      FORBIDDEN_FILE_PREFIXES.some((prefix) => entry.name.startsWith(prefix))
    ) {
      violations.push(`${relative(ROOT, join(dir, entry.name))} still exists`)
    }
  }
}

walk(ROOT)

if (violations.length > 0) {
  console.error("Retired ESLint/Prettier config reappeared:\n")
  for (const violation of violations) console.error(`  - ${violation}`)
  console.error(
    "\nFormatting and linting run through Oxfmt and Oxlint via Vite+.\n" +
      "Configure them in the `fmt` and `lint` blocks of the root vite.config.ts."
  )
  process.exit(1)
}

console.log("No ESLint/Prettier config files present.")
