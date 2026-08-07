import { describe, expect, it } from "vitest"

import { cn } from "./utils"

describe("cn typography token classification", () => {
  it("keeps text-label next to a text color class", () => {
    expect(cn("text-label", "text-foreground/55")).toBe(
      "text-label text-foreground/55"
    )
  })

  it("keeps text-body next to a text color class", () => {
    expect(cn("text-body", "leading-5", "text-foreground/80")).toBe(
      "text-body leading-5 text-foreground/80"
    )
  })

  it("still merges two typography tokens (font-size wins later)", () => {
    expect(cn("text-label", "text-body")).toBe("text-body")
  })

  it("still merges two text colors", () => {
    expect(cn("text-foreground/55", "text-foreground/80")).toBe(
      "text-foreground/80"
    )
  })

  it("keeps radius tokens next to other classes", () => {
    expect(cn("rounded-sm", "bg-foreground/5", "hover:bg-foreground/6")).toBe(
      "rounded-sm bg-foreground/5 hover:bg-foreground/6"
    )
  })
})
