import { describe, expect, it } from "vitest"
import {
  formatProvenanceSuffix,
  parseMemoryBullet,
} from "../../../../../.pi/extensions/lib/memory-record"

describe("memory record provenance", () => {
  it("reads a full v3 marker", () => {
    const bullet = parseMemoryBullet(
      "User's name is Zachary <!-- pi-memory v=3 id=mem_zac source=user ts=2026-08-10T12:00:00Z -->"
    )

    expect(bullet).toEqual({
      text: "User's name is Zachary",
      provenance: {
        version: 3,
        id: "mem_zac",
        source: "user",
        timestamp: "2026-08-10T12:00:00Z",
        isLegacy: false,
      },
    })
  })

  it("tags a bare bullet as legacy and unknown", () => {
    const bullet = parseMemoryBullet("Keep pill-shaped header chrome")

    expect(bullet.text).toBe("Keep pill-shaped header chrome")
    expect(bullet.provenance).toEqual({
      version: 0,
      id: null,
      source: "unknown",
      timestamp: null,
      isLegacy: true,
    })
  })

  it("keeps the text and downgrades an unknown source", () => {
    const bullet = parseMemoryBullet(
      "A fact <!-- pi-memory v=3 id=mem_1 source=martian -->"
    )

    expect(bullet.text).toBe("A fact")
    expect(bullet.provenance).toMatchObject({
      version: 3,
      id: "mem_1",
      source: "unknown",
      timestamp: null,
      isLegacy: false,
    })
  })

  it("adds a suffix for provenance-bearing records only", () => {
    expect(
      formatProvenanceSuffix({
        version: 3,
        id: "mem_1",
        source: "agent",
        timestamp: "2026-08-10",
        isLegacy: false,
      })
    ).toBe(" [source: agent; 2026-08-10; mem_1]")

    expect(
      formatProvenanceSuffix({
        version: 0,
        id: null,
        source: "unknown",
        timestamp: null,
        isLegacy: true,
      })
    ).toBe("")
  })
})
