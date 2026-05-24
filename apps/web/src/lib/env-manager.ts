import { readFile, writeFile } from "node:fs/promises"
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
    // File doesn't exist, we will create it
  }

  // Escape value for safe .env.local storage: handle quotes, newlines, $, and backticks
  const escapeEnvValue = (v: string): string =>
    v
      .replace(/\\/g, "\\\\") // Escape backslashes first
      .replace(/"/g, '\\"') // Escape double quotes
      .replace(/\n/g, "\\n") // Escape newlines
      .replace(/\r/g, "\\r") // Escape carriage returns
      .replace(/\$/g, "\\$") // Escape $ for shell safety
      .replace(/`/g, "\\`") // Escape backticks for shell safety

  const escapedValue = escapeEnvValue(value)

  const lines = content.split("\n")
  let found = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Check for exact key match
    const match = line.match(/^\s*([\w.-]+)\s*=/)
    if (match && match[1] === key) {
      lines[i] = `${key}="${escapedValue}"`
      found = true
      break
    }
  }

  if (!found) {
    // If the file didn't end with a newline, and it's not empty, add one
    if (content && !content.endsWith("\n")) {
      lines.push("")
    }
    lines.push(`${key}="${escapedValue}"`)
  }

  // Ensure trailing newline
  const newContent = lines.join("\n").replace(/\n+$/, "\n")
  await writeFile(envPath, newContent, "utf8")

  // Make it immediately available to the running Node process
  process.env[key] = value
}

export function isEnvVarConfigured(key: string): boolean {
  return typeof process.env[key] === "string" && process.env[key].length > 0
}
