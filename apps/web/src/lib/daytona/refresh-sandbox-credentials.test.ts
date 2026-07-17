import { beforeEach, describe, expect, it, vi } from "vitest"

import { resolveDaytonaRuntimeApiKey } from "../pi/runtime/user-provider-secrets"
import { refreshSandboxProviderCredentials } from "./refresh-sandbox-credentials"
import {
  getCachedUserSandbox,
  recreateUserSandboxForSecrets,
} from "./user-sandbox"
import {
  buildPlaintextSandboxCredentials,
  loadConfiguredProviderSecrets,
} from "./sandbox-provider-secrets"
import { fingerprintDaytonaSecretsConfig } from "./sync-daytona-secrets"
import { ensureUserCredentials } from "./sandbox-prepare"

vi.mock("./user-sandbox", () => ({
  getCachedUserSandbox: vi.fn(),
  recreateUserSandboxForSecrets: vi.fn(),
}))

vi.mock("./sandbox-provider-secrets", () => ({
  loadConfiguredProviderSecrets: vi.fn(),
  buildPlaintextSandboxCredentials: vi.fn(),
}))

vi.mock("./sync-daytona-secrets", () => ({
  fingerprintDaytonaSecretsConfig: vi.fn(),
}))

vi.mock("./sandbox-prepare", () => ({
  clearSandboxAuthFingerprint: vi.fn(),
  ensureUserCredentials: vi.fn(),
}))

vi.mock("../pi/runtime/user-provider-secrets", () => ({
  resolveDaytonaRuntimeApiKey: vi.fn(),
}))

describe("refreshSandboxProviderCredentials", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("is a no-op when no sandbox is cached", async () => {
    vi.mocked(getCachedUserSandbox).mockReturnValue(undefined)
    await refreshSandboxProviderCredentials("user-1")
    expect(recreateUserSandboxForSecrets).not.toHaveBeenCalled()
  })

  it("recreates when Secrets fingerprint changes", async () => {
    vi.mocked(getCachedUserSandbox).mockReturnValue({
      sandbox: {} as never,
      volumeId: "vol-1",
      volumeName: "fleet-pi-ws-user-1",
      sandboxId: "sb-1",
      userId: "user-1",
      daytonaSecretsFingerprint: "old-fp",
      daytonaSecretEnvVars: ["GEMINI_API_KEY"],
    })
    vi.mocked(resolveDaytonaRuntimeApiKey).mockResolvedValue("daytona-key")
    vi.mocked(loadConfiguredProviderSecrets).mockResolvedValue(
      new Map([["google", "new-key"]])
    )
    vi.mocked(fingerprintDaytonaSecretsConfig).mockReturnValue("new-fp")

    await refreshSandboxProviderCredentials("user-1")

    expect(recreateUserSandboxForSecrets).toHaveBeenCalledWith({
      userId: "user-1",
      apiKey: "daytona-key",
    })
    expect(ensureUserCredentials).not.toHaveBeenCalled()
  })

  it("syncs plaintext auth.json when Secrets fingerprint is unchanged", async () => {
    const sandbox = { id: "sb-1" } as never
    vi.mocked(getCachedUserSandbox).mockReturnValue({
      sandbox,
      volumeId: "vol-1",
      volumeName: "fleet-pi-ws-user-1",
      sandboxId: "sb-1",
      userId: "user-1",
      daytonaSecretsFingerprint: "same-fp",
      daytonaSecretEnvVars: [],
    })
    vi.mocked(resolveDaytonaRuntimeApiKey).mockResolvedValue("daytona-key")
    vi.mocked(loadConfiguredProviderSecrets).mockResolvedValue(new Map())
    vi.mocked(fingerprintDaytonaSecretsConfig).mockReturnValue("same-fp")
    const plaintext = {
      envVars: {},
      authJson: {},
      fingerprint: "auth-fp",
    }
    vi.mocked(buildPlaintextSandboxCredentials).mockReturnValue(plaintext)

    await refreshSandboxProviderCredentials("user-1")

    expect(recreateUserSandboxForSecrets).not.toHaveBeenCalled()
    expect(ensureUserCredentials).toHaveBeenCalledWith(
      sandbox,
      plaintext,
      "user-1"
    )
  })
})
