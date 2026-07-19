import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
  lstatSync,
  readlinkSync,
  readFileSync,
  symlinkSync,
} from "node:fs"
import { createRequire } from "node:module"
import { dirname, join, relative, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { nodeFileTrace } from "@vercel/nft"

const appRoot = resolve(import.meta.dirname, "..")
const repoRoot = resolve(appRoot, "../..")
const outputRoot = join(appRoot, ".vercel", "output")
const staticRoot = join(outputRoot, "static")
const functionRoot = join(outputRoot, "functions", "__server.func")
const distClient = join(appRoot, "dist", "client")
const distServer = join(appRoot, "dist", "server")
const requireFromWeb = createRequire(join(appRoot, "package.json"))

function assertExists(path, label) {
  if (!existsSync(path)) {
    throw new Error(`${label} does not exist at ${path}. Run vite build first.`)
  }
}

/**
 * @daytona/sdk ESM imports named helpers like `__esDecorate` from `tslib`.
 * Those helpers exist only in tslib 2.x. Neon Auth's passkey stack still pulls
 * tslib 1.x into the graph; if NFT/pnpm hoist that older copy next to the
 * externalized Daytona package, every serverless request 500s before auth.
 * Pin tslib@2 beside each traced @daytona/* package so Node resolves it first.
 */
function pinTslibBesideDaytonaPackages() {
  const tslibPackageJson = requireFromWeb.resolve("tslib/package.json")
  const tslibPackage = JSON.parse(readFileSync(tslibPackageJson, "utf8"))
  if (!String(tslibPackage.version).startsWith("2.")) {
    throw new Error(
      `Expected tslib@2 for @daytona/sdk, resolved ${tslibPackage.version} at ${tslibPackageJson}`
    )
  }

  const tslibRoot = dirname(tslibPackageJson)
  const tslibRelativeFromRepo = relative(repoRoot, tslibRoot)
  copyIntoFunction(tslibRelativeFromRepo)

  const pnpmRoot = join(functionRoot, "node_modules", ".pnpm")
  if (!existsSync(pnpmRoot)) {
    return
  }

  // pnpm folder names look like `@daytona+sdk@0.197.0_ws@8.21.0`
  for (const entry of readdirSync(pnpmRoot)) {
    if (!entry.includes("@daytona+")) {
      continue
    }

    const packageNodeModules = join(pnpmRoot, entry, "node_modules")
    if (!existsSync(packageNodeModules)) {
      continue
    }

    const destination = join(packageNodeModules, "tslib")
    const functionTslib = join(functionRoot, tslibRelativeFromRepo)
    const relativeTarget = relative(dirname(destination), functionTslib)

    try {
      rmSync(destination, { recursive: true, force: true })
    } catch {
      // absent is fine
    }
    symlinkSync(relativeTarget, destination)
  }
}

async function assertDaytonaCanImportTslibHelpers() {
  const pnpmRoot = join(functionRoot, "node_modules", ".pnpm")
  if (!existsSync(pnpmRoot)) {
    return
  }

  const daytonaSdkEntry = readdirSync(pnpmRoot).find((entry) =>
    entry.startsWith("@daytona+sdk@")
  )
  if (!daytonaSdkEntry) {
    return
  }

  const fileSystemJs = join(
    pnpmRoot,
    daytonaSdkEntry,
    "node_modules/@daytona/sdk/esm/FileSystem.js"
  )
  if (!existsSync(fileSystemJs)) {
    throw new Error(
      `Traced @daytona/sdk is missing ESM FileSystem.js at ${fileSystemJs}`
    )
  }

  await import(pathToFileURL(fileSystemJs).href)
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

pinTslibBesideDaytonaPackages()
await assertDaytonaCanImportTslibHelpers()

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
