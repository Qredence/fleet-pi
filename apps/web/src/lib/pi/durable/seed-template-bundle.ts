import type { TemplateBundle } from "./do-workspace-store"

const TEMPLATE_PREFIX = "../../../../../../templates/agent-workspace/"

/** The seed template, inlined at build time for the Durable Object store. */
const rawFiles = import.meta.glob<string>(
  "../../../../../../templates/agent-workspace/**/*.{md,json}",
  { query: "?raw", import: "default", eager: true }
)

const keepFiles = import.meta.glob<string>(
  "../../../../../../templates/agent-workspace/**/.gitkeep",
  { query: "?raw", import: "default", eager: true }
)

export function bundledSeedTemplate(): TemplateBundle {
  const files: Record<string, string> = {}
  for (const [key, content] of Object.entries(rawFiles)) {
    files[key.slice(TEMPLATE_PREFIX.length)] = content
  }
  const directories = Object.keys(keepFiles).map((key) =>
    key.slice(TEMPLATE_PREFIX.length).replace(/\/?\.gitkeep$/, "")
  )
  const meta = JSON.parse(files["template.json"] ?? "{}") as {
    version?: unknown
  }
  if (typeof meta.version !== "number") {
    throw new Error("templates/agent-workspace/template.json has no version")
  }
  return { version: meta.version, files, directories }
}
