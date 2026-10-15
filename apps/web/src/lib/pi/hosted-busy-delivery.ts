/**
 * Saved steering mode decides what a message does while a hosted turn is busy.
 * `all` joins the running turn. `one-at-a-time` waits as a follow-up.
 * Local sessions always queue a follow-up.
 */
export function hostedWhenBusy(input: {
  hostedAgentOnly: boolean
  steeringMode?: string
}): "steer" | "followUp" {
  if (!input.hostedAgentOnly) return "followUp"
  if (input.steeringMode === "one-at-a-time") return "followUp"
  return "steer"
}
