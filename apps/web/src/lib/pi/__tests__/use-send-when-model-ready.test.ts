// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import {
  isModelPickerReady,
  useSendWhenModelReady,
} from "../use-send-when-model-ready"

describe("isModelPickerReady", () => {
  it.each([
    [{ status: "pending", modelCount: 0, hasSelection: false }, false],
    [{ status: "success", modelCount: 2, hasSelection: false }, false],
    [{ status: "success", modelCount: 2, hasSelection: true }, true],
    [{ status: "success", modelCount: 0, hasSelection: false }, true],
    [{ status: "error", modelCount: 0, hasSelection: false }, true],
  ] as const)("%o -> %s", (input, expected) => {
    expect(isModelPickerReady(input)).toBe(expected)
  })
})

describe("useSendWhenModelReady", () => {
  it("sends immediately when ready", async () => {
    const send = vi.fn(() => Promise.resolve())
    const { result } = renderHook(() => useSendWhenModelReady(send, true))
    await act(() => result.current({ text: "hi" }))
    expect(send).toHaveBeenCalledWith({ text: "hi" })
  })

  it("holds a send until ready, then dispatches with the latest sender", async () => {
    const early = vi.fn(() => Promise.resolve())
    const late = vi.fn(() => Promise.resolve())
    const { result, rerender } = renderHook(
      ({ send, ready }) => useSendWhenModelReady(send, ready),
      { initialProps: { send: early, ready: false } }
    )

    let settled = false
    let held!: Promise<void>
    act(() => {
      held = result.current({ text: "first" }).then(() => {
        settled = true
      })
    })
    // A second submit during the hold is ignored, not queued.
    await act(() => result.current({ text: "second" }))
    expect(early).not.toHaveBeenCalled()
    expect(settled).toBe(false)

    rerender({ send: late, ready: true })
    await act(() => held)

    expect(early).not.toHaveBeenCalled()
    expect(late).toHaveBeenCalledTimes(1)
    expect(late).toHaveBeenCalledWith({ text: "first" })
    expect(settled).toBe(true)
  })
})
