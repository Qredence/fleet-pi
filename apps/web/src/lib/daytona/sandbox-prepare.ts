import { createHash } from "node:crypto"
import {
  WORKSPACE_VOLUME_QUARANTINE_DIRECTORY,
  workspaceVolumeShellKeepPattern,
} from "../workspace/workspace-contract"
import { executeCommand, uploadFile } from "./client"
import type { Sandbox } from "@daytona/sdk"

/** Durable agent-workspace volume mount (only durable FS on the sandbox). */
export const SANDBOX_WORKSPACE_ROOT = "/home/daytona/agent-workspace"
/** Pre-adapter full-repo checkout path — remove on every prepare. */
export const LEGACY_SANDBOX_ROOT = "/home/daytona/fleet-pi"
export const SANDBOX_PI_AUTH_PATH = "/home/daytona/.pi/agent/auth.json"
export const DEFAULT_REPOSITORY_URL = "https://github.com/Qredence/fleet-pi.git"
/** Sandbox label. Daytona volumes have no label API; file edits cannot change this. */
export const FLEET_PI_SEED_REVISION_LABEL = "fleetPiSeedRev"
export const SEED_REVISION_RELATIVE_PATH = ".fleet/seed-revision"
export const SCRATCH_TTL_DAYS = 7

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

export function buildPrepareSandboxCommand(
  repoUrl: string,
  options?: { seedRevision?: string }
): string {
  const workspace = shellEscape(SANDBOX_WORKSPACE_ROOT)
  const url = shellEscape(repoUrl)
  const seedRevision = options?.seedRevision?.trim() ?? ""
  const piDirs = WORKSPACE_PI_DIRS.map(
    (dir) => `mkdir -p ${shellEscape(`${SANDBOX_WORKSPACE_ROOT}/${dir}`)}`
  ).join("\n")

  // Newline-separated script so Daytona/shell wrappers cannot mis-parse
  // `if`/`then` blocks or redirects.
  return [
    "set -euo pipefail",
    ensureGitInstalledCommand(),
    removeLegacySandboxRootsCommand(),
    migrateLegacyWorkspaceVolumeCommand(workspace),
    ensureAgentWorkspaceSeedCommand(workspace, url, seedRevision),
    sweepScratchCommand(workspace),
    piDirs,
    `mkdir -p ${workspace}`,
  ].join("\n")
}

/**
 * Drop ephemeral leftover full-repo trees from older Fleet layouts / snapshots.
 * Never delete a path that is (or contains) a volume mount — recreate instead.
 */
export function removeLegacySandboxRootsCommand(): string {
  const legacy = shellEscape(LEGACY_SANDBOX_ROOT)
  const legacyWorkspace = shellEscape(`${LEGACY_SANDBOX_ROOT}/agent-workspace`)
  return [
    `# Remove legacy full-repo path only when it is not a volume mount`,
    `if [ -e ${legacy} ]; then`,
    `if mountpoint -q ${legacy} 2>/dev/null || mountpoint -q ${legacyWorkspace} 2>/dev/null; then`,
    `: # mounted legacy layout — sandbox will be recreated by the host`,
    "else",
    `rm -rf ${legacy}`,
    "fi",
    "fi",
  ].join("\n")
}

export async function prepareSandboxLayout(
  sandbox: Sandbox,
  repoUrl: string
): Promise<void> {
  const labels: Record<string, string | undefined> = sandbox.labels
  const seedRevision = labels[FLEET_PI_SEED_REVISION_LABEL]?.trim() ?? ""
  const script = buildPrepareSandboxCommand(repoUrl, { seedRevision })
  const result = await executeCommand(sandbox, `bash -c ${shellEscape(script)}`)
  if (result.exitCode !== 0) {
    throw new Error(
      `Failed to prepare Daytona sandbox layout: ${result.result}`
    )
  }

  const recorded = readSeedRevision(result.result)
  if (!recorded || recorded === seedRevision) return
  await sandbox.setLabels({
    ...sandbox.labels,
    [FLEET_PI_SEED_REVISION_LABEL]: recorded,
  })
}

function readSeedRevision(output: string | undefined) {
  const match = output?.match(/FLEET_PI_SEED_REVISION=([0-9a-f]{7,40})/)
  return match?.[1]
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
    // Nested layout is pollution. Quarantine foreign entries, then copy only
    // paths that are not already on the volume root.
    `if [ -f ${workspace}/agent-workspace/manifest.json ]; then`,
    "tmpdir=$(mktemp -d)",
    `cp -a ${workspace}/agent-workspace/. "$tmpdir"/`,
    `for item in ${workspace}/* ${workspace}/.[!.]* ${workspace}/..?*; do`,
    `[ -e "$item" ] || continue`,
    `case "$(basename "$item")" in ${keepPattern}) continue;; esac`,
    `mv "$item" ${quarantine}/ 2>/dev/null || true`,
    "done",
    `cp -an "$tmpdir"/. ${workspace}/`,
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
 * Copy the git seed onto the volume without clobbering user files.
 * When `seedRevision` is set, the sandbox label already records this seed and
 * the clone is skipped. A missing label still uses `cp -an`.
 * Exported for unit tests.
 */
export function ensureAgentWorkspaceSeedCommand(
  workspace: string,
  url: string,
  seedRevision = ""
): string {
  const recorded = seedRevision.trim()
  if (recorded) {
    // Comment-only scripts exit non-zero under `bash -lc` on some Linux images
    // (GitHub Actions). Keep a no-op command so the skip path stays success.
    return `: # ${FLEET_PI_SEED_REVISION_LABEL} ${recorded} matches; clone skipped`
  }

  const revFile = `${workspace}/${SEED_REVISION_RELATIVE_PATH}`
  return [
    "set -euo pipefail",
    "tmpdir=$(mktemp -d)",
    `git clone --depth 1 --filter=blob:none --sparse ${url} "$tmpdir"`,
    // Subshell so sparse-checkout does not change the outer script cwd.
    '(cd "$tmpdir" && git sparse-checkout set agent-workspace)',
    `mkdir -p ${workspace}`,
    // Copy only missing paths. An existing file stays, and a real copy error
    // fails the script so the seed revision is not recorded.
    "while IFS= read -r -d '' src; do",
    '  rel="${src#"$tmpdir"/agent-workspace/}"',
    `  dest=${workspace}/"$rel"`,
    '  if [ -d "$src" ]; then',
    '    mkdir -p "$dest"',
    "    continue",
    "  fi",
    '  if [ -e "$dest" ]; then',
    "    continue",
    "  fi",
    '  mkdir -p "$(dirname "$dest")"',
    '  cp -a "$src" "$dest"',
    'done < <(find "$tmpdir/agent-workspace" -mindepth 1 -print0)',
    'rev="$(git -C "$tmpdir" rev-parse HEAD)"',
    `mkdir -p ${workspace}/.fleet`,
    `printf '%s\\n' "$rev" > ${revFile}`,
    'echo "FLEET_PI_SEED_REVISION=$rev"',
    'rm -rf "$tmpdir"',
  ].join("\n")
}

/**
 * Delete scratch files older than {@link SCRATCH_TTL_DAYS}. Leaves `.gitkeep`
 * and every path outside `scratch/`.
 * Exported for unit tests.
 */
export function sweepScratchCommand(workspace: string): string {
  const scratch = `${workspace}/scratch`
  return [
    `if [ -d ${scratch} ]; then`,
    `find ${scratch} -type f -mtime +${SCRATCH_TTL_DAYS} ! -name '.gitkeep' -delete`,
    "fi",
  ].join("\n")
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}
