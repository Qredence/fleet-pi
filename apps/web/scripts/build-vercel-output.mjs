import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  lstatSync,
  readlinkSync,
  symlinkSync,
} from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { nodeFileTrace } from "@vercel/nft"

const appRoot = resolve(import.meta.dirname, "..")
const repoRoot = resolve(appRoot, "../..")
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

function copyIntoFunction(relativePath) {
  const source = join(repoRoot, relativePath)
  const destination = join(functionRoot, relativePath)

  if (!existsSync(source)) {
    try {
      if (lstatSync(source).isSymbolicLink()) {
        // Broken symlink in source, but we still handle it as a symlink
      } else {
        return
      }
    } catch {
      return
    }
  }

  mkdirSync(dirname(destination), { recursive: true })

  // Clean up destination if it already exists
  try {
    const destStats = lstatSync(destination)
    if (destStats) {
      rmSync(destination, { recursive: true, force: true })
    }
  } catch {
    // Doesn't exist
  }

  const stats = lstatSync(source)
  if (stats.isSymbolicLink()) {
    const target = readlinkSync(source)
    const absoluteTarget = resolve(dirname(source), target)
    if (absoluteTarget.startsWith(repoRoot)) {
      const relativeTargetFromRepo = relative(repoRoot, absoluteTarget)
      const functionTarget = join(functionRoot, relativeTargetFromRepo)
      const newRelativeTarget = relative(dirname(destination), functionTarget)
      symlinkSync(newRelativeTarget, destination)
    } else {
      cpSync(source, destination, { recursive: true, dereference: true, force: true })
    }
  } else {
    cpSync(source, destination, {
      recursive: true,
      dereference: false,
      force: true,
    })
  }
}

assertExists(distClient, "Client build")
assertExists(join(distServer, "server.js"), "Server build entry")

rmSync(outputRoot, { recursive: true, force: true })
mkdirSync(staticRoot, { recursive: true })
mkdirSync(functionRoot, { recursive: true })

cpSync(distClient, staticRoot, { recursive: true })

const serverEntry = join(distServer, "server.js")
const trace = await nodeFileTrace([serverEntry], {
  base: repoRoot,
  processCwd: appRoot,
})

for (const file of trace.fileList) {
  copyIntoFunction(file)
}

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
  `import server from "./${relative(repoRoot, serverEntry)}"\n\nexport default {\n  async fetch(request, ...args) {\n    return server.fetch(request, ...args)\n  },\n}\n`
)

const marker = join(outputRoot, "functions", "__server.func", "index.mjs")
mkdirSync(dirname(marker), { recursive: true })
console.log(`Wrote Vercel Build Output API files to ${outputRoot}`)
