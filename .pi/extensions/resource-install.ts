import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Type } from "typebox"
import { resolveHarnessWriteTarget } from "./lib/harness-write"
import { installWorkspaceResource } from "./lib/resource-install"
import type { HarnessSandboxWriter } from "./lib/harness-write"
import type { ResourceInstallParams } from "./lib/resource-install"
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"

export default function resourceInstallExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "resource_install",
    label: "Resource Install",
    description:
      "Install Fleet Pi Pi resources into agent-workspace/pi. Supports skills, prompts, and single-file extensions from pasted content, project-relative paths, or public HTTPS/GitHub URLs; local Pi package bundles install from project-relative directories. Extensions and packages are staged unless activate:true is explicitly requested.",
    promptSnippet:
      "resource_install: install Pi skills, prompts, extensions, and package bundles into agent-workspace/pi",
    parameters: Type.Object({
      activate: Type.Optional(
        Type.Boolean({
          description:
            "For executable extensions/packages, set true only when the user explicitly asks to install and activate. Skills/prompts are available after reload/new session.",
        })
      ),
      kind: Type.Union([
        Type.Literal("skill"),
        Type.Literal("prompt"),
        Type.Literal("extension"),
        Type.Literal("package"),
      ]),
      name: Type.String({
        description:
          "Install name. It will be normalized to a safe folder/file name.",
      }),
      source: Type.String({
        description:
          "Pasted content, project-relative source path, or public HTTPS/GitHub URL.",
      }),
      sourceType: Type.Union([
        Type.Literal("content"),
        Type.Literal("path"),
        Type.Literal("url"),
      ]),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      try {
        const cwd = ctx.sessionManager.getCwd()
        const target = await resolveHarnessWriteTarget({
          cwd,
          sessionId: ctx.sessionManager.getSessionId(),
          sessionFile: ctx.sessionManager.getSessionFile(),
        })
        if (target.kind === "unavailable") {
          return {
            content: [
              { type: "text" as const, text: `Error: ${target.message}` },
            ],
            details: undefined,
            isError: true,
          }
        }

        const installParams = {
          activate: params.activate,
          kind: params.kind,
          name: params.name,
          source: params.source,
          sourceType: params.sourceType,
        }
        const result =
          target.kind === "sandbox"
            ? await installOntoSandbox(
                cwd,
                target.sandbox,
                installParams,
                signal
              )
            : await installWorkspaceResource(cwd, installParams, signal)

        return {
          content: [
            {
              type: "text" as const,
              text: [
                `Installed ${result.kind}: ${result.name}`,
                `Path: ${result.installedPath}`,
                `Status: ${result.activationStatus}`,
                result.settingsUpdated
                  ? "Updated .pi/settings.json compatibility paths."
                  : ".pi/settings.json already contained the needed compatibility paths.",
                "Start a new session or reload the app before relying on the newly installed resource.",
              ].join("\n"),
            },
          ],
          details: result,
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          details: undefined,
          isError: true,
        }
      }
    },
  })
}

async function installOntoSandbox(
  cwd: string,
  sandbox: HarnessSandboxWriter,
  params: ResourceInstallParams,
  signal: AbortSignal | undefined
) {
  const writeRoot = await mkdtemp(join(tmpdir(), "fleet-pi-install-"))
  try {
    const result = await installWorkspaceResource(cwd, params, signal, {
      writeRoot,
    })
    await sandbox.uploadWorkspace(writeRoot)
    const settings = await readInstallSettings(writeRoot)
    if (settings) await sandbox.persistSettings(settings)
    return result
  } finally {
    await rm(writeRoot, { force: true, recursive: true })
  }
}

async function readInstallSettings(root: string) {
  try {
    const parsed = JSON.parse(
      await readFile(join(root, ".pi/settings.json"), "utf8")
    ) as unknown
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    return undefined
  }
  return undefined
}
