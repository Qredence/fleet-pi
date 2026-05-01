import { existsSync, readdirSync } from "node:fs"
import { resolve } from "node:path"
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import { Type } from "typebox"

const RESOURCE_DIRS = [".pi/skills", ".pi/prompts", ".pi/extensions"]

export default function projectInventoryExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "project_inventory",
    label: "Project Inventory",
    description:
      "Summarize Fleet Pi's project-local Pi resources and key app surfaces. Use when orienting yourself before planning or changing this app.",
    parameters: Type.Object({
      focus: Type.Optional(
        Type.String({
          description:
            "Optional area to focus on, such as skills, extensions, chat, or validation.",
        })
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.sessionManager.getCwd()
      const resources = RESOURCE_DIRS.map((dir) => {
        const path = resolve(cwd, dir)
        return {
          dir,
          entries: existsSync(path) ? readdirSync(path).sort() : [],
        }
      })
      const focus = params.focus?.trim()
      const summary = [
        "Fleet Pi is a TanStack Start chat app backed by Pi coding-agent sessions.",
        "Core backend files live under apps/web/src/lib/pi and apps/web/src/routes/api/chat*.ts.",
        "The browser chat surface lives in apps/web/src/routes/index.tsx and shared Agent Elements components live in packages/ui.",
        "Project-local Pi resources are discovered from .pi/skills, .pi/prompts, and .pi/extensions.",
        focus ? `Requested focus: ${focus}` : undefined,
      ]
        .filter(Boolean)
        .join("\n")

      return {
        content: [{ type: "text", text: summary }],
        details: { resources, focus },
      }
    },
  })
}
