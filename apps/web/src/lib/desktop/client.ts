import { DESKTOP_AUTH_HEADER } from "./types"
import type { DesktopContext } from "./types"

export function withDesktopHeaders(
  init: RequestInit | undefined,
  desktopContext?: DesktopContext
) {
  const headers = new Headers(init?.headers)

  if (desktopContext?.isDesktop && desktopContext.requestToken) {
    headers.set(DESKTOP_AUTH_HEADER, desktopContext.requestToken)
  }

  return {
    ...init,
    headers,
  }
}
