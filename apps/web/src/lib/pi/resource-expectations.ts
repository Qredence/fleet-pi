import type { ChatResourcesResponse } from "./chat-protocol"

export const EXPECTED_PROJECT_EXTENSION_NAMES = [
  "project-inventory",
  "workspace-index",
  "workspace-write",
  "workspace-context",
  "web-fetch",
]

export function collectResourceExpectationDiagnostics(
  resources: Pick<ChatResourcesResponse, "extensions">
) {
  const extensionNames = new Set(
    resources.extensions.map((extension) => extension.name.toLowerCase())
  )

  return EXPECTED_PROJECT_EXTENSION_NAMES.filter(
    (extensionName) => !extensionNames.has(extensionName)
  ).map((extensionName) => `Missing expected Pi extension: ${extensionName}`)
}
