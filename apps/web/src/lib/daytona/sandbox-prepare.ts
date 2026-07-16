import { createHash } from "node:crypto"
import {
  WORKSPACE_VOLUME_QUARANTINE_DIRECTORY,
  workspaceVolumeShellKeepPattern,
} from "../workspace/workspace-contract"
import { executeCommand, uploadFile } from "./client"
import type { Sandbox } from "@daytona/sdk"

/** Durable agent-workspace volume mount (only durable FS on the sandbox). */
export const SANDBOX_WORKSPACE_ROOT = "/home/daytona/agent-workspace"
export const SANDBOX_PI_AUTH_PATH = "/home/daytona/.pi/agent/auth.json"
export const DEFAULT_REPOSITORY_URL = "https://github.com/Qredence/fleet-pi.git"

const WORKSPACE_PI_DIRS = [
  "pi/packages",
  "pi/extensions/staged",
  "pi/extensions/enabled",
  "pi/skills",
  "pi/prompts",
] as const

export type PiAuthFile = Record<
  string,
  { type: "api_key"; key: string } | { type: "oauth"; credentials: unknown }
>

export type SandboxProviderSecrets = {
  envVars: Record<string, string>
  authJson: PiAuthFile
  fingerprint: string
}

const authFingerprintByUser = new Map<string, string>()

export function resolveRepositoryUrl(value: string | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed) return DEFAULT_REPOSITORY_URL

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error("FLEET_PI_REPOSITORY_URL must be an HTTPS URL")
  }

  if (url.protocol !== "https:") {
    throw new Error("FLEET_PI_REPOSITORY_URL must be an HTTPS URL")
  }

  return url.toString()
}

export function buildPrepareSandboxCommand(repoUrl: string): string {
  const workspace = shellEscape(SANDBOX_WORKSPACE_ROOT)
  const url = shellEscape(repoUrl)
  const piDirs = WORKSPACE_PI_DIRS.map(
    (dir) => `mkdir -p ${shellEscape(`${SANDBOX_WORKSPACE_ROOT}/${dir}`)}`
  ).join("\n")

  // Newline-separated script so Daytona/shell wrappers cannot mis-parse
  // `if`/`then` blocks or redirects.
  return [
    "set -euo pipefail",
    ensureGitInstalledCommand(),
    migrateLegacyWorkspaceVolumeCommand(workspace),
    ensureAgentWorkspaceSeedCommand(workspace, url),
    piDirs,
    `mkdir -p ${workspace}`,
  ].join("\n")
}

export async function prepareSandboxLayout(
  sandbox: Sandbox,
  repoUrl: string
): Promise<void> {
  const script = buildPrepareSandboxCommand(repoUrl)
  const result = await executeCommand(sandbox, `bash -c ${shellEscape(script)}`)
  if (result.exitCode !== 0) {
    throw new Error(
      `Failed to prepare Daytona sandbox layout: ${result.result}`
    )
  }
}

export async function syncSandboxProviderCredentials(
  sandbox: Sandbox,
  secrets: SandboxProviderSecrets,
  userId?: string
): Promise<void> {
  await ensureUserCredentials(sandbox, secrets, userId)
}

export async function ensureUserCredentials(
  sandbox: Sandbox,
  secrets: SandboxProviderSecrets,
  userId?: string
): Promise<void> {
  if (userId) {
    const cached = authFingerprintByUser.get(userId)
    if (cached === secrets.fingerprint) return
  }

  const authDir = "/home/daytona/.pi/agent"
  const mkdirResult = await executeCommand(
    sandbox,
    `mkdir -p ${shellEscape(authDir)}`
  )
  if (mkdirResult.exitCode !== 0) {
    throw new Error(
      `Failed to create Pi auth directory in sandbox: ${mkdirResult.result}`
    )
  }

  await uploadFile(
    sandbox,
    `${JSON.stringify(secrets.authJson, null, 2)}\n`,
    SANDBOX_PI_AUTH_PATH
  )

  if (userId) {
    authFingerprintByUser.set(userId, secrets.fingerprint)
  }
}

export function fingerprintProviderSecrets(
  secrets: Pick<SandboxProviderSecrets, "envVars" | "authJson">
): string {
  return createHash("sha256").update(JSON.stringify(secrets)).digest("hex")
}

export function clearSandboxAuthFingerprint(userId: string): void {
  authFingerprintByUser.delete(userId)
}

function ensureGitInstalledCommand(): string {
  return [
    "if ! command -v git >/dev/null; then",
    "apt-get update",
    "apt-get install -y git ca-certificates",
    "fi",
  ].join("\n")
}

/**
 * Heal polluted volumes. Nested agent-workspace wins over root stubs.
 * Foreign entries are quarantined on the durable volume.
 * Exported for unit tests.
 */
export function migrateLegacyWorkspaceVolumeCommand(workspace: string): string {
  const keepPattern = workspaceVolumeShellKeepPattern()
  const quarantine = `${workspace}/${WORKSPACE_VOLUME_QUARANTINE_DIRECTORY}`
  return [
    "polluted=0",
    // Nested real workspace is always treated as pollution to flatten.
    `if [ -f ${workspace}/agent-workspace/manifest.json ]; then polluted=1; fi`,
    // Tighten monorepo fingerprints: require package.json with apps|packages,
    // or .git with package.json — avoid false positives on lone user dirs.
    `if { [ -d ${workspace}/apps ] || [ -d ${workspace}/packages ]; } && [ -f ${workspace}/package.json ]; then polluted=1; fi`,
    `if [ -d ${workspace}/.git ] && [ -f ${workspace}/package.json ]; then polluted=1; fi`,
    'if [ "$polluted" = "1" ]; then',
    `mkdir -p ${quarantine}`,
    // Nested wins: snapshot nested, quarantine foreign, then force-copy nested onto root.
    `if [ -f ${workspace}/agent-workspace/manifest.json ]; then`,
    "tmpdir=$(mktemp -d)",
    `cp -a ${workspace}/agent-workspace/. "$tmpdir"/`,
    `for item in ${workspace}/* ${workspace}/.[!.]* ${workspace}/..?*; do`,
    `[ -e "$item" ] || continue`,
    `case "$(basename "$item")" in ${keepPattern}) continue;; esac`,
    `mv "$item" ${quarantine}/ 2>/dev/null || true`,
    "done",
    `cp -a "$tmpdir"/. ${workspace}/`,
    `rm -rf ${workspace}/agent-workspace "$tmpdir"`,
    "else",
    // No nested workspace: quarantine foreign only; keep contract entries.
    `for item in ${workspace}/* ${workspace}/.[!.]* ${workspace}/..?*; do`,
    `[ -e "$item" ] || continue`,
    `case "$(basename "$item")" in ${keepPattern}) continue;; esac`,
    `mv "$item" ${quarantine}/ 2>/dev/null || true`,
    "done",
    "fi",
    "fi",
  ].join("\n")
}

/**
 * Sparse-seed only when manifest.json is missing. Non-clobber copy preserves
 * any existing files; bootstrap fills remaining stubs.
 * Exported for unit tests.
 */
export function ensureAgentWorkspaceSeedCommand(
  workspace: string,
  url: string
): string {
  return [
    `if [ ! -f ${workspace}/manifest.json ]; then`,
    "tmpdir=$(mktemp -d)",
    `git clone --depth 1 --filter=blob:none --sparse ${url} "$tmpdir"`,
    // Subshell so sparse-checkout does not change the outer script cwd.
    '(cd "$tmpdir" && git sparse-checkout set agent-workspace)',
    `mkdir -p ${workspace}`,
    // Non-clobber: preserve any existing files on a partially filled volume.
    `cp -an "$tmpdir/agent-workspace/." ${workspace}/`,
    'rm -rf "$tmpdir"',
    "fi",
  ].join("\n")
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}
