import { createHash } from "node:crypto"
import { executeCommand, uploadFile } from "./client"
import type { Sandbox } from "@daytona/sdk"

export const SANDBOX_PROJECT_ROOT = "/home/daytona/fleet-pi"
export const SANDBOX_WORKSPACE_ROOT = `${SANDBOX_PROJECT_ROOT}/agent-workspace`
export const SANDBOX_SESSION_MOUNT_PATH = `${SANDBOX_PROJECT_ROOT}/.fleet`
export const SANDBOX_PI_AUTH_PATH = "/home/daytona/.pi/agent/auth.json"
export const SANDBOX_SETTINGS_PATH = `${SANDBOX_PROJECT_ROOT}/.pi/settings.json`
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
  const repo = shellEscape(SANDBOX_PROJECT_ROOT)
  const workspace = shellEscape(SANDBOX_WORKSPACE_ROOT)
  const session = shellEscape(SANDBOX_SESSION_MOUNT_PATH)
  const url = shellEscape(repoUrl)
  const piDirs = WORKSPACE_PI_DIRS.map(
    (dir) => `mkdir -p ${shellEscape(`${SANDBOX_WORKSPACE_ROOT}/${dir}`)}`
  ).join("\n")

  // Newline-separated script so Daytona/shell wrappers cannot mis-parse
  // `if`/`then` blocks or redirects.
  return [
    "set -euo pipefail",
    ensureGitInstalledCommand(),
    migrateLegacyWorkspaceVolumeCommand(repo, workspace),
    ensureProjectCheckoutCommand(repo, url),
    ensureAgentWorkspaceSeedCommand(workspace, url),
    piDirs,
    `mkdir -p ${workspace} ${session}`,
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

function migrateLegacyWorkspaceVolumeCommand(
  repo: string,
  workspace: string
): string {
  return [
    `if [ -f ${workspace}/.git/config ] && [ -f ${workspace}/package.json ]; then`,
    `if [ -f ${workspace}/agent-workspace/manifest.json ]; then`,
    "tmpdir=$(mktemp -d)",
    `cp -a ${workspace}/agent-workspace/. "$tmpdir"/`,
    `find ${workspace} -mindepth 1 -maxdepth 1 ! -name agent-workspace -exec rm -rf {} +`,
    `cp -a "$tmpdir"/. ${workspace}/`,
    'rm -rf "$tmpdir"',
    "fi",
    `mkdir -p ${repo}`,
    `for item in ${workspace}/* ${workspace}/.[!.]* ${workspace}/..?*; do`,
    'case "$(basename "$item")" in agent-workspace|manifest.json|instructions|system|memory|plans|skills|evals|artifacts|scratch|pi|indexes) continue;; esac',
    'if [ -e "$item" ]; then',
    `mv "$item" ${repo}/ 2>/dev/null || true`,
    "fi",
    "done",
    "fi",
  ].join("\n")
}

function ensureProjectCheckoutCommand(repo: string, url: string): string {
  return [
    `if [ ! -d ${repo}/.git ]; then`,
    "tmpdir=$(mktemp -d)",
    `git clone --depth 1 ${url} "$tmpdir"`,
    `mkdir -p ${repo}`,
    `for item in "$tmpdir"/* "$tmpdir"/.[!.]* "$tmpdir"/..?*; do`,
    'name=$(basename "$item")',
    'if [ "$name" = "agent-workspace" ]; then continue; fi',
    'if [ -e "$item" ]; then',
    `cp -a "$item" ${repo}/`,
    "fi",
    "done",
    'rm -rf "$tmpdir"',
    "fi",
  ].join("\n")
}

function ensureAgentWorkspaceSeedCommand(
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
    `cp -a "$tmpdir/agent-workspace/." ${workspace}/`,
    'rm -rf "$tmpdir"',
    "fi",
  ].join("\n")
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}
