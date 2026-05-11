const RESOURCE_CANVAS_WIDTH_STORAGE_KEY = "fleet-pi-resource-canvas-width"
const THEME_PREFERENCE_STORAGE_KEY = "fleet-pi-theme-preference"
const RESOURCE_CANVAS_MIN_WIDTH = 320
const RESOURCE_CANVAS_VIEWPORT_RATIO = 0.5

export type ThemePreference = "light" | "dark" | "system"

export type RightPanel = "resources" | "workspace" | "configurations" | null

export function getResourceCanvasInitialWidth() {
  if (typeof window === "undefined") return RESOURCE_CANVAS_MIN_WIDTH
  return getResourceCanvasMaxWidth()
}

export function getResourceCanvasMaxWidth() {
  if (typeof window === "undefined") return RESOURCE_CANVAS_MIN_WIDTH
  return Math.max(
    RESOURCE_CANVAS_MIN_WIDTH,
    Math.floor(window.innerWidth * RESOURCE_CANVAS_VIEWPORT_RATIO)
  )
}

export function clampResourceCanvasWidth(width: number) {
  return Math.min(
    getResourceCanvasMaxWidth(),
    Math.max(RESOURCE_CANVAS_MIN_WIDTH, Math.round(width))
  )
}

export function readStoredResourceCanvasWidth() {
  if (typeof window === "undefined") return getResourceCanvasInitialWidth()

  const value = Number(
    window.localStorage.getItem(RESOURCE_CANVAS_WIDTH_STORAGE_KEY)
  )
  return Number.isFinite(value)
    ? clampResourceCanvasWidth(value)
    : getResourceCanvasInitialWidth()
}

export function storeResourceCanvasWidth(width: number) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(
    RESOURCE_CANVAS_WIDTH_STORAGE_KEY,
    String(clampResourceCanvasWidth(width))
  )
}

export function readStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system"

  const value = window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)
  return value === "light" || value === "dark" || value === "system"
    ? value
    : "system"
}

export function storeThemePreference(preference: ThemePreference) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, preference)
}

export function applyThemePreference(preference: ThemePreference) {
  if (typeof window === "undefined") return

  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  const dark = preference === "dark" || (preference === "system" && systemDark)
  document.documentElement.classList.toggle("dark", dark)
  document.documentElement.dataset.theme = dark ? "dark" : "light"
}
