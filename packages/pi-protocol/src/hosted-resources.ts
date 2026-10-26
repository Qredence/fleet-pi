/** Bundled hosted extensions. Volume JavaScript is never evaluated. */
export const BUNDLED_HOSTED_EXTENSIONS = [
  "hosted-sandbox",
  "workspace-status",
] as const

export type HostedExtensionSelection = {
  enabled: Array<string>
  unavailable: Array<string>
}

export function selectHostedExtensions(
  requested: ReadonlyArray<string>
): HostedExtensionSelection {
  const enabled: Array<string> = []
  const unavailable: Array<string> = []
  for (const item of requested) {
    const name = bundledExtensionName(item)
    if (
      name &&
      (BUNDLED_HOSTED_EXTENSIONS as ReadonlyArray<string>).includes(name)
    ) {
      if (!enabled.includes(name)) enabled.push(name)
      continue
    }
    unavailable.push(item)
  }
  return { enabled, unavailable }
}

function bundledExtensionName(value: string) {
  const base = value.split("/").pop()?.replace(/\.ts$/, "")
  if (!base || base.includes("..")) return undefined
  return base
}
