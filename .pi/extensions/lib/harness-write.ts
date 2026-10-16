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

type HarnessWriteBridge = {
  resolver?: HarnessWriteResolver
  requiresResolver: boolean
}

// Pi's jiti loader and the server bundle instantiate this module separately.
// A process-global symbol shares only routing infrastructure, never user data.
const BRIDGE_KEY = Symbol.for("fleet-pi.harness-write")
const bridgeGlobal = globalThis as typeof globalThis & {
  [BRIDGE_KEY]?: HarnessWriteBridge
}

function getBridge() {
  return (bridgeGlobal[BRIDGE_KEY] ??= { requiresResolver: false })
}

export function requireHarnessWriteResolver() {
  getBridge().requiresResolver = true
}

export function registerHarnessWriteResolver(next: HarnessWriteResolver) {
  getBridge().resolver = next
}

export function resolveHarnessWriteTarget(input: HarnessWriteInput) {
  const bridge = getBridge()
  if (bridge.resolver) return bridge.resolver(input)
  if (bridge.requiresResolver) {
    return {
      kind: "unavailable" as const,
      message:
        "Private workspace writes need your Daytona sandbox. Chat and settings still work without it.",
    }
  }
  return { kind: "host" as const, cwd: input.cwd }
}
