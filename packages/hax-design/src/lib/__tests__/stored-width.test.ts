import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { readStoredWidth, storeStoredWidth } from "../stored-width"
import { startHorizontalResize } from "../horizontal-resize"
import type { PointerEvent as ReactPointerEvent } from "react"

function createMockWindow() {
  const target = new EventTarget()
  const storage = new Map<string, string>()

  return {
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
      clear: () => {
        storage.clear()
      },
    },
  }
}

describe("readStoredWidth", () => {
  beforeEach(() => {
    vi.stubGlobal("window", createMockWindow())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns defaultWidth when localStorage has no entry instead of clamping Number(null) === 0", () => {
    const clamp = (w: number) => Math.max(320, Math.min(800, w))
    expect(readStoredWidth("missing-key", 600, clamp)).toBe(600)
  })

  it("returns defaultWidth when localStorage entry is empty or non-numeric", () => {
    const clamp = (w: number) => Math.max(320, Math.min(800, w))
    window.localStorage.setItem("empty-key", "   ")
    window.localStorage.setItem("nan-key", "not-a-number")
    expect(readStoredWidth("empty-key", 600, clamp)).toBe(600)
    expect(readStoredWidth("nan-key", 600, clamp)).toBe(600)
  })

  it("clamps and returns stored numeric width", () => {
    const clamp = (w: number) => Math.max(320, Math.min(800, w))
    storeStoredWidth("canvas-width", 480)
    expect(readStoredWidth("canvas-width", 600, clamp)).toBe(480)
  })
})

describe("startHorizontalResize", () => {
  beforeEach(() => {
    vi.stubGlobal("window", createMockWindow())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("cleans up pointermove listener when pointercancel fires", () => {
    const onWidthChange = vi.fn()
    const fakeEvent = {
      preventDefault: vi.fn(),
      clientX: 500,
    } as unknown as ReactPointerEvent<HTMLButtonElement>

    startHorizontalResize({
      event: fakeEvent,
      startWidth: 400,
      getNextWidth: (clientX, startX, startWidth) =>
        startWidth + (clientX - startX),
      onWidthChange,
    })

    window.dispatchEvent(
      Object.assign(new Event("pointermove"), { clientX: 520 })
    )
    expect(onWidthChange).toHaveBeenCalledWith(420)

    window.dispatchEvent(new Event("pointercancel"))
    onWidthChange.mockClear()

    window.dispatchEvent(
      Object.assign(new Event("pointermove"), { clientX: 560 })
    )
    expect(onWidthChange).not.toHaveBeenCalled()
  })
})
