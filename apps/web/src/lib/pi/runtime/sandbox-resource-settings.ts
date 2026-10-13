import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { downloadFile, executeCommand } from "../../daytona/client"
import { getCachedUserSandbox } from "../../daytona/user-sandbox"
import { SANDBOX_WORKSPACE_ROOT } from "../../daytona/sandbox-prepare"
import { RESOURCE_CACHE_PREFIX } from "../../daytona/resource-cache-path"
import { isDeployedChatRuntimeSurface } from "./deployed-chat-runtime"
import type {
  AgentSessionServices,
  SettingsManager,
} from "@earendil-works/pi-coding-agent"

const RESOURCE_KEYS = [
  "skills",
  "prompts",
  "extensions",
  "themes",
  "packages",
] as const
const PORTABLE_ROOT = "../agent-workspace/pi"
const REMOTE_ROOT = `${SANDBOX_WORKSPACE_ROOT}/pi`
const snapshots = new FinalizationRegistry<string>((root) => {
  void rm(root, { recursive: true, force: true }).catch(() => {})
})

/**
 * Pi loads resources from disk. Give its loader a private, disposable copy of
 * this user's volume, while the real manager retains portable settings for
 * persistence/UI. Each service has its own directory, including concurrent
 * sessions for the same user. Nothing is copied into the shared checkout.
 */
export function createSandboxResourceSettings(
  manager: SettingsManager,
  userId: string
) {
  let root: string | undefined
  let useSandbox = isDeployedChatRuntimeSurface()

  function projectSettings() {
    const settings = manager.getProjectSettings()
    if (!useSandbox || !root) return settings
    const localRoot = root
    const projected = { ...settings } as Record<string, unknown>
    for (const key of RESOURCE_KEYS) {
      const entries = projected[key]
      if (!Array.isArray(entries)) continue
      projected[key] = entries.map((entry: unknown) => {
        if (typeof entry === "string") return projectPath(entry, localRoot)
        if (
          key === "packages" &&
          entry &&
          typeof entry === "object" &&
          "source" in entry &&
          typeof entry.source === "string"
        ) {
          return { ...entry, source: projectPath(entry.source, localRoot) }
        }
        return entry
      })
    }
    return projected as ReturnType<SettingsManager["getProjectSettings"]>
  }

  // The SDK constructs its loader with this view. All other manager methods
  // operate on the original storage; absolute cache paths are never persisted.
  const loaderSettings = new Proxy(manager, {
    get(target, property) {
      if (property === "getProjectSettings") return projectSettings
      const value = Reflect.get(target, property, target) as unknown
      return typeof value === "function" ? value.bind(target) : value
    },
  })

  async function prepare() {
    const settings = manager.getProjectSettings()
    const hasResources = RESOURCE_KEYS.some((key) =>
      (settings[key] ?? []).some((entry) => {
        const path = typeof entry === "string" ? entry : entry.source
        return sandboxPath(path) !== undefined
      })
    )
    if (!hasResources) {
      if (root) await rm(join(root, "pi"), { recursive: true, force: true })
      return
    }

    // Session startup must not wait for cold provisioning. The chat runtime
    // warms Daytona in the background; a reload then reads the ready volume.
    const handle = getCachedUserSandbox(userId)
    useSandbox = isDeployedChatRuntimeSurface() || Boolean(handle)
    if (!useSandbox) return
    if (!root) {
      root = await mkdtemp(RESOURCE_CACHE_PREFIX)
      snapshots.register(manager, root)
    }
    const localPiRoot = join(root, "pi")
    await rm(localPiRoot, { recursive: true, force: true })
    await mkdir(localPiRoot, { recursive: true })
    // Missing/removed BYOK leaves an empty private tree, never a host fallback.
    if (!handle) return

    const files = await executeCommand(
      handle.sandbox,
      `if [ -d '${REMOTE_ROOT}' ]; then find -P '${REMOTE_ROOT}' -type f -print0; fi`
    )
    if (files.exitCode !== 0)
      throw new Error("Unable to read sandbox Pi resources.")
    for (const remotePath of files.result.split("\0").filter(Boolean)) {
      const path = relative(REMOTE_ROOT, remotePath)
      if (isAbsolute(path) || path === ".." || path.startsWith(`..${sep}`)) {
        throw new Error(
          "Sandbox resource path escapes the Pi resource directory."
        )
      }
      const localPath = join(localPiRoot, path)
      await mkdir(dirname(localPath), { recursive: true })
      await writeFile(localPath, await downloadFile(handle.sandbox, remotePath))
    }
  }

  function attach(services: AgentSessionServices) {
    services.settingsManager = manager
    const loader = services.resourceLoader
    const reload = loader.reload.bind(loader)
    let pending = Promise.resolve()
    loader.reload = (options) => {
      const next = pending.then(async () => {
        await prepare()
        await reload(options)
      })
      pending = next.catch(() => {})
      return next
    }
  }

  return { loaderSettings, prepare, attach }
}

function sandboxPath(path: string) {
  const match = /^([!+-]?)(.*)$/.exec(path)
  if (!match) return undefined
  const normalized = match[2].replaceAll("\\", "/")
  if (
    normalized !== PORTABLE_ROOT &&
    !normalized.startsWith(`${PORTABLE_ROOT}/`)
  )
    return undefined
  const suffix = normalized.slice(PORTABLE_ROOT.length)
  // Resource patterns may contain globs, but cannot escape the private copy.
  const projected = resolve("/pi", `.${suffix}`)
  if (projected !== "/pi" && !projected.startsWith("/pi/"))
    throw new Error("Invalid sandbox resource path.")
  return { prefix: match[1], suffix }
}

function projectPath(path: string, root: string) {
  const sandbox = sandboxPath(path)
  return sandbox ? `${sandbox.prefix}${join(root, "pi", sandbox.suffix)}` : path
}
