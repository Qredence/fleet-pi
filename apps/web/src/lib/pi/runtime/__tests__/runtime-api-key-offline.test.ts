import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ModelRuntime } from "@earendil-works/pi-coding-agent"

// Runs against the real Pi ModelRuntime (not mocked). Pi 1.x removed the
// `allowNetwork` option from setRuntimeApiKey; fleet relies on the built-in
// per-provider sync staying offline (see applyRuntimeAuth in session-factory).
describe("Pi ModelRuntime runtime API keys", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("sets and removes a runtime key without any network request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const modelRuntime = await ModelRuntime.create({
      authPath: join(
        mkdtempSync(join(tmpdir(), "fleet-pi-auth-")),
        "auth.json"
      ),
      modelsPath: null,
    })

    await modelRuntime.setRuntimeApiKey("google", "test-key")
    expect(modelRuntime.getProviderAuthStatus("google")).toMatchObject({
      configured: true,
      source: "runtime",
    })

    await modelRuntime.removeRuntimeApiKey("google")
    expect(modelRuntime.getProviderAuthStatus("google").source).not.toBe(
      "runtime"
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
