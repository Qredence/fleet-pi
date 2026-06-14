import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"

const appRoot = resolve(import.meta.dirname, "..")
const outputRoot = join(appRoot, ".vercel", "output")
const staticRoot = join(outputRoot, "static")
const functionRoot = join(outputRoot, "functions", "__server.func")
const distClient = join(appRoot, "dist", "client")
const distServer = join(appRoot, "dist", "server")

function assertExists(path, label) {
  if (!existsSync(path)) {
    throw new Error(`${label} does not exist at ${path}. Run vite build first.`)
  }
}

assertExists(distClient, "Client build")
assertExists(join(distServer, "server.js"), "Server build entry")

rmSync(outputRoot, { recursive: true, force: true })
mkdirSync(staticRoot, { recursive: true })
mkdirSync(functionRoot, { recursive: true })

cpSync(distClient, staticRoot, { recursive: true })
cpSync(distServer, join(functionRoot, "dist", "server"), { recursive: true })

writeFileSync(
  join(outputRoot, "config.json"),
  `${JSON.stringify(
    {
      version: 3,
      routes: [{ handle: "filesystem" }, { src: "/(.*)", dest: "/__server" }],
      framework: { version: "tanstack-start" },
    },
    null,
    2
  )}\n`
)

writeFileSync(
  join(functionRoot, ".vc-config.json"),
  `${JSON.stringify(
    {
      runtime: "nodejs22.x",
      handler: "index.mjs",
      launcherType: "Nodejs",
      shouldAddHelpers: true,
      shouldAddSourcemapSupport: true,
      maxDuration: 60,
    },
    null,
    2
  )}\n`
)

writeFileSync(
  join(functionRoot, "package.json"),
  `${JSON.stringify({ type: "module" }, null, 2)}\n`
)

writeFileSync(
  join(functionRoot, "index.mjs"),
  `import server from "./dist/server/server.js"\n\nexport default {\n  async fetch(request, ...args) {\n    return server.fetch(request, ...args)\n  },\n}\n`
)

const marker = join(outputRoot, "functions", "__server.func", "index.mjs")
mkdirSync(dirname(marker), { recursive: true })
console.log(`Wrote Vercel Build Output API files to ${outputRoot}`)
