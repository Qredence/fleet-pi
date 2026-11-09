import { createHash } from "node:crypto"

import {
  SEED_TEMPLATE_VERSION,
  TEMPLATE_PRISTINE_RELATIVE_PATH,
  TEMPLATE_UPDATES_RELATIVE_PATH,
  TEMPLATE_VERSION_RELATIVE_PATH,
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
export const SEED_REVISION_RELATIVE_PATH = ".fleet/seed-revision"
/** Seed template inside the repository (sparse-cloned from `main`). */
export const SEED_TEMPLATE_REPO_PATH = "templates/agent-workspace"
/** Template metadata file; read by prepare, never copied into a volume. */
export const SEED_TEMPLATE_METADATA_FILE = "template.json"
/** Historical path/blob pairs the pre-template seed copied; see the file header. */
export const LEGACY_SEED_BLOBS_REPO_PATH = "templates/legacy-seed-blobs.txt"
export const LEGACY_SEED_QUARANTINE_SUBDIRECTORY = "legacy-seed"
export const LEGACY_SKILLS_QUARANTINE_SUBDIRECTORY = "legacy-skills"
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
  options?: { templateVersion?: number }
): string {
  const workspace = shellEscape(SANDBOX_WORKSPACE_ROOT)
  const url = shellEscape(repoUrl)
  const templateVersion = options?.templateVersion ?? SEED_TEMPLATE_VERSION
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
    migrateLegacySkillsCommand(workspace),
    ensureAgentWorkspaceSeedCommand(workspace, url, templateVersion),
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
  const cacheValue = `${sandbox.id}:${secrets.fingerprint}`
  if (userId) {
    const cached = authFingerprintByUser.get(userId)
    if (cached === cacheValue) return
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
    authFingerprintByUser.set(userId, cacheValue)
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
 * `mv` is `rename(2)`, which the Daytona volume filesystem answers with
 * ENOSYS ("Function not implemented"). Copy then delete instead, keeping
 * `mv`'s semantics for both "target file" and "target directory" forms.
 * Never replaces or merges into an existing destination (for example an
 * earlier quarantine entry): that fails with status 1 and leaves both
 * paths untouched.
 * Exported for unit tests.
 */
export const PORTABLE_MOVE_SHELL = [
  "fleet_move() {",
  '  local dest="$2"',
  '  if [ -d "$2" ]; then dest="$2/$(basename "$1")"; fi',
  '  if [ -e "$dest" ] || [ -L "$dest" ]; then',
  '    echo "fleet_move: $dest already exists; leaving $1 in place" >&2',
  "    return 1",
  "  fi",
  '  if mv "$1" "$dest" 2>/dev/null; then return 0; fi',
  '  cp -R "$1" "$dest" && rm -rf "$1"',
  "}",
  "fleet_quarantine() {",
  '  local target="$2" suffix=0',
  '  while [ -e "$target" ] || [ -L "$target" ]; do',
  '    suffix=$((suffix + 1)); target="$2.$suffix"',
  "  done",
  '  mkdir -p "$(dirname "$target")"',
  '  fleet_move "$1" "$target"',
  "}",
].join("\n")

/**
 * Heal polluted volumes. Nested agent-workspace wins over root stubs.
 * Foreign entries are quarantined on the durable volume.
 * Exported for unit tests.
 */
export function migrateLegacyWorkspaceVolumeCommand(workspace: string): string {
  const keepPattern = workspaceVolumeShellKeepPattern()
  const quarantine = `${workspace}/${WORKSPACE_VOLUME_QUARANTINE_DIRECTORY}`
  return [
    PORTABLE_MOVE_SHELL,
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
    `cp -R ${workspace}/agent-workspace/. "$tmpdir"/`,
    `for item in ${workspace}/* ${workspace}/.[!.]* ${workspace}/..?*; do`,
    `[ -e "$item" ] || continue`,
    `case "$(basename "$item")" in ${keepPattern}) continue;; esac`,
    `fleet_quarantine "$item" ${quarantine}/"$(basename "$item")" || true`,
    "done",
    `cp -Rn "$tmpdir"/. ${workspace}/`,
    `rm -rf ${workspace}/agent-workspace "$tmpdir"`,
    "else",
    // No nested workspace: quarantine foreign only; keep contract entries.
    `for item in ${workspace}/* ${workspace}/.[!.]* ${workspace}/..?*; do`,
    `[ -e "$item" ] || continue`,
    `case "$(basename "$item")" in ${keepPattern}) continue;; esac`,
    `fleet_quarantine "$item" ${quarantine}/"$(basename "$item")" || true`,
    "done",
    "fi",
    "fi",
  ].join("\n")
}

/**
 * Move `skills/<name>/` to `pi/skills/<name>/`, the only skill root Pi loads.
 * When the target already exists, the legacy folder goes to quarantine
 * instead. Runs before the seed, so moved copies of the old seed are still
 * caught by the legacy blob check.
 * Exported for unit tests.
 */
export function migrateLegacySkillsCommand(workspace: string): string {
  const quarantine = `"$ws"/${WORKSPACE_VOLUME_QUARANTINE_DIRECTORY}/${LEGACY_SKILLS_QUARANTINE_SUBDIRECTORY}`
  return [
    PORTABLE_MOVE_SHELL,
    `ws=${workspace}`,
    'if [ -d "$ws"/skills ]; then',
    '  for dir in "$ws"/skills/*/; do',
    '    [ -d "$dir" ] || continue',
    '    dir="${dir%/}"',
    '    name="$(basename "$dir")"',
    '    if [ -e "$ws"/pi/skills/"$name" ] || [ -L "$ws"/pi/skills/"$name" ]; then',
    `      target=${quarantine}/"$name"`,
    '      if ! fleet_quarantine "$dir" "$target"; then',
    '        echo "Could not quarantine legacy skill $name; leaving it in place" >&2',
    "        continue",
    "      fi",
    "    else",
    '      mkdir -p "$ws"/pi/skills',
    '      if ! fleet_move "$dir" "$ws"/pi/skills/"$name"; then',
    '        echo "Could not migrate legacy skill $name; leaving it in place" >&2',
    "        continue",
    "      fi",
    "    fi",
    '    echo "FLEET_PI_SKILL_MIGRATED=$name"',
    "  done",
    "fi",
  ].join("\n")
}

/**
 * Apply the seed template to the volume. Never overwrites a user file.
 *
 * - Skips the clone when the volume already records `templateVersion` or newer.
 * - On a volume seeded before the template existed (no version file), moves
 *   files whose path and contents match an old seed into quarantine, so
 *   copied Fleet Pi team content does not pass as the user's own.
 * - Copies missing template files. When a template file changed since the
 *   last applied version and the user's copy differs, writes the new copy to
 *   `.fleet/template-updates/<version>/` for review instead.
 *
 * Exported for unit tests.
 */
export function ensureAgentWorkspaceSeedCommand(
  workspace: string,
  url: string,
  templateVersion: number = SEED_TEMPLATE_VERSION
): string {
  if (!Number.isInteger(templateVersion) || templateVersion < 1) {
    throw new Error(`Invalid seed template version: ${templateVersion}`)
  }
  // `workspace` arrives shell-quoted; bind it once so every later use is a
  // plain double-quoted expansion (also inside `${var#prefix}`).
  const ws = '"$ws"'
  const versionFile = `${ws}/${TEMPLATE_VERSION_RELATIVE_PATH}`
  const pristine = `${ws}/${TEMPLATE_PRISTINE_RELATIVE_PATH}`
  const updates = `${ws}/${TEMPLATE_UPDATES_RELATIVE_PATH}/${templateVersion}`
  const quarantine = `${ws}/${WORKSPACE_VOLUME_QUARANTINE_DIRECTORY}/${LEGACY_SEED_QUARANTINE_SUBDIRECTORY}`
  const revFile = `${ws}/${SEED_REVISION_RELATIVE_PATH}`
  const srcRoot = `"$tmpdir"/${SEED_TEMPLATE_REPO_PATH}`
  const legacyBlobs = `"$tmpdir"/${LEGACY_SEED_BLOBS_REPO_PATH}`

  return [
    "set -euo pipefail",
    PORTABLE_MOVE_SHELL,
    `ws=${workspace}`,
    "recorded=0",
    `if [ -f ${versionFile} ]; then`,
    `  recorded="$(tr -dc '0-9' < ${versionFile})"`,
    '  recorded="${recorded:-0}"',
    "fi",
    `if [ "$recorded" -ge ${templateVersion} ]; then`,
    `  echo "FLEET_PI_TEMPLATE_VERSION=$recorded (seed skipped)"`,
    "else",
    "tmpdir=$(mktemp -d)",
    `git clone --depth 1 --filter=blob:none --sparse ${url} "$tmpdir"`,
    // Subshell so sparse-checkout does not change the outer script cwd. Cone
    // mode also checks out files directly under `templates/`.
    `(cd "$tmpdir" && git sparse-checkout set ${SEED_TEMPLATE_REPO_PATH})`,
    // The clone is the repo's default branch, which can lag or lead this
    // build. Never apply or record a version for content that is not that
    // version: skip the seed (nothing recorded) and retry on the next prepare.
    // A missing template is skipped the same way, e.g. before the branch that
    // adds it reaches the default branch. Both skips fall through (no `exit`)
    // so the rest of the prepare script still runs.
    'cloned=""',
    `if [ -f ${srcRoot}/template.json ]; then`,
    `  cloned="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*\\([0-9][0-9]*\\).*/\\1/p' ${srcRoot}/template.json | head -n 1)"`,
    "fi",
    `if [ ! -f ${srcRoot}/template.json ]; then`,
    `  echo "Seed template missing at ${SEED_TEMPLATE_REPO_PATH}; skipping seed" >&2`,
    `  echo "FLEET_PI_TEMPLATE_VERSION=$recorded (seed skipped: template missing)"`,
    `elif [ "$cloned" != "${templateVersion}" ]; then`,
    `  echo "Seed template version \${cloned:-unknown} does not match expected ${templateVersion}; skipping seed" >&2`,
    `  echo "FLEET_PI_TEMPLATE_VERSION=$recorded (seed skipped: template version mismatch)"`,
    "else",
    `mkdir -p ${ws}/.fleet`,
    // Legacy cleanup runs once: only volumes with no recorded version.
    `if [ ! -f ${versionFile} ] && [ -f ${legacyBlobs} ]; then`,
    `  find ${ws} \\( -path ${ws}/.fleet -o -path ${ws}/${WORKSPACE_VOLUME_QUARANTINE_DIRECTORY} \\) -prune -o -type f -size +0 -print0 > "$tmpdir/legacy-candidates"`,
    "  while IFS= read -r -d '' file; do",
    `    rel="\${file#"$ws"/}"`,
    '    blob="$(git hash-object "$file")"',
    '    legacy_rel="$rel"',
    '    case "$rel" in pi/skills/*) legacy_rel="${rel#pi/}";; esac',
    `    if grep -qxF "$blob $rel" ${legacyBlobs} || grep -qxF "$blob $legacy_rel" ${legacyBlobs}; then`,
    `      if fleet_quarantine "$file" ${quarantine}/"$rel"; then`,
    '        echo "FLEET_PI_LEGACY_QUARANTINED=$rel"',
    "      else",
    '        echo "Could not quarantine legacy seed $rel; seed version not recorded" >&2',
    "        exit 1",
    "      fi",
    "    fi",
    '  done < "$tmpdir/legacy-candidates"',
    "fi",
    "while IFS= read -r -d '' src; do",
    `  rel="\${src#${srcRoot}/}"`,
    // Template metadata stays out of the workspace tree.
    `  if [ "$rel" = "${SEED_TEMPLATE_METADATA_FILE}" ]; then continue; fi`,
    `  dest=${ws}/"$rel"`,
    '  if [ -d "$src" ]; then',
    '    mkdir -p "$dest"',
    "    continue",
    "  fi",
    '  if [ ! -e "$dest" ] && [ ! -L "$dest" ]; then',
    '    mkdir -p "$(dirname "$dest")"',
    // A real copy error fails the script, so the version is not recorded.
    '    cp -R "$src" "$dest"',
    "    continue",
    "  fi",
    '  if cmp -s "$src" "$dest"; then continue; fi',
    // User copy differs. Offer the template copy only when the template
    // itself changed since it was last applied (or was never recorded).
    `  if [ -e ${pristine}/"$rel" ] && cmp -s "$src" ${pristine}/"$rel"; then continue; fi`,
    `  mkdir -p "$(dirname ${updates}/"$rel")"`,
    `  cp -R "$src" ${updates}/"$rel"`,
    `  echo "FLEET_PI_TEMPLATE_UPDATE=$rel"`,
    `done < <(find ${srcRoot} -mindepth 1 -print0)`,
    `rm -rf ${pristine}`,
    `mkdir -p ${pristine}`,
    `cp -R ${srcRoot}/. ${pristine}/`,
    'rev="$(git -C "$tmpdir" rev-parse HEAD)"',
    `printf '%s\\n' "$rev" > ${revFile}`,
    `printf '%s\\n' ${templateVersion} > ${versionFile}`,
    `echo "FLEET_PI_TEMPLATE_VERSION=${templateVersion} (seed applied at $rev)"`,
    "fi",
    'rm -rf "$tmpdir"',
    "fi",
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
    // -mtime rounds down to whole days (+7 matches only from day 8); use minutes.
    `find ${scratch} -type f -mmin +${SCRATCH_TTL_DAYS * 24 * 60} ! -name '.gitkeep' -delete`,
    "fi",
  ].join("\n")
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}
