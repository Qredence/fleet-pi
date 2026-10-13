/**
 * Host-or-sandbox write target for auto-loaded Pi extensions.
 *
 * The default writes the local project. The web server registers a Daytona
 * resolver at session start. Extensions must not import `apps/web`: the CLI
 * loads this folder without the web bundle.
 */

export type HarnessWriteInput = {
  cwd: string
  sessionId?: string
  sessionFile?: string
}

export type HarnessSandboxWriter = {
  writeFile: (workspaceRelativePath: string, content: string) => Promise<void>
  uploadWorkspace: (hostProjectRoot: string) => Promise<void>
  persistSettings: (settings: Record<string, unknown>) => Promise<void>
}

export type HarnessWriteTarget =
  | { kind: "host"; cwd: string }
  | { kind: "sandbox"; sandbox: HarnessSandboxWriter }
  | { kind: "unavailable"; message: string }

type HarnessWriteResolver = (
  input: HarnessWriteInput
) => HarnessWriteTarget | Promise<HarnessWriteTarget>

let resolveHarnessWrite: HarnessWriteResolver = (input) => ({
  kind: "host",
  cwd: input.cwd,
})

export function registerHarnessWriteResolver(next: HarnessWriteResolver) {
  resolveHarnessWrite = next
}

export function resolveHarnessWriteTarget(input: HarnessWriteInput) {
  return resolveHarnessWrite(input)
}
