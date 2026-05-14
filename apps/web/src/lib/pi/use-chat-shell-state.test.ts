import { beforeEach, describe, expect, it, vi } from "vitest"

const mockUseChatStorage = vi.fn()
const mockUseState = vi.fn()
const mockUseRef = vi.fn()
const mockUseMemo = vi.fn()
const mockUseCallback = vi.fn()
const mockUseEffect = vi.fn()

vi.mock("react", async () => {
  const actual = await vi.importActual("react")

  return {
    ...actual,
    useState: (...args: Array<unknown>) => mockUseState(...args),
    useRef: (...args: Array<unknown>) => mockUseRef(...args),
    useMemo: (...args: Array<unknown>) => mockUseMemo(...args),
    useCallback: (...args: Array<unknown>) => mockUseCallback(...args),
    useEffect: (...args: Array<unknown>) => mockUseEffect(...args),
  }
})

vi.mock("./use-chat-storage", () => ({
  useChatStorage: () => mockUseChatStorage(),
}))

vi.mock("@/lib/canvas-utils", () => ({
  applyThemePreference: vi.fn(),
  clampResourceCanvasWidth: vi.fn((width: number) => width),
  getResourceCanvasInitialWidth: vi.fn(() => 320),
  readStoredResourceCanvasWidth: vi.fn(() => 320),
  readStoredThemePreference: vi.fn(() => "light"),
  storeResourceCanvasWidth: vi.fn(),
  storeThemePreference: vi.fn(),
}))

describe("useChatShellState", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("persists a harness session using the synchronously selected scope", async () => {
    const setMode = vi.fn()
    const setStoredMode = vi.fn()
    const setStoredSessionMetadata = vi.fn()
    const modeRef = { current: "agent" }

    mockUseRef.mockReturnValue(modeRef)
    mockUseMemo.mockImplementation((factory: () => unknown) => factory())
    mockUseCallback.mockImplementation((callback: unknown) => callback)
    mockUseEffect.mockImplementation((effect: () => void | (() => void)) => {
      effect()
    })
    mockUseState
      .mockImplementationOnce(() => [undefined, vi.fn()])
      .mockImplementationOnce(() => ["agent", setMode])
      .mockImplementationOnce(() => [null, vi.fn()])
      .mockImplementationOnce(() => [false, vi.fn()])
      .mockImplementationOnce(() => ["light", vi.fn()])
      .mockImplementationOnce(() => [320, vi.fn()])

    mockUseChatStorage.mockReturnValue({
      mode: "agent",
      setMode: setStoredMode,
      sessionMetadata: {},
      setSessionMetadata: setStoredSessionMetadata,
    })

    const { useChatShellState } = await import("./use-chat-shell-state")
    const shellState = useChatShellState(undefined)

    shellState.handleModeChange("harness")
    shellState.persistSession({ sessionId: "harness-session" })

    expect(modeRef.current).toBe("harness")
    expect(setStoredMode).toHaveBeenCalledWith("harness")
    expect(setMode).toHaveBeenCalledWith("harness")
    expect(setStoredSessionMetadata).toHaveBeenCalledWith(
      { sessionId: "harness-session" },
      "harness"
    )
  })

  it("still allows an explicit mode override when persisting", async () => {
    const setStoredSessionMetadata = vi.fn()
    const modeRef = { current: "harness" }

    mockUseRef.mockReturnValue(modeRef)
    mockUseMemo.mockImplementation((factory: () => unknown) => factory())
    mockUseCallback.mockImplementation((callback: unknown) => callback)
    mockUseEffect.mockImplementation((effect: () => void | (() => void)) => {
      effect()
    })
    mockUseState
      .mockImplementationOnce(() => [undefined, vi.fn()])
      .mockImplementationOnce(() => ["harness", vi.fn()])
      .mockImplementationOnce(() => [null, vi.fn()])
      .mockImplementationOnce(() => [false, vi.fn()])
      .mockImplementationOnce(() => ["light", vi.fn()])
      .mockImplementationOnce(() => [320, vi.fn()])

    mockUseChatStorage.mockReturnValue({
      mode: "harness",
      setMode: vi.fn(),
      sessionMetadata: {},
      setSessionMetadata: setStoredSessionMetadata,
    })

    const { useChatShellState } = await import("./use-chat-shell-state")
    const shellState = useChatShellState(undefined)

    shellState.persistSession({ sessionId: "agent-session" }, "agent")

    expect(setStoredSessionMetadata).toHaveBeenCalledWith(
      { sessionId: "agent-session" },
      "agent"
    )
  })
})
