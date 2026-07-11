import { downloadFile, executeCommand, uploadFile } from "./client"
import { SANDBOX_PROJECT_ROOT, SANDBOX_SETTINGS_PATH } from "./sandbox-prepare"
import type { Sandbox } from "@daytona/sdk"

/** Default project settings seeded when sandbox `.pi/settings.json` is missing/empty. */
export const DEFAULT_SANDBOX_SETTINGS: Record<string, unknown> = {
  packages: [
    "npm:pi-autoresearch",
    "npm:pi-skill-palette",
    "npm:pi-autocontext",
    "npm:pi-web-access",
    "npm:pi-xai-oauth",
  ],
  skills: ["../agent-workspace/pi/skills"],
  prompts: ["../agent-workspace/pi/prompts"],
  extensions: [
    "extensions/bedrock-bearer-auth",
    "extensions/resource-install",
    "extensions/daytona-sandbox",
    "extensions/vendor/filechanges",
    "extensions/vendor/subagents",
    "../agent-workspace/pi/extensions/enabled",
  ],
  defaultProvider: "google",
  defaultModel: "gemini-3.5-flash",
  defaultThinkingLevel: "high",
  enabledModels: ["google/*", "github-copilot/*"],
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}

export function isEmptySettingsFile(settings: Record<string, unknown>) {
  return Object.keys(settings).length === 0
}

export async function readSandboxSettingsFile(
  sandbox: Sandbox
): Promise<Record<string, unknown>> {
  try {
    const content = await downloadFile(sandbox, SANDBOX_SETTINGS_PATH)
    const parsed = JSON.parse(content.toString("utf8")) as unknown
    return typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

/**
 * If sandbox settings are missing or empty, write DEFAULT_SANDBOX_SETTINGS.
 * Called after sandbox prepare and when loading settings for Daytona users.
 */
export async function ensureSandboxSettingsSeeded(
  sandbox: Sandbox
): Promise<Record<string, unknown>> {
  const current = await readSandboxSettingsFile(sandbox)
  if (!isEmptySettingsFile(current)) return current

  await writeSandboxSettingsFile(sandbox, DEFAULT_SANDBOX_SETTINGS)
  return DEFAULT_SANDBOX_SETTINGS
}

export async function writeSandboxSettingsFile(
  sandbox: Sandbox,
  settings: Record<string, unknown>
): Promise<void> {
  const settingsDir = `${SANDBOX_PROJECT_ROOT}/.pi`
  const mkdirResult = await executeCommand(
    sandbox,
    `mkdir -p ${shellEscape(settingsDir)}`
  )
  if (mkdirResult.exitCode !== 0) {
    throw new Error(
      `Failed to create sandbox settings directory: ${mkdirResult.result}`
    )
  }

  await uploadFile(
    sandbox,
    `${JSON.stringify(settings, null, 2)}\n`,
    SANDBOX_SETTINGS_PATH
  )
}
