import { createContext, useContext } from "react"
import type { ReactNode } from "react"
import type { RightPanel } from "../../../lib/canvas-utils"
import type { RightPanelContentProps } from "./right-panel-registry"

export type RightPanelContextValue = RightPanelContentProps & {
  rightPanel: RightPanel
  setRightPanel: (panel: RightPanel) => void
}

const RightPanelContext = createContext<RightPanelContextValue | null>(null)

export function RightPanelProvider({
  value,
  children,
}: {
  value: RightPanelContextValue
  children: ReactNode
}) {
  return (
    <RightPanelContext.Provider value={value}>
      {children}
    </RightPanelContext.Provider>
  )
}

export function useRightPanelContext() {
  const context = useContext(RightPanelContext)
  if (!context) {
    throw new Error(
      "useRightPanelContext must be used within RightPanelProvider"
    )
  }
  return context
}
