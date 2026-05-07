import { describe, expect, it } from "vitest"
import { evaluatePlanCommand } from "./command-policy"

describe("command policy", () => {
  it("allows local read-only inspection commands", () => {
    expect(evaluatePlanCommand("rg plan-mode apps/web").allowed).toBe(true)
    expect(evaluatePlanCommand("sed -n '1,20p' package.json").allowed).toBe(
      true
    )
    expect(
      evaluatePlanCommand("git diff -- apps/web/src/routes/index.tsx").allowed
    ).toBe(true)
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
    expect(evaluatePlanCommand("find . -delete").allowed).toBe(false)
  })

  it("blocks shell execution and substitution", () => {
    expect(evaluatePlanCommand("bash -c 'cat package.json'").allowed).toBe(
      false
    )
    expect(evaluatePlanCommand("node -e 'console.log(1)'").allowed).toBe(false)
    expect(evaluatePlanCommand("cat $(pwd)/package.json").allowed).toBe(false)
    expect(evaluatePlanCommand("cat `pwd`/package.json").allowed).toBe(false)
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
  })
})
