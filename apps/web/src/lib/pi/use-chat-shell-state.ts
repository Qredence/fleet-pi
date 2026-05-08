import { useCallback, useEffect, useMemo, useState } from "react"
import { toModelOption, toModelSelection } from "./chat-helpers"
import { useChatStorage } from "./use-chat-storage"
import type { PointerEvent as ReactPointerEvent } from "react"
import type {
  ChatMode,
  ChatModelsResponse,
  ChatSessionMetadata,
} from "./chat-protocol"
import type { RightPanel, ThemePreference } from "@/lib/canvas-utils"
import {
  applyThemePreference,
  clampResourceCanvasWidth,
  getResourceCanvasInitialWidth,
  readStoredResourceCanvasWidth,
  readStoredThemePreference,
  storeResourceCanvasWidth,
  storeThemePreference,
} from "@/lib/canvas-utils"

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
  const [rightPanel, setRightPanel] = useState<RightPanel>(null)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [themePreference, setThemePreference] = useState<ThemePreference>(() =>
    readStoredThemePreference()
  )
  const [resourceCanvasWidth, setResourceCanvasWidth] = useState(() =>
    readStoredResourceCanvasWidth()
  )

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

  useEffect(() => {
    if (!rightPanel) return
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
      const normalized: ChatMode = nextMode === "plan" ? "plan" : "agent"
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
      event.preventDefault()
      const startX = event.clientX
      const startWidth = resourceCanvasWidth

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const nextWidth = clampResourceCanvasWidth(
          startWidth - (moveEvent.clientX - startX)
        )
        setResourceCanvasWidth(nextWidth)
        storeResourceCanvasWidth(nextWidth)
      }

      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove)
        window.removeEventListener("pointerup", handlePointerUp)
      }

      window.addEventListener("pointermove", handlePointerMove)
      window.addEventListener("pointerup", handlePointerUp, { once: true })
    },
    [resourceCanvasWidth]
  )

  const persistSession = useCallback(
    (metadata: ChatSessionMetadata) => {
      setStoredSessionMetadata(metadata)
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
