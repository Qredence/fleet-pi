import type {
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
} from "@earendil-works/pi-coding-agent"

/**
 * Points the system prompt's working directory at the Daytona sandbox.
 *
 * Pi 1.x renders the cwd as a structured `<cwd>` section from
 * `systemPromptOptions.cwd`; the old `Current working directory: ...` line no
 * longer exists, so the previous regex rewrite silently did nothing and the
 * model saw the server's local path. Mutating the option keeps the prompt
 * structured (no forced full-prompt override). The regex path remains as a
 * fallback for events without structured options.
 */
export function applySandboxCwdToPrompt(
  event: Pick<BeforeAgentStartEvent, "systemPrompt"> &
    Partial<Pick<BeforeAgentStartEvent, "systemPromptOptions">>,
  sandboxCwd: string,
  sandboxLabel: string
): BeforeAgentStartEventResult | undefined {
  const described = `${sandboxCwd} (Daytona sandbox ${sandboxLabel})`
  if (event.systemPromptOptions) {
    event.systemPromptOptions.cwd = described
    return undefined
  }
  const systemPrompt = event.systemPrompt.replace(
    /Current working directory: .*/g,
    `Current working directory: ${described}`
  )
  return systemPrompt === event.systemPrompt ? undefined : { systemPrompt }
}
