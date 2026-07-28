#!/usr/bin/env node
/**
 * Design-system drift checker.
 *
 * Scans hax-design source for common token/pattern violations:
 *   1. --an-* namespace leakage into fleet-pi chrome
 *   2. Raw Tailwind palette colors in fleet-pi components
 *   3. rounded-[100px] instead of rounded-full
 *   4. Inline style props in fleet-pi components
 *   5. CSS animations/transitions missing reduced-motion guards
 *
 * Usage:
 *   node scripts/check-design-drift.js
 *
 * Exit codes:
 *   0 - no violations found
 *   1 - one or more violations detected
 */
const fs = require("fs")
const path = require("path")
const { execFileSync } = require("child_process")

const ROOT = path.resolve(__dirname, "..")
const HAX_SRC = path.join(ROOT, "packages/hax-design/src")
const FLEET_PI_DIR = path.join(HAX_SRC, "components/fleet-pi")

let violations = 0

function report(rule, file, line, match) {
  violations++
  const rel = path.relative(ROOT, file)
  console.error(`  \x1b[31m✗\x1b[0m [${rule}] ${rel}:${line}`)
  console.error(`    ${match.trim().slice(0, 120)}`)
}

function grep(pattern, cwd, glob) {
  try {
    const result = execFileSync(
      "grep",
      ["-rn", `--include=${glob}`, "-E", pattern, "."],
      { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    )
    return result
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [file, lineNum, ...rest] = line.split(":")
        return {
          file: path.resolve(cwd, file),
          line: lineNum,
          text: rest.join(":"),
        }
      })
  } catch {
    return []
  }
}

// ─── Rule 1: --an-* namespace in fleet-pi chrome ────────────────────────────
console.log(
  "\n\x1b[1mRule 1:\x1b[0m agent-elements token namespace (--an-*) in fleet-pi chrome"
)
{
  const hits = grep(
    "text-an-|bg-an-|border-an-|var\\(--an-",
    FLEET_PI_DIR,
    "*.tsx"
  )
  for (const h of hits) {
    // Allow CSS variable definitions and comments
    if (h.text.includes("//") && h.text.indexOf("//") < h.text.indexOf("an-"))
      continue
    report("an-namespace", h.file, h.line, h.text)
  }
  if (hits.length === 0) console.log("  \x1b[32m✓\x1b[0m Clean")
}

// ─── Rule 2: Raw Tailwind palette colors in fleet-pi ────────────────────────
console.log(
  "\n\x1b[1mRule 2:\x1b[0m Raw Tailwind palette colors in fleet-pi components"
)
{
  const palettePattern =
    "(text|bg|border|ring|shadow|outline)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]"
  const hits = grep(palettePattern, FLEET_PI_DIR, "*.tsx")
  for (const h of hits) {
    report("raw-palette", h.file, h.line, h.text)
  }
  if (hits.length === 0) console.log("  \x1b[32m✓\x1b[0m Clean")
}

// ─── Rule 3: rounded-[100px] should be rounded-full ─────────────────────────
console.log("\n\x1b[1mRule 3:\x1b[0m rounded-[100px] → rounded-full")
{
  const hits = grep("rounded-\\[100px\\]", HAX_SRC, "*.tsx")
  for (const h of hits) {
    report("rounded-100px", h.file, h.line, h.text)
  }
  if (hits.length === 0) console.log("  \x1b[32m✓\x1b[0m Clean")
}

// ─── Rule 4: Inline style props in fleet-pi components ──────────────────────
console.log("\n\x1b[1mRule 4:\x1b[0m Inline style props in fleet-pi components")
{
  const hits = grep(" style=\\{", FLEET_PI_DIR, "*.tsx")
  for (const h of hits) {
    // Allow style={} that sets CSS custom properties, width from props, or computed layout objects
    if (
      h.text.includes("--") ||
      h.text.includes("width") ||
      /style=\{[a-z]+Style\}/.test(h.text)
    )
      continue
    report("inline-style", h.file, h.line, h.text)
  }
  if (hits.length === 0) console.log("  \x1b[32m✓\x1b[0m Clean")
}

// ─── Rule 5: CSS animations without reduced-motion guard ────────────────────
console.log(
  "\n\x1b[1mRule 5:\x1b[0m CSS files with animation/transition missing reduced-motion guard"
)
{
  const cssFiles = execFileSync(
    "find",
    [".", "-name", "*.css", "-not", "-path", "*/node_modules/*"],
    {
      cwd: HAX_SRC,
      encoding: "utf-8",
    }
  )
    .trim()
    .split("\n")
    .filter(Boolean)

  for (const rel of cssFiles) {
    const filePath = path.join(HAX_SRC, rel)
    const content = fs.readFileSync(filePath, "utf-8")
    const hasAnimation = /animation:|transition:/.test(content)
    const hasGuard = /prefers-reduced-motion/.test(content)
    if (hasAnimation && !hasGuard) {
      // Check if it's imported into a file that has the guard (agent-ui.css has global guard)
      if (rel.includes("agent-ui.css")) continue // has its own guard now
      report(
        "no-motion-guard",
        filePath,
        0,
        "Has animation/transition but no prefers-reduced-motion guard"
      )
    }
  }
  if (violations === 0) console.log("  \x1b[32m✓\x1b[0m Clean")
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log("")
if (violations > 0) {
  console.error(
    `\x1b[31m✗ ${violations} design-system violation(s) found.\x1b[0m`
  )
  console.error("  See DESIGN.md §10 (Do's and Don'ts) for guidance.\n")
  process.exit(1)
} else {
  console.log("\x1b[32m✓ No design-system drift detected.\x1b[0m\n")
  process.exit(0)
}
