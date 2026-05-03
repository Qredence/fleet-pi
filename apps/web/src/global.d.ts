import type { FleetPiDesktopApi } from "@/lib/desktop/types"

declare global {
  interface Window {
    fleetPiDesktop?: FleetPiDesktopApi
  }
}

export {}
