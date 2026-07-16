import type { LoadExtensionsResult } from "@earendil-works/pi-coding-agent"

/**
 * Stock `npm:@daytona/pi` creates per-session sandboxes and clones the full
 * repo. Fleet Pi web uses `.pi/extensions/daytona-sandbox` instead — exclude
 * the package extension from the web resource loader to avoid duplicate tools.
 */
export function excludeStockDaytonaPiExtension(
  base: LoadExtensionsResult
): LoadExtensionsResult {
  const isStockDaytonaPi = (path: string) =>
    path.includes("@daytona/pi") || path.includes("node_modules/@daytona/pi")

  return {
    ...base,
    extensions: base.extensions.filter(
      (ext) =>
        !isStockDaytonaPi(ext.path) && !isStockDaytonaPi(ext.resolvedPath)
    ),
    errors: base.errors.filter((err) => !isStockDaytonaPi(err.path)),
  }
}
