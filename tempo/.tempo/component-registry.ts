/* THIS FILE IS AUTO-GENERATED. DO NOT EDIT. */
import { createCanvasLoader, registerCanvasLoaders } from "./component-host"

const createLoaders = () => ({
  "tempo/designs/canvases/home/index.canvas.tsx": createCanvasLoader(
    () => import("../designs/canvases/home/index.canvas.tsx"),
    "../designs/canvases/home/index.canvas.tsx"
  ),
  "tempo/designs/canvases/template-canvas/index.canvas.tsx": createCanvasLoader(
    () => import("../designs/canvases/template-canvas/index.canvas.tsx"),
    "../designs/canvases/template-canvas/index.canvas.tsx"
  ),
})

const registerCurrentLoaders = (
  changedSpecifiers?: readonly (
    string | { specifier: string; changedExports?: readonly string[] }
  )[]
) => registerCanvasLoaders(createLoaders(), changedSpecifiers)

const canvasHotSpecifiers = [
  "../designs/canvases/home/index.canvas.tsx",
  "../designs/canvases/template-canvas/index.canvas.tsx",
] as const
const canvasHotMetadata = {
  "../designs/canvases/home/index.canvas.tsx": {
    importPath: "tempo/designs/canvases/home/index.canvas.tsx",
    ambientHash: "6f5efd9a42d55817",
    exports: { Home: "803fcb1ba710a11a" },
  },
  "../designs/canvases/template-canvas/index.canvas.tsx": {
    importPath: "tempo/designs/canvases/template-canvas/index.canvas.tsx",
    ambientHash: "425df43459313ee8",
    exports: { Example: "fc55f1086915b06e" },
  },
} as const
type CanvasHotMetadataEntry = {
  importPath: string
  ambientHash: string
  exports: Record<string, string>
  parseFailed?: true
}
const normalizeHotPath = (value: string): string => {
  const clean = value.replace(/[?#].*$/, "")
  const withoutFs = clean.startsWith("/@fs/")
    ? clean.slice("/@fs".length)
    : clean
  return withoutFs.startsWith("/private/")
    ? withoutFs.slice("/private".length)
    : withoutFs
}
const stripHotRelativeSegments = (value: string): string => {
  let rest = value.replace(/[?#].*$/, "")
  while (rest.startsWith("./") || rest.startsWith("../")) {
    rest = rest.startsWith("./") ? rest.slice(2) : rest.slice(3)
  }
  return rest
}
const hotPathDirname = (value: string): string => {
  const index = value.lastIndexOf("/")
  return index >= 0 ? value.slice(0, index) : ""
}
const hotPathMatchesSpecifier = (
  specifier: string,
  changedPath: string
): boolean => {
  const normalizedSpecifier = normalizeHotPath(specifier)
  const normalizedChangedPath = normalizeHotPath(changedPath)
  if (normalizedSpecifier === normalizedChangedPath) return true
  const relativeSpecifier = stripHotRelativeSegments(specifier)
  return (
    relativeSpecifier.length > 0 &&
    normalizedChangedPath.endsWith("/" + relativeSpecifier)
  )
}
const hotPathCanAffectSpecifier = (
  specifier: string,
  changedPath: string
): boolean => {
  if (hotPathMatchesSpecifier(specifier, changedPath)) return true
  const normalizedSpecifier = normalizeHotPath(specifier)
  const normalizedChangedPath = normalizeHotPath(changedPath)
  const normalizedSpecifierDir = hotPathDirname(normalizedSpecifier)
  if (
    normalizedSpecifierDir &&
    normalizedChangedPath.startsWith(normalizedSpecifierDir + "/")
  ) {
    return true
  }
  const relativeSpecifier = stripHotRelativeSegments(specifier)
  const relativeChangedPath = stripHotRelativeSegments(changedPath)
  const relativeSpecifierDir = hotPathDirname(relativeSpecifier)
  return (
    relativeSpecifierDir.length > 0 &&
    (relativeChangedPath.startsWith(relativeSpecifierDir + "/") ||
      normalizedChangedPath.includes("/" + relativeSpecifierDir + "/"))
  )
}
const hot = (
  import.meta as {
    hot?: {
      data?: Record<string, unknown>
      accept: (...args: unknown[]) => void
      on?: (event: string, callback: (payload: unknown) => void) => void
    }
  }
).hot
const getPreviousCanvasHotMetadata = ():
  Record<string, CanvasHotMetadataEntry> | undefined => {
  return hot?.data?.tempoCanvasHotMetadata &&
    typeof hot.data.tempoCanvasHotMetadata === "object"
    ? (hot.data.tempoCanvasHotMetadata as Record<
        string,
        CanvasHotMetadataEntry
      >)
    : undefined
}
const changedExportsForSpecifier = (
  specifier: string
): readonly string[] | undefined => {
  const current = (canvasHotMetadata as Record<string, CanvasHotMetadataEntry>)[
    specifier
  ]
  const previous = getPreviousCanvasHotMetadata()?.[specifier]
  if (!current || !previous || current.parseFailed || previous.parseFailed)
    return undefined
  if (current.ambientHash !== previous.ambientHash) return undefined
  const changed = new Set<string>()
  for (const [exportName, hash] of Object.entries(current.exports)) {
    if (previous.exports[exportName] !== hash) {
      changed.add(exportName)
    }
  }
  for (const exportName of Object.keys(previous.exports)) {
    if (!(exportName in current.exports)) {
      changed.add(exportName)
    }
  }
  return [...changed]
}
const metadataChangedForSpecifier = (specifier: string): boolean => {
  const current = (canvasHotMetadata as Record<string, CanvasHotMetadataEntry>)[
    specifier
  ]
  const previous = getPreviousCanvasHotMetadata()?.[specifier]
  if (!current || !previous || current.parseFailed || previous.parseFailed)
    return true
  if (current.ambientHash !== previous.ambientHash) return true
  return (changedExportsForSpecifier(specifier)?.length ?? 0) > 0
}
const collectMetadataChangedCanvasSpecifiers = (): readonly string[] => {
  return canvasHotSpecifiers.filter(metadataChangedForSpecifier)
}
const toCanvasSpecifierChanges = (
  specifiers: readonly string[]
): readonly { specifier: string; changedExports?: readonly string[] }[] => {
  return [...new Set(specifiers)].map((specifier) => {
    const changedExports = changedExportsForSpecifier(specifier)
    return {
      specifier,
      ...(changedExports ? { changedExports } : {}),
    }
  })
}
const rememberChangedCanvasSpecifiers = (
  specifiers: readonly string[]
): void => {
  if (!hot || specifiers.length === 0) return
  const existing = Array.isArray(hot.data?.tempoChangedCanvasSpecifiers)
    ? hot.data.tempoChangedCanvasSpecifiers.filter(
        (value): value is string => typeof value === "string"
      )
    : []
  hot.data ??= {}
  hot.data.tempoChangedCanvasSpecifiers = [
    ...new Set([...existing, ...specifiers]),
  ]
}
const collectCanvasSpecifier = (value: unknown, changed: Set<string>): void => {
  if (typeof value !== "string") return
  for (const specifier of canvasHotSpecifiers) {
    if (hotPathMatchesSpecifier(specifier, value)) {
      changed.add(specifier)
    }
  }
}
const readCanvasHotUpdate = (payload: unknown): { changed: Set<string> } => {
  const changed = new Set<string>()
  const collectUpdate = (update: unknown): void => {
    if (!update || typeof update !== "object") return
    const candidate = update as {
      path?: unknown
      acceptedPath?: unknown
      id?: unknown
    }
    collectCanvasSpecifier(candidate.path, changed)
    collectCanvasSpecifier(candidate.acceptedPath, changed)
    collectCanvasSpecifier(candidate.id, changed)
  }
  collectUpdate(payload)
  const maybeUpdates = (payload as { updates?: unknown } | null | undefined)
    ?.updates
  if (Array.isArray(maybeUpdates)) {
    for (const update of maybeUpdates) {
      collectUpdate(update)
    }
  }
  return { changed }
}
const captureCanvasHotUpdate = (payload: unknown): void => {
  const { changed } = readCanvasHotUpdate(payload)
  rememberChangedCanvasSpecifiers([...changed])
}
const takeChangedCanvasSpecifiers = (): readonly string[] | undefined => {
  const changed = Array.isArray(hot?.data?.tempoChangedCanvasSpecifiers)
    ? hot.data.tempoChangedCanvasSpecifiers.filter(
        (value): value is string => typeof value === "string"
      )
    : []
  if (hot?.data) {
    delete hot.data.tempoChangedCanvasSpecifiers
  }
  return changed.length > 0 ? [...new Set(changed)] : undefined
}
const wasHotUpdate = hot?.data?.tempoCanvasRegistryRegistered === true
const changedCanvasSpecifiers =
  takeChangedCanvasSpecifiers() ?? collectMetadataChangedCanvasSpecifiers()
registerCurrentLoaders(
  wasHotUpdate ? toCanvasSpecifierChanges(changedCanvasSpecifiers) : undefined
)
if (hot) {
  hot.data ??= {}
  hot.data.tempoCanvasRegistryRegistered = true
  hot.data.tempoCanvasHotMetadata = canvasHotMetadata
  hot.on?.("vite:beforeUpdate", captureCanvasHotUpdate)
  hot.on?.("vite:invalidate", captureCanvasHotUpdate)
  hot.accept("../designs/canvases/home/index.canvas.tsx", () => {
    rememberChangedCanvasSpecifiers([
      "../designs/canvases/home/index.canvas.tsx",
    ])
  })
  hot.accept("../designs/canvases/template-canvas/index.canvas.tsx", () => {
    rememberChangedCanvasSpecifiers([
      "../designs/canvases/template-canvas/index.canvas.tsx",
    ])
  })
  hot.accept()
}
