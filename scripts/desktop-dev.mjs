import { randomUUID } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawn } from "node:child_process"

const runId = randomUUID()
const desktopDataRoot = join(tmpdir(), "fleet-pi-desktop-dev", runId)
const statePath = join(desktopDataRoot, "desktop-state.json")
const requestToken = randomUUID()

mkdirSync(desktopDataRoot, { recursive: true })
writeFileSync(
  statePath,
  `${JSON.stringify({ version: 1, recentProjects: [] }, null, 2)}\n`
)

const env = {
  ...process.env,
  FLEET_PI_DESKTOP_STATE_PATH: statePath,
  FLEET_PI_DESKTOP_AUTH_TOKEN: requestToken,
}

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm"
const children = []

function spawnProcess(args) {
  const child = spawn(pnpmCommand, args, {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  })
  children.push(child)
  return child
}

const web = spawnProcess(["--filter", "web", "dev"])
const desktop = spawnProcess(["--filter", "desktop", "dev"])

let shuttingDown = false

function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true

  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM")
    }
  }

  process.exit(code)
}

for (const child of children) {
  child.on("exit", (code, signal) => {
    if (shuttingDown) return
    if (signal) {
      shutdown(1)
      return
    }
    shutdown(code ?? 0)
  })
}

process.on("SIGINT", () => shutdown(130))
process.on("SIGTERM", () => shutdown(143))
