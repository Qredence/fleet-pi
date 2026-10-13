import { dirname, isAbsolute, relative, resolve } from "node:path"
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { Type } from "typebox"
import { resolveHarnessWriteTarget } from "./lib/harness-write"
import { evaluateWorkspaceWrite } from "./lib/mutation-tier"
import {
  assertSafePath,
  ensureSafeDirectory,
  writeNoFollowFile,
} from "./lib/safe-path"

const WORKSPACE_ROOT = "agent-workspace"

export default function workspaceWriteExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "workspace_write",
    label: "Workspace Write",
    description:
      "Write or update a file within agent-workspace/. Enforces mutation boundaries from workspace-policy.md. Use resource_install instead of workspace_write for Pi runtime skills/prompts/extensions/packages. For normal 'remember this' requests, prefer canonical memory/project/{architecture,decisions,preferences,open-questions,known-issues}.md rather than creating ad hoc files. Use rationale param for memory/project/**, memory/research/**, memory/summaries/**, plans/**, skills/**, pi/skills/**, and pi/prompts/**. Protected paths (system/**, evals/**) require override:true.",
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
            "Why this change is being made. Required for memory/project/**, plans/**, memory/research/**, memory/summaries/**, skills/**, pi/skills/**, and pi/prompts/**.",
        })
      ),
      override: Type.Optional(
        Type.Boolean({
          description:
            "Set true to write to protected paths (system/**, evals/**). Use with caution.",
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

      const decision = evaluateWorkspaceWrite({
        displayPath: params.path,
        relativePath: relToWorkspace,
        rationale: params.rationale,
        override: params.override,
      })
      if (!decision.ok) return error(decision.message)
      const tier = decision.tier

      const target = await resolveHarnessWriteTarget({
        cwd,
        sessionId: ctx.sessionManager.getSessionId(),
        sessionFile: ctx.sessionManager.getSessionFile(),
      })
      if (target.kind === "unavailable") {
        return error(target.message)
      }
      if (target.kind === "sandbox") {
        await target.sandbox.writeFile(relToWorkspace, params.content)
      } else {
        await ensureSafeDirectory(workspaceRoot, dirname(absolutePath))
        await assertSafePath(workspaceRoot, absolutePath, {
          allowMissingLeaf: true,
        })
        await writeNoFollowFile(workspaceRoot, absolutePath, params.content)
      }

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
