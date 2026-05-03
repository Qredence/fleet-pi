import type { ChatSessionMetadata } from "@/lib/pi/chat-protocol"

export const DESKTOP_AUTH_HEADER = "x-fleet-pi-desktop-token"

export type DesktopProjectSummary = {
  projectRoot: string
  workspaceRoot: string
  workspaceId: string
  name: string
  lastOpenedAt: string
}

export type DesktopContext = {
  isDesktop: boolean
  requestToken?: string
  recentProjects: Array<DesktopProjectSummary>
  activeProjectRoot?: string
  activeWorkspaceRoot?: string
  workspaceId?: string
  sessionDir?: string
  activeSession?: ChatSessionMetadata
}

export type DesktopEvent =
  | { type: "context-changed"; context: DesktopContext }
  | { type: "new-session" }

export type FleetPiDesktopApi = {
  getDesktopContext: () => Promise<DesktopContext>
  pickProjectDirectory: () => Promise<DesktopContext>
  openRecentProject: (projectRoot: string) => Promise<DesktopContext>
  clearRecentProjects: () => Promise<DesktopContext>
  revealPath: (kind: "project" | "workspace") => Promise<boolean>
  setActiveSession: (metadata: ChatSessionMetadata) => Promise<DesktopContext>
  onEvent: (listener: (event: DesktopEvent) => void) => () => void
}
