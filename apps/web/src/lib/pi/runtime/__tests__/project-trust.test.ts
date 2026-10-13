import { describe, expect, it } from "vitest"
import trustHandlerExtension from "../../../../../../../.pi/extensions/trust-handler"
import type {
  ProjectTrustContext,
  ProjectTrustEventResult,
} from "@earendil-works/pi-coding-agent"

describe("project trust for headless sessions", () => {
  it("trusts the user volume and rejects paths outside it in json mode", async () => {
    const handler = projectTrustHandler()
    const volume = await handler("/home/daytona/agent-workspace/memory/project")
    const outside = await handler("/repo")
    const system = await handler("/home/daytona/agent-workspace/system")
    const evals = await handler(
      "/home/daytona/agent-workspace/evals/memory-quality.md"
    )

    expect(volume).toEqual({ trusted: "yes", remember: true })
    expect(outside).toEqual({ trusted: "no" })
    expect(system).toEqual({ trusted: "no" })
    expect(evals).toEqual({ trusted: "no" })
  })
})

function projectTrustHandler() {
  let handler:
    | ((
        event: { type: "project_trust"; cwd: string },
        ctx: ProjectTrustContext
      ) => Promise<ProjectTrustEventResult>)
    | undefined

  trustHandlerExtension({
    on(event: string, registered: unknown) {
      if (event === "project_trust") {
        handler = registered as NonNullable<typeof handler>
      }
    },
  } as never)

  if (!handler) throw new Error("project_trust handler was not registered")
  const decide = handler
  return (cwd: string) =>
    decide(
      { type: "project_trust", cwd },
      {
        cwd,
        mode: "json",
        hasUI: false,
        ui: {
          select: () => Promise.resolve(undefined),
          confirm: () => Promise.resolve(false),
          input: () => Promise.resolve(undefined),
          notify: () => undefined,
        },
      }
    )
}
