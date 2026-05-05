import { mkdir, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve } from "node:path"
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import { Type } from "typebox"

const WORKSPACE_ROOT = "agent-workspace"

type MutationTier = "free" | "rationale-required" | "protected"

const FREELY_MUTABLE: Array<RegExp> = [
  /^scratch\//,
  /^artifacts\/traces\//,
  /^artifacts\/reports\//,
  /^memory\/daily\//,
]

const RATIONALE_REQUIRED: Array<RegExp> = [
  /^memory\/summaries\//,
  /^plans\//,
  /^memory\/project\//,
  /^memory\/research\//,
  /^skills\//,
]

const PROTECTED: Array<RegExp> = [/^system\//, /^evals\//]

function classifyTier(relPath: string): MutationTier {
  if (FREELY_MUTABLE.some((re) => re.test(relPath))) return "free"
  if (RATIONALE_REQUIRED.some((re) => re.test(relPath)))
    return "rationale-required"
  if (PROTECTED.some((re) => re.test(relPath))) return "protected"
  return "rationale-required"
}

export default function workspaceWriteExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "workspace_write",
    label: "Workspace Write",
    description:
      "Write or update a file within agent-workspace/. Enforces mutation boundaries from workspace-policy.md. Use rationale param for memory/project/**, plans/**, memory/research/**, and skills/**. Protected paths (system/**, evals/**) require override:true.",
    promptSnippet:
      "workspace_write: write files to agent-workspace/ (memory, plans, artifacts, scratch)",
    parameters: Type.Object({
      path: Type.String({
        description:
          "Project-relative path within agent-workspace/ (e.g. agent-workspace/memory/project/decisions.md)",
      }),
      content: Type.String({
        description: "Full file content to write",
      }),
      rationale: Type.Optional(
        Type.String({
          description:
            "Why this change is being made. Required for memory/project/**, plans/**, memory/research/**, memory/summaries/**.",
        })
      ),
      override: Type.Optional(
        Type.Boolean({
          description:
            "Set true to write to protected paths (system/**, skills/**, evals/**). Use with caution.",
        })
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.sessionManager.getCwd()

      // Path validation
      if (isAbsolute(params.path)) {
        return error("Path must be project-relative, not absolute.")
      }
      if (!params.path.startsWith(`${WORKSPACE_ROOT}/`)) {
        return error(`Path must start with "${WORKSPACE_ROOT}/".`)
      }
      if (params.path.includes("..")) {
        return error("Path must not contain '..' segments.")
      }

      const absolutePath = resolve(cwd, params.path)
      const workspaceRoot = resolve(cwd, WORKSPACE_ROOT)
      const relToWorkspace = relative(workspaceRoot, absolutePath)

      if (relToWorkspace.startsWith("..") || isAbsolute(relToWorkspace)) {
        return error("Path escapes the workspace root.")
      }

      const tier = classifyTier(relToWorkspace)

      if (tier === "protected" && !params.override) {
        return error(
          `"${params.path}" is in a protected area (system/**, skills/**, evals/**). ` +
            `Set override:true only if this task explicitly concerns agent behavior or workspace design.`
        )
      }

      if (tier === "rationale-required" && !params.rationale?.trim()) {
        return error(
          `"${params.path}" requires a rationale. Provide a brief explanation of why this change is being made.`
        )
      }

      await mkdir(dirname(absolutePath), { recursive: true })
      await writeFile(absolutePath, params.content, "utf8")

      const warning =
        tier === "protected"
          ? " (WARNING: wrote to protected path — review carefully)"
          : ""

      return {
        content: [
          {
            type: "text",
            text: `Written: ${params.path} (${params.content.length} chars)${warning}`,
          },
        ],
        details: {
          path: params.path,
          tier,
          rationale: params.rationale,
          warning: warning || undefined,
        },
      }
    },
  })
}

function error(message: string) {
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    details: undefined,
    isError: true,
  }
}
