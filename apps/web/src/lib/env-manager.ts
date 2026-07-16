import { readFile, rename, writeFile } from "node:fs/promises"
import { join } from "node:path"

/**
 * Safely updates or appends a key-value pair to .env.local
 * and sets it in the current process.env.
 */
export async function updateEnvVar(
  projectRoot: string,
  key: string,
  value: string
) {
  await updateEnvVars(projectRoot, { [key]: value })
}

/**
 * Atomically update multiple keys in .env.local (single read + temp write + rename).
 * Also mirrors values into process.env so the current server process can use
 * them without a restart (Vite must not restart on this write — see vite.config).
 */
export async function updateEnvVars(
  projectRoot: string,
  entries: Record<string, string>
) {
  const keys = Object.keys(entries)
  if (keys.length === 0) return

  const envPath = join(projectRoot, ".env.local")
  let content = ""
  try {
    content = await readFile(envPath, "utf8")
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code !== "ENOENT"
    ) {
      throw error
    }
  }

  const escapeEnvValue = (v: string): string =>
    v
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\$/g, "\\$")
      .replace(/`/g, "\\`")

  const lines = content.split("\n")
  const remaining = new Map(Object.entries(entries))

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = line.match(/^\s*([\w.-]+)\s*=/)
    if (!match) continue
    const key = match[1]
    const value = remaining.get(key)
    if (value === undefined) continue
    lines[i] = `${key}="${escapeEnvValue(value)}"`
    remaining.delete(key)
  }

  if (remaining.size > 0) {
    if (content && !content.endsWith("\n") && lines[lines.length - 1] !== "") {
      lines.push("")
    }
    for (const [key, value] of remaining) {
      lines.push(`${key}="${escapeEnvValue(value)}"`)
    }
  }

  const newContent = lines.join("\n").replace(/\n+$/, "\n")
  const tempPath = `${envPath}.${process.pid}.${Date.now()}.tmp`
  await writeFile(tempPath, newContent, "utf8")
  await rename(tempPath, envPath)

  for (const [key, value] of Object.entries(entries)) {
    process.env[key] = value
  }
}

export function isEnvVarConfigured(key: string): boolean {
  return typeof process.env[key] === "string" && process.env[key].length > 0
}

/** Trim and strip accidental wrapping/trailing quotes from credential fields. */
export function sanitizeProviderCredentialValue(value: string) {
  let next = value.trim()
  if (
    (next.startsWith('"') && next.endsWith('"')) ||
    (next.startsWith("'") && next.endsWith("'"))
  ) {
    next = next.slice(1, -1).trim()
  }
  next = next.replace(/['"]+$/u, "").replace(/^['"]+/u, "")
  return next.trim()
}
