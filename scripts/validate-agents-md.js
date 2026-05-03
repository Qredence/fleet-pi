#!/usr/bin/env node
/**
 * Validates that commands documented in AGENTS.md exist in package.json
 * scripts and execute without error.
 *
 * Usage:
 *   node scripts/validate-agents-md.js
 *
 * Exit codes:
 *   0 - all documented commands are valid
 *   1 - one or more documented commands are broken
 */
const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

const AGENTS_MD = path.resolve("AGENTS.md")
const PACKAGE_JSON = path.resolve("package.json")

// Built-in pnpm commands that don't need to be in package.json
const PNPM_BUILTINS = new Set([
  "install",
  "exec",
  "add",
  "remove",
  "update",
  "run",
  "version",
])

// Scripts that should only be checked for existence, not executed.
// Some mutate files, while others require extra runtime setup that this validator
// job does not provision.
const EXISTENCE_ONLY_SCRIPTS = new Set([
  "syncpack:fix",
  "e2e",
  "symphony:run",
  "symphony:validate",
  "symphony:test-plugin",
])

// Commands to skip (Pi tool commands, examples with placeholders, self-referencing)
const SKIP_PATTERNS = [
  /^read\s+/,
  /^create\s+/,
  /^edit\s+/,
  /^run\s+pnpm\s+--version$/,
  /^pnpm\s+.*<.*>.*$/,
  /^validate-agents-md$/, // skip self to avoid infinite recursion
]

function shouldSkip(command) {
  const withoutPrefix = command.replace(/^pnpm\s+/, "")
  for (const pattern of SKIP_PATTERNS) {
    if (pattern.test(command) || pattern.test(withoutPrefix)) return true
  }
  return false
}

function extractPnpmCommands(content) {
  const commands = new Set()

  // Match backtick-quoted commands starting with "pnpm "
  const matches = content.matchAll(/`pnpm\s+([^`]+)`/g)
  for (const match of matches) {
    commands.add("pnpm " + match[1].trim())
  }

  return Array.from(commands).sort()
}

function extractScriptName(command) {
  const parts = command.split(/\s+/)
  if (parts[0] !== "pnpm") return null

  let i = 1
  while (i < parts.length && parts[i].startsWith("-")) {
    i++
  }

  return i < parts.length ? parts[i] : null
}

function main() {
  console.log("🔍 Parsing commands from AGENTS.md...\n")

  if (!fs.existsSync(AGENTS_MD)) {
    console.error("❌ AGENTS.md not found")
    process.exit(1)
  }

  const agentsContent = fs.readFileSync(AGENTS_MD, "utf8")
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON, "utf8"))
  const scripts = packageJson.scripts || {}

  const commands = extractPnpmCommands(agentsContent)

  if (commands.length === 0) {
    console.log("⚠️  No pnpm commands found in AGENTS.md")
    process.exit(0)
  }

  let failed = 0
  let skipped = 0
  let passed = 0

  for (const command of commands) {
    if (shouldSkip(command)) {
      console.log(`⏭️  SKIP: "${command}" (example/placeholder)`)
      skipped++
      continue
    }

    const scriptName = extractScriptName(command)

    if (!scriptName) {
      console.log(`❌ FAIL: "${command}" - could not extract script name`)
      failed++
      continue
    }

    const isBuiltin = PNPM_BUILTINS.has(scriptName)
    const isScript = scripts[scriptName] !== undefined

    if (!isBuiltin && !isScript) {
      console.log(
        `❌ FAIL: "${command}" - script "${scriptName}" not found in package.json`
      )
      failed++
      continue
    }

    // For scripts that mutate files or require extra runtime setup, only check
    // existence instead of executing them in the validator job.
    if (EXISTENCE_ONLY_SCRIPTS.has(scriptName)) {
      const reason =
        scriptName === "syncpack:fix"
          ? "existence check only - modifies files"
          : scriptName === "e2e"
            ? "existence check only - requires e2e runtime setup"
            : "existence check only - requires external Symphony repo/runtime setup"

      console.log(`✅ PASS: "${command}" (${reason})`)
      passed++
      continue
    }

    // For pnpm install, just verify it's a built-in (don't modify lockfile)
    if (scriptName === "install") {
      console.log(`✅ PASS: "${command}" (pnpm built-in, existence verified)`)
      passed++
      continue
    }

    // For pnpm exec, verify the binary exists
    if (scriptName === "exec") {
      const binaryName = command.split(/\s+/)[2]
      if (!binaryName) {
        console.log(`❌ FAIL: "${command}" - could not extract binary name`)
        failed++
        continue
      }
      try {
        execSync(`pnpm exec ${binaryName} --version`, {
          stdio: "pipe",
          timeout: 30000,
        })
        console.log(`✅ PASS: "${command}" (binary "${binaryName}" exists)`)
        passed++
      } catch {
        console.log(`❌ FAIL: "${command}" - binary "${binaryName}" not found`)
        failed++
      }
      continue
    }

    // Dry-run: execute the command
    console.log(`🧪 DRY-RUN: "${command}"...`)
    try {
      execSync(command, { stdio: "pipe", timeout: 300000 })
      console.log(`✅ PASS: "${command}"`)
      passed++
    } catch (error) {
      console.log(`❌ FAIL: "${command}" - execution failed`)
      if (error.stderr) {
        const stderr = error.stderr.toString().trim()
        if (stderr) {
          console.error(`   stderr: ${stderr.slice(0, 500)}`)
        }
      }
      failed++
    }
  }

  console.log("")
  console.log(`Results: ${passed} passed, ${skipped} skipped, ${failed} failed`)
  console.log("")

  if (failed > 0) {
    console.log("❌ AGENTS.md validation failed.")
    process.exit(1)
  }

  console.log("✅ All documented commands validated successfully.")
}

main()
