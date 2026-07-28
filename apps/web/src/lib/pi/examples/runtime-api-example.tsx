import type {
  ChatModelSelection,
  ChatSessionMetadata,
  ChatThinkingLevel,
} from "@workspace/pi-protocol/chat-protocol"

import { retainPiRuntime, abortActiveSession } from "@/lib/pi/server-runtime"
import { resolveAppRuntimeContext } from "@/lib/app-runtime"

/**
 * Example component demonstrating Pi Runtime API usage
 * 
 * This shows how to:
 * 1. Create a new runtime with model selection
 * 2. Retain runtime reference (for abort/stop control)
 * 3. Gracefully shutdown on cleanup
 * 
 * Note: This is a server-side pattern - typically called from route handlers
 */

export async function createExampleRuntime(
  cwd: string,
  metadata: ChatSessionMetadata,
  provider?: string,
  modelId?: string,
  thinkingLevel?: ChatThinkingLevel
) {
  // Get runtime context from app environment
  const context = resolveAppRuntimeContext()
  
  // Set project root for this workspace
  context.projectRoot = cwd
  
  // Build model selection if specified
  const modelSelection: ChatModelSelection | undefined = (provider && modelId)
    ? { provider, id: modelId, thinkingLevel }
    : undefined
  
  // Create runtime instance
  const { createPiRuntime } = await import("@/lib/pi/server-runtime")
  const result = await createPiRuntime(context, metadata, modelSelection)
  
  // Retain reference for lifecycle management
  const release = retainPiRuntime(result.runtime, undefined)
  
  return {
    runtime: result.runtime,
    sessionReset: result.sessionReset,
    diagnostics: result.diagnostics,
    // Cleanup function to be called on unmount/component destroy
    cleanup: () => {
      release()
      abortActiveSession(metadata).catch(console.error)
    },
  }
}

/**
 * Example usage in TanStack Router file route:
 * 
 * ```typescript
 * export const Route = createFileRoute("/chat/new")({
 *   loader: async ({ request }) => {
 *     const { getSessionUser } = await import("@/lib/auth/server")
 *     const authSession = await getSessionUser(request)
 *     
 *     const runtime = await createExampleRuntime(
 *       process.cwd(),
 *       { 
 *         sessionId: crypto.randomUUID(),
 *         userIdentifier: authSession?.user.id 
 *       }
 *     )
 *     
 *     return { runtimeId: runtime.runtime.session.sessionId }
 *   },
 * })
 * ```
 */
