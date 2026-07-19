# Plan: Upgrade Pi SDK from 0.80.3 → 0.80.10

## Goal

Upgrade `@earendil-works/pi-coding-agent` from `0.80.3` to `0.80.10` with minimal
breakage, handling breaking changes in `AuthStorage` removal and `ModelRegistry`
API changes introduced in 0.80.8.

---

## 1. Scope & Inventory

### 1.1 Files that import from pi packages

| File                                                     | Imports                                                              | Risk                                                                   |
| -------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/lib/pi/runtime/session-factory.ts`                  | `createAgentSessionServices`, `getAgentDir`, `AgentSessionServices`  | **High** — uses `services.authStorage`                                 |
| `src/lib/pi/runtime/provider-catalog.ts`                 | `AgentSessionServices`                                               | **High** — uses `services.authStorage`                                 |
| `src/lib/pi/runtime/openai-chat-completions-provider.ts` | `AgentSessionServices`, `ProviderConfig`                             | **Medium** — calls `modelRegistry.registerProvider/unregisterProvider` |
| `src/lib/pi/runtime/model-catalog.ts`                    | `AgentSessionRuntime`, `AgentSessionServices`, `Model`               | **Low** — uses `modelRegistry.getAvailable/getAll/find`                |
| `src/lib/pi/runtime/diagnostics.ts`                      | `AgentSessionServices`                                               | **Low** — uses `modelRegistry.getError()`                              |
| `src/lib/pi/runtime/settings-bridge.ts`                  | `AgentSessionServices`                                               | **Low** — uses `settingsManager.*` only                                |
| `src/lib/pi/runtime/durable-project-settings.ts`         | `AgentSessionServices`                                               | **Low** — uses `settingsManager.*` and `resourceLoader.reload()`       |
| `src/lib/pi/runtime/apply-project-settings.ts`           | `AgentSessionServices`, settings types                               | **Low** — uses `settingsManager.*` only                                |
| `src/lib/pi/server-runtime.ts`                           | `createAgentSessionFromServices`, `createAgentSessionRuntime`, types | **Low** — core session lifecycle unchanged                             |
| `src/lib/pi/server-shared.ts`                            | `AgentSessionServices`                                               | **Low** — barrel re-exports only                                       |
| `src/lib/pi/server-sessions.ts`                          | `SessionManager`                                                     | **Low** — object lifecycle unchanged                                   |
| `src/lib/pi/plan-mode.ts`                                | `AssistantMessage`, `TextContent` from pi-ai                         | **Low** — types only                                                   |
| `src/lib/pi/exclude-stock-daytona-pi.ts`                 | `LoadExtensionsResult`                                               | **Low** — type only                                                    |
| `src/lib/pi/runtime/resource-catalog.ts`                 | `PromptTemplate`, `Skill`                                            | **Low** — types only                                                   |
| `src/lib/db/pi-session-mirror.ts`                        | Various chat types                                                   | **Low**                                                                |
| `src/lib/daytona/sandbox-operations.ts`                  | Various                                                              | **Low**                                                                |

### 1.2 Test files involved

| File                                         | What it mocks                                                 |
| -------------------------------------------- | ------------------------------------------------------------- |
| `runtime/__tests__/session-factory.test.ts`  | `authStorage`, `modelRegistry`                                |
| `runtime/__tests__/provider-catalog.test.ts` | `authStorage`                                                 |
| `server-runtime.test.ts`                     | `createAgentSessionFromServices`, `createAgentSessionRuntime` |
| `server-shared.test.ts`                      | `createAgentSessionServices`                                  |

---

## 2. Step-by-step Migration

### Step A: Upgrade dependency (single commit start)

```bash
pnpm install @earendil-works/pi-coding-agent@latest
```

Then run `pnpm typecheck` and `pnpm test` to see what breaks. The plan below
predicts the breakage — follow the component fixes in order.

---

### Step B: Migrate `services.authStorage` → `readStoredCredential` / CredentialStore

**Why**: 0.80.8 removed `AuthStorage` from public exports. The `services.authStorage`
property on `AgentSessionServices` may be gone or typed differently.

**What to do**:

#### B1. `session-factory.ts` — runtime key injection

Current code (lines 92-102):

```ts
const authStorage = services.authStorage as {
  setRuntimeApiKey: (providerId: string, apiKey: string) => void
  removeRuntimeApiKey?: (providerId: string) => void
}

for (const providerId of LLM_PROVIDER_ENV_SCRUB_IDS) {
  const apiKey = configured.get(providerId)
  if (apiKey) {
    authStorage.setRuntimeApiKey(providerId, apiKey)
  } else {
    authStorage.removeRuntimeApiKey?.(providerId)
  }
}
```

**Strategy**: Check whether `services.authStorage` still exists as a runtime
property but is just untyped, or was fully removed. If it still exists:

1. Import `readStoredCredential` from `@earendil-works/pi-coding-agent` if available (new export from 0.80.8)
2. Keep the cast pattern but define a local interface to avoid relying on the removed export
3. If `authStorage` is gone entirely, route credentials through the new `ModelRuntime`:
   - Create a `ModelRuntime` instance with a custom pi-ai `CredentialStore`
   - Use `modelRuntime.getAuth(providerId)` for runtime key resolution instead

**Fallback**: If the new API is complex, define a thin wrapper:

```ts
type RuntimeAuthStore = {
  setRuntimeApiKey: (providerId: string, apiKey: string) => void
  removeRuntimeApiKey?: (providerId: string) => void
  getRuntimeApiKey?: (providerId: string) => string | undefined
}
// and cast (services.authStorage as unknown as RuntimeAuthStore)
```

This works if the property still exists at runtime even if the type is gone.

#### B2. `provider-catalog.ts` — provider config check

Same approach for `getRuntimeApiKey` (line 108).

---

### Step C: Update `modelRegistry.registerProvider` / `unregisterProvider` call

**File**: `src/lib/pi/runtime/openai-chat-completions-provider.ts`

**Why**: 0.80.8 introduced `ModelRuntime` which may affect how dynamic providers
are registered. The old `registerProvider` method may be deprecated.

**Strategy**:

1. Try the existing call — it may still work (extension-facing ModelRegistry API was kept)
2. If `registerProvider` is gone, use the pi-ai `Models` factory to register:
   ```ts
   import { createModels } from "@earendil-works/pi-ai"
   const models = createModels(services.modelRuntime ?? /* fallback */)
   models.registerProvider(providerId, providerConfig)
   ```

**Check**: Look for `registerProvider` on services after the upgrade to confirm.

---

### Step D: Add `"max"` thinking level

**Two files** need updating:

#### D1. `src/lib/pi/runtime/model-catalog.ts`

Add `"max"` to `THINKING_LEVELS`:

```ts
const THINKING_LEVELS = new Set<ChatThinkingLevel>([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
])
```

Also update the `ChatThinkingLevel` type in `pi-protocol` if it's a union.

#### D2. `src/lib/pi/runtime/apply-project-settings.ts`

The hardcoded array at line ~56:

```ts
["off", "minimal", "low", "medium", "high", "xhigh"].includes(...)
```

Add `"max"`.

---

### Step E: Verify `models.json` compatibility (0.80.7 change)

**Why**: 0.80.7 removed the `compat.sendSessionIdHeader` flag from `models.json`
in favor of `compat.sessionAffinityFormat`.

**Check**: Fleet Pi doesn't ship a `models.json` directly, but verify:

1. No `sendSessionIdHeader` references in `.pi/` or project settings
2. Fleet Pi's default settings (in `fleet-default-project-settings.ts`) don't include it

---

### Step F: Update test mocks

#### F1. `runtime/__tests__/session-factory.test.ts`

Currently mocks:

```ts
authStorage: { setRuntimeApiKey: vi.fn() },
modelRegistry: {
  unregisterProvider: vi.fn(),
  registerProvider: vi.fn(),
},
```

Update to match the new auth interface. If using the thin wrapper approach (B1
fallback), mock accordingly. If `modelRegistry.registerProvider` is deprecated,
test should verify credentials are stored through the new path instead.

#### F2. `runtime/__tests__/provider-catalog.test.ts`

Mock `getRuntimeApiKey` on authStorage — same migration as F1.

#### F3. `server-runtime.test.ts` / `server-shared.test.ts`

These mock `createAgentSessionServices` and `createAgentSessionRuntime`. They
shouldn't need changes unless the mock return shapes changed. Run tests to
verify.

---

### Step G: Finalize and validate

1. `pnpm typecheck` — should pass cleanly
2. `pnpm test` — all existing tests green
3. `pnpm lint` — no new warnings
4. Manual verification:
   - Start a chat session with a local provider (Google Gemini)
   - Switch models, verify model list loads
   - Save provider credentials, verify they persist
   - Start a chat with OpenAI Chat Completions (if configured)

---

## 3. Rollback Strategy

If the upgrade breaks chat:

1. `git checkout .` to revert all code changes
2. `pnpm install @earendil-works/pi-coding-agent@0.80.3` to roll back the SDK
3. Record what broke in `agent-workspace/memory/project/known-issues.md`

---

## 4. Post-migration improvements (optional, not blocking)

| Feature                                         | Benefit                           | Effort  |
| ----------------------------------------------- | --------------------------------- | ------- |
| Expose `outputPad` setting in Settings UI       | User-configurable spacing         | Small   |
| Expose `max` thinking in ChatThinkingLevel type | Users can select max effort       | Trivial |
| Add `showCacheMissNotices` to settings bridge   | Debug cache behavior              | Small   |
| Adopt `agent_settled` in runtime                | Smoother follow-up queue handling | Medium  |

---

## 5. Risk Assessment

| Risk                                                                | Likelihood                                     | Impact                           | Mitigation                                                     |
| ------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------- | -------------------------------------------------------------- |
| `authStorage` property fully removed at runtime                     | Low (may still exist as undocumented property) | **High** — BYOK auth breaks      | Check with typecheck first; fallback to `readStoredCredential` |
| `ModelRegistry.registerProvider` removed                            | Low                                            | Medium — OCC provider won't load | Migrate to pi-ai `Models` factory                              |
| `ModelRegistry.refresh()` async breaks something in resource reload | Low                                            | Medium                           | Already awaited in caller                                      |
| Settings bridge methods renamed                                     | Low                                            | Low                              | Typecheck catches it                                           |

## 6. Commit Strategy

| Commit | Scope                                                 | Changes                                             |
| ------ | ----------------------------------------------------- | --------------------------------------------------- |
| 1      | `pnpm install @earendil-works/pi-coding-agent@latest` | Lockfile + package.json                             |
| 2      | Migrate `authStorage` to new API                      | `session-factory.ts`, `provider-catalog.ts` + tests |
| 3      | Fix `modelRegistry` calls if needed                   | `openai-chat-completions-provider.ts`               |
| 4      | Add `"max"` thinking level                            | `model-catalog.ts`, `apply-project-settings.ts`     |
| 5      | Final validation & test fixes                         | All remaining test updates                          |

---

## Appendix: Changelog summary (0.80.3 → 0.80.10)

| Version | Key change                                                             | Fleet Pi impact                     |
| ------- | ---------------------------------------------------------------------- | ----------------------------------- |
| 0.80.4  | `max` thinking level                                                   | **Add to list**                     |
| 0.80.4  | Extension lifecycle hooks (`agent_settled`, `before_provider_headers`) | None                                |
| 0.80.4  | Vercel AI Gateway attribution removed                                  | None                                |
| 0.80.7  | `sendSessionIdHeader` → `sessionAffinityFormat`                        | **Verify** no `models.json` uses it |
| 0.80.8  | `AuthStorage` removed, `ModelRuntime` replaces auth/model options      | **CRITICAL**                        |
| 0.80.8  | `ModelRegistry.refresh()` became async                                 | **Verify** callers                  |
| 0.80.9  | Kimi K3, deferred tool loading                                         | None                                |
| 0.80.10 | Kimi Coding thinking fix                                               | None                                |
