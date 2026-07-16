# Providers settings refinement

## Scope

Settings dialog → **Providers** tab (`ProviderCredentialsSection`).

## Changes

### 1. Active-only list

- Main list shows only providers with `isConfigured === true`.
- Remove All / Active / Missing tabs.
- Search filters the active list only.
- Empty state: "No providers configured" + **Add provider** button.

### 2. Add provider picker

- **Add provider** opens a picker of unconfigured `CREDENTIAL_UI_PROVIDERS`.
- Selecting a provider opens the inline editor (same expansion pattern as Update).
- Save persists credentials and the provider appears in the active list.

### 3. OpenAI Chat Completions (separate provider)

- Catalog id: `openai-chat-completions`
- Env vars: `OPENAI_CHAT_COMPLETIONS_API_KEY`, `OPENAI_CHAT_COMPLETIONS_BASE_URL` (infra companion id `openai-chat-completions-base-url`)
- Single UI row with API key + base URL fields when editing.
- Runtime registers via `ModelRegistry.registerProvider` with `openai-completions` API and models from `GET {baseUrl}/models`.

**Follow-up (not in original scope):** Model ID is required in addition to key + base URL. See [`llm-models-and-openai-completions-model-id.md`](llm-models-and-openai-completions-model-id.md) for companion id `openai-chat-completions-model` → `OPENAI_CHAT_COMPLETIONS_MODEL`, UI third field, and runtime fallback when `/models` is empty.

### 4. UI audit fixes

- Inline expansion via `RowSurface` continuation (no nested card).
- `SettingsPane` owns title/description inside `ProviderCredentialsSection`.
- One Cancel (row trailing); footer Save only.

### 5. Layout

- One `SettingsPane` group: **API credentials** (search, active list, Add provider).

## Validation

- Only configured providers visible by default.
- Add picker lists only unconfigured providers.
- OpenAI Chat Completions saves key + base URL and registers models after hot reload.
- `pnpm --filter @workspace/hax-design typecheck` passes.
