import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const REPO_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../"
)

function readRepoFile(path: string) {
  return readFile(resolve(REPO_ROOT, path), "utf8")
}

describe("adaptive workspace docs contract", () => {
  it("keeps the ADR explicit about canonical files and projection boundaries", async () => {
    const adr = await readRepoFile(
      "docs/adr/0001-agent-workspace-as-canonical-adaptive-state.md"
    )

    expect(adr).toContain(
      "`agent-workspace/` is the canonical durable adaptive state"
    )
    expect(adr).toContain("database is a projection")
    expect(adr).toContain("durable learning updates write files")
    expect(adr).toContain("database rows point back to files")
    expect(adr).toContain("Git diff and revert stay central")
  })

  it("keeps the adaptive workspace guide aligned with the canonical contract", async () => {
    const guide = await readRepoFile("docs/adaptive-workspace.md")

    expect(guide).toContain("`agent-workspace/manifest.json`")
    expect(guide).toContain("`instructions/`")
    expect(guide).toContain("`memory/`")
    expect(guide).toContain("`plans/`")
    expect(guide).toContain("`skills/`")
    expect(guide).toContain("`evals/`")
    expect(guide).toContain("`artifacts/`")
    expect(guide).toContain("`scratch/` is non-canonical temporary space")
    expect(guide).toContain(
      "`agent-workspace/indexes/` stores non-canonical projection data"
    )
    expect(guide).toContain("`agent-workspace/pi/skills`")
    expect(guide).toContain("`agent-workspace/pi/prompts`")
    expect(guide).toContain("`agent-workspace/pi/extensions`")
    expect(guide).toContain("`agent-workspace/pi/packages`")
    expect(guide).toContain(
      "Durable memory, skills, plans, evals, and artifacts remain path-backed files"
    )
    expect(guide).toContain(
      "`.pi/settings.json` remains the compatibility bridge"
    )
  })

  it("keeps the runtime integration guide aligned with the current Pi seams", async () => {
    const guide = await readRepoFile("docs/runtime-sdk-integration.md")

    expect(guide).toContain("`createAgentSessionRuntime`")
    expect(guide).toContain("`createAgentSessionServices`")
    expect(guide).toContain("`SessionManager`")
    expect(guide).toContain("`session.subscribe(...)`")
    expect(guide).toContain("queueing during streaming")
    expect(guide).toContain("Plan Mode")
    expect(guide).toContain("workspace bootstrap")
    expect(guide).toContain("indexing")
    expect(guide).toContain("provenance")
    expect(guide).toContain("Pi session compatibility")
    expect(guide).toContain("read-only")
    expect(guide).toContain("`.pi/settings.json` compatibility bridge")
  })

  it("keeps the Pi compatibility bridge pointed at workspace-native resources", async () => {
    const settings = JSON.parse(await readRepoFile(".pi/settings.json")) as {
      extensions?: Array<string>
      prompts?: Array<string>
      skills?: Array<string>
    }

    expect(settings.skills).toContain("../agent-workspace/pi/skills")
    expect(settings.prompts).toContain("../agent-workspace/pi/prompts")
    expect(settings.extensions).toContain(
      "../agent-workspace/pi/extensions/enabled"
    )
  })

  it("keeps setup docs and the Codex bootstrap path aligned", async () => {
    const [readme, quickstart, codex, bootstrap] = await Promise.all([
      readRepoFile("README.md"),
      readRepoFile("docs/quickstart.md"),
      readRepoFile("docs/codex.md"),
      readRepoFile(".codex/workspace-bootstrap.zsh"),
    ])

    expect(readme).toContain("docs/adaptive-workspace.md")
    expect(readme).toContain(
      "`agent-workspace/` is Fleet Pi's durable adaptive layer"
    )
    expect(quickstart).toContain(
      "`agent-workspace/` is the canonical durable adaptive state"
    )
    expect(codex).toContain("bootstrap-only")
    expect(codex).toContain("`agent-workspace/`")
    expect(bootstrap).toContain("pnpm install --frozen-lockfile")
    expect(bootstrap).not.toContain("pnpm dev")
  })
})
