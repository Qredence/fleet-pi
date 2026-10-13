import { isHostedDeployment } from "../../deployment/environment"
import { isInsideUserVolume } from "../../../../../../.pi/extensions/lib/project-trust"
import type {
  LoadExtensionsResult,
  ProjectTrustEventResult,
} from "@earendil-works/pi-coding-agent"

const headlessUi = {
  select: () => Promise.resolve(undefined),
  confirm: () => Promise.resolve(false),
  input: () => Promise.resolve(undefined),
  notify: () => undefined,
}

/**
 * Runs `project_trust` for the web resource loader.
 * A local checkout stays trusted so project extensions keep loading.
 * Hosted chat trusts the user volume and rejects the shared git checkout.
 */
export async function resolveLoaderProjectTrust(input: {
  extensionsResult: LoadExtensionsResult
  cwd: string
  mode: "print" | "json" | "rpc"
}): Promise<boolean> {
  const event = { type: "project_trust" as const, cwd: input.cwd }
  const ctx = {
    cwd: input.cwd,
    mode: input.mode,
    hasUI: false,
    ui: headlessUi,
  }
  let sawDecision = false
  let trusted = false
  for (const extension of input.extensionsResult.extensions) {
    const handlers = extension.handlers.get("project_trust") ?? []
    for (const handler of handlers) {
      const result = (await handler(event, ctx)) as
        ProjectTrustEventResult | undefined
      if (!result || result.trusted === "undecided") continue
      sawDecision = true
      trusted = result.trusted === "yes"
      break
    }
    if (sawDecision) break
  }

  if (sawDecision) {
    if (!isHostedDeployment() && !isInsideUserVolume(input.cwd)) return true
    return trusted
  }
  if (!isHostedDeployment()) return true
  return isInsideUserVolume(input.cwd)
}
