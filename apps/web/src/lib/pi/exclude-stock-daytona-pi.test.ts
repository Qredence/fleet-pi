import { describe, expect, it } from "vitest"
import { excludeStockDaytonaPiExtension } from "./exclude-stock-daytona-pi"
import type { LoadExtensionsResult } from "@earendil-works/pi-coding-agent"

describe("excludeStockDaytonaPiExtension", () => {
  it("filters stock @daytona/pi extensions and errors", () => {
    const base = {
      extensions: [
        {
          path: "extensions/daytona-sandbox",
          resolvedPath: "/repo/.pi/extensions/daytona-sandbox.ts",
        },
        {
          path: "npm:@daytona/pi",
          resolvedPath: "/repo/.pi/npm/node_modules/@daytona/pi/index.ts",
        },
      ],
      errors: [
        { path: "npm:@daytona/pi", error: "missing ws" },
        { path: "extensions/other", error: "boom" },
      ],
      runtime: {},
    } as unknown as LoadExtensionsResult

    const result = excludeStockDaytonaPiExtension(base)

    expect(result.extensions).toHaveLength(1)
    expect(result.extensions[0]?.path).toBe("extensions/daytona-sandbox")
    expect(result.errors).toEqual([{ path: "extensions/other", error: "boom" }])
  })
})
