import { describe, expect, it } from "vitest"
import {
  agentWorkspaceBashBlock,
  evaluatePlanCommand,
  listMutatingCommandTargets,
} from "../command-policy"

describe("command policy", () => {
  it("allows local read-only inspection commands", () => {
    expect(evaluatePlanCommand("rg plan-mode apps/web").allowed).toBe(true)
    expect(evaluatePlanCommand("sed -n '1,20p' package.json").allowed).toBe(
      true
    )
    expect(
      evaluatePlanCommand("git diff -- apps/web/src/routes/index.tsx").allowed
    ).toBe(true)
    expect(evaluatePlanCommand("git branch -a").allowed).toBe(true)
    expect(evaluatePlanCommand("git branch --show-current").allowed).toBe(true)
    expect(evaluatePlanCommand("git remote -v").allowed).toBe(true)
    expect(evaluatePlanCommand("git remote get-url origin").allowed).toBe(true)
    expect(evaluatePlanCommand("env").allowed).toBe(true)
    expect(evaluatePlanCommand("printenv HOME").allowed).toBe(true)
    expect(evaluatePlanCommand("pnpm list --filter web").allowed).toBe(true)
  })

  it("allows pipelines made only of read-only commands", () => {
    expect(evaluatePlanCommand("rg workspace apps | head -20").allowed).toBe(
      true
    )
  })

  it("blocks file mutation and redirects", () => {
    expect(evaluatePlanCommand("rm -rf apps/web").allowed).toBe(false)
    expect(evaluatePlanCommand("echo hi > file.txt").allowed).toBe(false)
    expect(evaluatePlanCommand("sed -i 's/a/b/' file.txt").allowed).toBe(false)
    expect(evaluatePlanCommand("sed -n -i 's/a/b/p' file.txt").allowed).toBe(
      false
    )
    expect(evaluatePlanCommand("sed -ni 's/a/b/p' file.txt").allowed).toBe(
      false
    )
    expect(
      evaluatePlanCommand("sed -n --in-place 's/a/b/p' file.txt").allowed
    ).toBe(false)
    expect(evaluatePlanCommand("find . -delete").allowed).toBe(false)
    expect(evaluatePlanCommand("find . -execdir rm {} +").allowed).toBe(false)
    expect(evaluatePlanCommand("find . -ok rm {} \\;").allowed).toBe(false)
    expect(evaluatePlanCommand("find . -fprint out.txt").allowed).toBe(false)
  })

  it("blocks env command execution bypasses", () => {
    expect(evaluatePlanCommand("env rm -rf apps/web").allowed).toBe(false)
    expect(evaluatePlanCommand("env FOO=bar sh -c 'id'").allowed).toBe(false)
  })

  it("blocks shell execution and substitution", () => {
    expect(evaluatePlanCommand("bash -c 'cat package.json'").allowed).toBe(
      false
    )
    expect(evaluatePlanCommand("node -e 'console.log(1)'").allowed).toBe(false)
    expect(evaluatePlanCommand("cat $(pwd)/package.json").allowed).toBe(false)
    expect(evaluatePlanCommand("cat `pwd`/package.json").allowed).toBe(false)
  })

  it("blocks newline and carriage-return command termination", () => {
    expect(evaluatePlanCommand("cat package.json\nrm marker").allowed).toBe(
      false
    )
    expect(evaluatePlanCommand("cat package.json\r\nrm marker").allowed).toBe(
      false
    )
    expect(evaluatePlanCommand("cat\npackage.json").allowed).toBe(false)
  })

  it("blocks network access", () => {
    expect(evaluatePlanCommand("curl https://example.com").allowed).toBe(false)
    expect(
      evaluatePlanCommand("wget -O - http://169.254.169.254").allowed
    ).toBe(false)
    expect(evaluatePlanCommand("ssh localhost").allowed).toBe(false)
  })

  it("blocks package-manager and git mutations", () => {
    expect(evaluatePlanCommand("pnpm install").allowed).toBe(false)
    expect(evaluatePlanCommand("npm publish").allowed).toBe(false)
    expect(evaluatePlanCommand("git commit -m test").allowed).toBe(false)
    expect(evaluatePlanCommand("git reset --hard").allowed).toBe(false)
    expect(evaluatePlanCommand("git branch -D main").allowed).toBe(false)
    expect(evaluatePlanCommand("git branch -m old new").allowed).toBe(false)
    expect(evaluatePlanCommand("git branch new-feature").allowed).toBe(false)
    expect(
      evaluatePlanCommand("git remote add evil https://evil.example").allowed
    ).toBe(false)
    expect(
      evaluatePlanCommand("git remote set-url origin https://evil.example")
        .allowed
    ).toBe(false)
    expect(
      evaluatePlanCommand("git diff --output=/tmp/pwned HEAD").allowed
    ).toBe(false)
    expect(evaluatePlanCommand("git log --output /tmp/pwned").allowed).toBe(
      false
    )
  })

  it("extracts mutating targets across ||, newlines, env wrappers, sed -ni, and find -execdir", () => {
    expect(
      listMutatingCommandTargets(
        "false || rm -rf agent-workspace/instructions/rules.md"
      )
    ).toContain("agent-workspace/instructions/rules.md")
    expect(
      listMutatingCommandTargets(
        "echo ok\nrm -rf agent-workspace/instructions/rules.md"
      )
    ).toContain("agent-workspace/instructions/rules.md")
    expect(
      listMutatingCommandTargets(
        "env FOO=1 rm -rf agent-workspace/instructions/rules.md"
      )
    ).toContain("agent-workspace/instructions/rules.md")
    expect(
      agentWorkspaceBashBlock(
        "sed -n -i 's/a/b/' agent-workspace/instructions/rules.md"
      )
    ).toContain("without a rationale")
    expect(
      agentWorkspaceBashBlock(
        "find agent-workspace/instructions/rules.md -execdir rm {} +"
      )
    ).toContain("without a rationale")
  })
})
