import { afterEach, describe, expect, it, vi } from "vitest"
import {
  isInRequestScope,
  requestScoped,
  runInRequestScope,
} from "../request-scope"

const KEY = Symbol("test-resource")

describe("request scope", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("is a no-op outside Cloudflare Workers (Node keeps singletons)", () => {
    runInRequestScope(() => {
      expect(isInRequestScope()).toBe(false)
      expect(requestScoped(KEY, () => ({}))).toBeUndefined()
    })
  })

  it("hands out one instance per Workers request", async () => {
    vi.stubGlobal("navigator", { userAgent: "Cloudflare-Workers" })
    let created = 0
    const create = () => ({ id: ++created })

    const [a1, a2] = await runInRequestScope(async () => {
      const first = requestScoped(KEY, create)
      await Promise.resolve()
      return [first, requestScoped(KEY, create)]
    })
    const b = runInRequestScope(() => requestScoped(KEY, create))

    expect(a1).toBe(a2)
    expect(b).not.toBe(a1)
    expect(created).toBe(2)
    expect(requestScoped(KEY, create)).toBeUndefined()
  })
})
