import { describe, expect, it } from "vitest"
import {
  MIRROR_JSON_SANITIZE_OPTIONS,
  deterministicId,
  sanitizeJsonForStorage,
} from "../json-storage"

describe("sanitizeJsonForStorage with default (provenance) limits", () => {
  it("passes primitives through unchanged", () => {
    expect(sanitizeJsonForStorage("text")).toBe("text")
    expect(sanitizeJsonForStorage(42)).toBe(42)
    expect(sanitizeJsonForStorage(true)).toBe(true)
    expect(sanitizeJsonForStorage(null)).toBe(null)
    expect(sanitizeJsonForStorage(undefined)).toBe(undefined)
  })

  it("truncates strings longer than 8k, slicing to 8k and appending an ellipsis", () => {
    const exactly = "a".repeat(8_000)
    expect(sanitizeJsonForStorage(exactly)).toBe(exactly)
    expect(sanitizeJsonForStorage(`${exactly}b`)).toBe(`${exactly}…`)
  })

  it("collapses values nested deeper than 4 levels", () => {
    expect(
      sanitizeJsonForStorage({
        l1: { l2: { l3: { l4: { l5: "deep" } } } },
      })
    ).toEqual({
      l1: { l2: { l3: { l4: { l5: "[truncated-depth]" } } } },
    })
  })

  it("caps arrays and object entries at 50 items", () => {
    const longArray = Array.from({ length: 60 }, (_, index) => index)
    expect(sanitizeJsonForStorage(longArray)).toEqual(
      Array.from({ length: 50 }, (_, index) => index)
    )

    const wideObject = Object.fromEntries(
      Array.from({ length: 60 }, (_, index) => [`k${index}`, index])
    )
    expect(Object.keys(sanitizeJsonForStorage(wideObject) as object)).toEqual(
      Array.from({ length: 50 }, (_, index) => `k${index}`)
    )
  })

  it("stringifies bigints", () => {
    expect(sanitizeJsonForStorage({ value: BigInt(1) })).toEqual({
      value: "1",
    })
  })

  it("stringifies function and symbol leaves", () => {
    const fn = () => 1
    const symbol = Symbol("marker")
    expect(sanitizeJsonForStorage(fn)).toBe(String(fn))
    expect(sanitizeJsonForStorage(symbol)).toBe(String(symbol))
    expect(sanitizeJsonForStorage({ fn, symbol })).toEqual({
      fn: String(fn),
      symbol: String(symbol),
    })
  })
})

describe("sanitizeJsonForStorage with mirror options", () => {
  it("leaves long strings and deep nesting unbounded", () => {
    const longString = "a".repeat(8_001)
    expect(
      sanitizeJsonForStorage(longString, MIRROR_JSON_SANITIZE_OPTIONS)
    ).toBe(longString)

    const deep = { l1: { l2: { l3: { l4: { l5: { l6: "deep" } } } } } }
    expect(sanitizeJsonForStorage(deep, MIRROR_JSON_SANITIZE_OPTIONS)).toEqual(
      deep
    )
  })

  it("does not cap arrays or object entries", () => {
    const longArray = Array.from({ length: 60 }, (_, index) => index)
    expect(
      sanitizeJsonForStorage(longArray, MIRROR_JSON_SANITIZE_OPTIONS)
    ).toEqual(longArray)

    const wideObject = Object.fromEntries(
      Array.from({ length: 60 }, (_, index) => [`k${index}`, index])
    )
    expect(
      Object.keys(
        sanitizeJsonForStorage(
          wideObject,
          MIRROR_JSON_SANITIZE_OPTIONS
        ) as object
      )
    ).toHaveLength(60)
  })

  it("drops function and symbol object entries instead of stringifying them", () => {
    const fn = () => 1
    expect(
      sanitizeJsonForStorage(
        { keep: 1, drop: fn, symbol: Symbol("marker") },
        MIRROR_JSON_SANITIZE_OPTIONS
      )
    ).toEqual({ keep: 1 })
  })

  it("serializes bigints identically to the historical mirror output", () => {
    expect(
      JSON.stringify(
        sanitizeJsonForStorage(
          { type: "tool", value: BigInt(1) },
          MIRROR_JSON_SANITIZE_OPTIONS
        )
      )
    ).toBe('{"type":"tool","value":"1"}')
  })
})

describe("deterministicId", () => {
  it("returns the full sha256 hex digest by default (provenance semantics)", () => {
    expect(deterministicId("provenance-run-event", "run-1:1")).toBe(
      "e4691423cf5031bec179c005db25d5f781c4b29dedd5543d2022bff91b826590"
    )
    expect(deterministicId("provenance-tool-call", "run-1:tool-1")).toBe(
      "fe9938636f023ced8a2de496684c7fd559c2dcbbb6c842bfc74abbbf5ec701e9"
    )
    expect(deterministicId("provenance-mutation", "run-1:package.json")).toBe(
      "7f096f27152ed0ccde695509285d686f1309cec199fe9a206ea3d59239c289a4"
    )
  })

  it("returns a truncated digest when hexLength is given (mirror semantics)", () => {
    expect(
      deterministicId("pi-tool-execution", "run-1:tool-1", { hexLength: 32 })
    ).toBe("35e976edd054a554fd34b86e0400085e")
    expect(
      deterministicId("pi-file-mutation", "run-1:package.json", {
        hexLength: 32,
      })
    ).toBe("2f5f9868642d97a33f00aa55a04c46d3")

    const full = deterministicId("pi-tool-execution", "run-1:tool-1")
    expect(full).toHaveLength(64)
    expect(
      deterministicId("pi-tool-execution", "run-1:tool-1", { hexLength: 32 })
    ).toBe(full.slice(0, 32))
  })
})
