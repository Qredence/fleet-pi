import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  toModelOption,
  toModelSelection,
} from "@workspace/hax-design/lib/pi/chat-helpers"
import {
  applyThemePreference,
  clampResourceCanvasWidth,
  getResourceCanvasInitialWidth,
  readStoredResourceCanvasWidth,
  readStoredThemePreference,
  storeResourceCanvasWidth,
  storeThemePreference,
} from "@workspace/hax-design/lib/canvas-utils"
import { startHorizontalResize } from "@workspace/hax-design/lib/horizontal-resize"
import { useChatStorage } from "./use-chat-storage"
import type { PointerEvent as ReactPointerEvent } from "react"
import type {
  ChatMode,
  ChatModelsResponse,
  ChatSessionMetadata,
} from "@workspace/hax-design/lib/pi/chat-protocol"
import type {
  RightPanel,
  ThemePreference,
} from "@workspace/hax-design/lib/canvas-utils"

export function useChatShellState(modelsData: ChatModelsResponse | undefined) {
  const {
    mode: storedMode,
    setMode: setStoredMode,
    sessionMetadata: storedSessionMetadata,
    setSessionMetadata: setStoredSessionMetadata,
  } = useChatStorage()

  const models = useMemo(
    () => modelsData?.models.map(toModelOption) ?? [],
    [modelsData]
  )
  const [modelKey, setModelKey] = useState<string | undefined>()
  const [mode, setMode] = useState<ChatMode>(() => storedMode)
  const modeRef = useRef(mode)
  const [rightPanel, setRightPanel] = useState<RightPanel>(null)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [themePreference, setThemePreference] = useState<ThemePreference>(() =>
    readStoredThemePreference()
  )
  const [resourceCanvasWidth, setResourceCanvasWidth] = useState(() =>
    readStoredResourceCanvasWidth()
  )

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  useEffect(() => {
    if (models.length > 0 && !modelKey) {
      setModelKey(modelsData?.selectedModelKey ?? models[0]?.id)
    }
  }, [models, modelKey, modelsData])

  useEffect(() => {
    applyThemePreference(themePreference)

    if (themePreference !== "system") return
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => applyThemePreference("system")
    media.addEventListener("change", handleChange)
    return () => media.removeEventListener("change", handleChange)
  }, [themePreference])

  const prevRightPanelRef = useRef<RightPanel>(null)

  useEffect(() => {
    const prevRightPanel = prevRightPanelRef.current
    prevRightPanelRef.current = rightPanel

    if (!rightPanel || prevRightPanel !== null) return

    const initialWidth = getResourceCanvasInitialWidth()
    setResourceCanvasWidth(initialWidth)
    storeResourceCanvasWidth(initialWidth)
  }, [rightPanel])

  useEffect(() => {
    if (!rightPanel) return

    const handleViewportResize = () => {
      setResourceCanvasWidth((currentWidth) => {
        const nextWidth = clampResourceCanvasWidth(currentWidth)
        storeResourceCanvasWidth(nextWidth)
        return nextWidth
      })
    }

    window.addEventListener("resize", handleViewportResize)
    return () => {
      window.removeEventListener("resize", handleViewportResize)
    }
  }, [rightPanel])

  const handleModeChange = useCallback(
    (nextMode: string) => {
      const normalized: ChatMode =
        nextMode === "plan"
          ? "plan"
          : nextMode === "harness"
            ? "harness"
            : "agent"
      modeRef.current = normalized
      setMode(normalized)
      setStoredMode(normalized)
    },
    [setStoredMode]
  )

  const handleThemePreferenceChange = useCallback(
    (preference: ThemePreference) => {
      setThemePreference(preference)
      storeThemePreference(preference)
      applyThemePreference(preference)
    },
    []
  )

  const handleResourceCanvasResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const startWidth = resourceCanvasWidth

      startHorizontalResize({
        event,
        startWidth,
        getNextWidth: (clientX, startX, width) =>
          clampResourceCanvasWidth(width - (clientX - startX)),
        onWidthChange: (nextWidth) => {
          setResourceCanvasWidth(nextWidth)
          storeResourceCanvasWidth(nextWidth)
        },
      })
    },
    [resourceCanvasWidth]
  )

  const persistSession = useCallback(
    (metadata: ChatSessionMetadata, modeOverride?: ChatMode) => {
      setStoredSessionMetadata(metadata, modeOverride ?? modeRef.current)
    },
    [setStoredSessionMetadata]
  )

  const selectedModel = models.find((model) => model.id === modelKey)
  const modelSelection = useMemo(
    () => toModelSelection(selectedModel),
    [selectedModel]
  )

  return {
    commandPaletteOpen,
    handleModeChange,
    handleResourceCanvasResizeStart,
    handleThemePreferenceChange,
    initialSessionMetadata: storedSessionMetadata,
    mode,
    modelKey,
    modelSelection,
    models,
    persistSession,
    resourceCanvasWidth,
    rightPanel,
    setCommandPaletteOpen,
    setModelKey,
    setRightPanel,
    themePreference,
  }
}
