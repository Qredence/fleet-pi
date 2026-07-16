# LLM Models UX and OpenAI Chat Completions Model ID

Written against: 8bab2b9

## Evidence chain

- Surface: Settings dialog → LLM Models tab; Settings → Providers → Add/Update OpenAI Chat Completions
- Problem (LLM Models): Long flat Switch list with provider name only in subtitle — hard to scan which models are enabled/disabled across providers; enable/disable affordance lacks grouping and filter context.
- Problem (OpenAI Chat Completions): Provider editor collects API key + base URL only; runtime registers models from `GET {baseUrl}/models` (`openai-chat-completions-provider.ts` L21–53) — many compatible gateways return empty lists, so no models appear in LLM Models to enable.
- Design evidence: AGENTS.md — flat `ItemRow` + Switch for LLM Models, Commit toolbar; `model-defaults-section.tsx` current flat list; `providers-settings-refinement.md` §3 documents key + base URL only (superseded for model id by this plan); user requirement — model id required when adding OpenAI Chat Completions.
- Owner: `model-defaults-section.tsx`, `provider-credentials-section.tsx`, `openai-chat-completions-provider.ts`, `provider-catalog.ts`
- Scope and affected surfaces: Settings LLM Models pane, Providers OpenAI Chat Completions editor (inline + Add overlay), pi-protocol catalog, runtime provider registration, provider metadata
- Uncertainty: Confirm `PATCH /api/chat/providers` accepts a third companion credential id for model — follow existing `openai-chat-completions-base-url` pattern.

## Design decision

**LLM Models:** Keep draft + Commit/Revert and `ItemRow` + `Switch`. Add provider grouping, All/Enabled/Disabled filter, richer subtitles (`provider label · modelId`), and explicit empty states with counts.

**OpenAI Chat Completions:** Require Model ID on Add and Update (with API key + base URL). Persist via companion credential id `openai-chat-completions-model` → env `OPENAI_CHAT_COMPLETIONS_MODEL`. Runtime always registers at least the user-supplied model; merge with `/models` fetch when non-empty.

## Reuse

- `ItemRow`, `Switch`, `SettingsPane`, `SettingsCommitActions` — existing LLM Models stack
- `formatProviderLabel`, `ProviderBrandIcon` — `provider-brand-icon.tsx`
- `isModelEnabled` — `model-patterns.ts`
- Providers inline editor pattern — `provider-credentials-section.tsx` (`InputGroup`, `RowSurface`, Save gate)
- Base URL companion pattern — `OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID` in `provider-catalog.ts`
- Exemplar (list): `provider-credentials-section.tsx` active provider list
- Exemplar (filter): Settings Providers search + segmented intent (implement as compact button group or `DiscreteTabs size="compact"`)

## Changes

1. `packages/hax-design/src/components/fleet-pi/pi/config-panel/sections/model-defaults-section.tsx`
   - Change: Add local state `modelStatusFilter: "all" | "enabled" | "disabled"` with compact control row: **All | Enabled | Disabled** above the search field.
   - Change: Filter `visibleModels` by search AND status filter using `isModelEnabled(model, draft?.enabledModels)`.
   - Change: Group filtered models by `model.provider`; render quiet group header per provider (`text-xs font-medium text-muted-foreground`, provider label via `formatProviderLabel`).
   - Change: ItemRow `subtitle` → `` `${formatProviderLabel(model.provider)} · ${model.modelId}` `` (drop redundant provider-only subtitle).
   - Change: Pane description or filter labels include counts, e.g. `Enable models available in chat. 12 enabled of 48.` or `Enabled (12)` on filter chip.
   - Change: Distinct empty copy: search no match vs Enabled filter with zero enabled vs no models loaded.
   - Preserve: `SettingsCommitActions` Commit/Revert; `onModelToggle` / draft dirty flow unchanged.
   - Verify: Toggle Switch marks pane dirty; Commit persists `enabledModels`; filters compose with search.

2. `packages/pi-protocol/src/provider-catalog.ts`
   - Change: Add catalog entry `id: "openai-chat-completions-model"`, `name: "OpenAI Chat Completions Model"`, `envVarName: "OPENAI_CHAT_COMPLETIONS_MODEL"`.
   - Change: Export `OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID` constant alongside existing OpenAI Chat Completions ids.
   - Change: Ensure credential UI list / infra companion filtering treats model id as non-standalone row (same as base-url companion — not its own Settings list row).
   - Preserve: Existing API key and base URL entries.
   - Verify: Typecheck pi-protocol; catalog tests if present.

3. `packages/hax-design/src/components/fleet-pi/pi/config-panel/shared/provider-metadata.ts`
   - Change: Add placeholder/help for model id field on `openai-chat-completions` (e.g. placeholder `meta/llama-3.1-70b-instruct`, help text explaining gateway model slug).
   - Verify: Metadata resolves for provider id.

4. `packages/hax-design/src/components/fleet-pi/pi/config-panel/sections/provider-credentials-section.tsx`
   - Change: Rename `isDualFieldProvider` → `isOpenAiChatCompletionsProvider` (or extend) to gate **three** fields: API key, base URL, model id.
   - Change: Add `modelId` state; third `InputGroup` with model id input in inline editor and `AddProviderEditorOverlay`.
   - Change: ItemRow subtitle for openai-chat-completions → `API key + base URL + model ID`.
   - Change: `canSave` requires `apiKey`, `baseUrl`, and `modelId` all non-empty for this provider.
   - Change: `handleSave` persists model id via `onUpdateProvider({ providerId: OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID, apiKey: modelId.trim() })` (mirror base-url save pattern L125–138).
   - Change: Add overlay copy: "Enter your API key, base URL, and model ID."
   - Preserve: Inline Cancel on row + footer Save only for active list; Add picker flow.
   - Verify: After save + hot reload, configured provider appears in active list; model id stored in `.env.local`.

5. `apps/web/src/lib/pi/runtime/openai-chat-completions-provider.ts`
   - Change: `resolveOpenAiChatCompletionsConfig` also resolves model id from `OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID` / env `OPENAI_CHAT_COMPLETIONS_MODEL`.
   - Change: `registerOpenAiChatCompletionsProvider` builds `models` array: start with user model id entry (`id` and `name` = model id, `api: "openai-completions"`); append unique ids from `/models` fetch when successful.
   - Change: If model id missing, unregister provider (same as missing key/base URL).
   - Preserve: `normalizeBaseUrl`, existing unregister path.
   - Verify: With only model id + key + base URL (empty `/models`), LLM Models tab shows at least one model for `openai-chat-completions` provider.

6. `apps/web/src/routes/api/chat/providers.ts` (and related secret storage)
   - Change: Accept and persist `openai-chat-completions-model` credential if not already wired generically for companion ids.
   - Verify: PATCH round-trip stores model id; GET providers reflects configured state for main row.

## Scope

- Inherit: Settings LLM Models tab, Providers OpenAI Chat Completions add/edit, chat model picker after hot reload
- Verify: Other providers unchanged; `enabledModels` deny-all semantics preserved
- Exclude: Instant-save on Switch (keep Commit); default provider/model pickers; non-OpenAI provider model id fields

## Validation

- Product: Add OpenAI Chat Completions with key, base URL, and model id → open LLM Models → see model under grouped provider → enable → Commit → model available in chat model picker after reload.
- Interface: LLM Models filters (All/Enabled/Disabled) + search; grouped headers; empty states; OpenAI editor shows three fields on Add and Update.
- System: No nested cards in LLM Models; companion model id not shown as separate Providers row.
- Repository: `pnpm --filter @workspace/pi-protocol typecheck` → pass; `pnpm --filter @workspace/hax-design typecheck` → pass; `pnpm --filter web typecheck` → pass

## Stop conditions

- Stop if API layer cannot store a third companion credential without schema migration — document required migration in plan follow-up before UI ships.

## Design documentation

- After acceptance and validation: Update `design-plans/providers-settings-refinement.md` §3 to note model id requirement and link to this plan; update `AGENTS.md` OpenAI Chat Completions bullet if env var list is documented there.
