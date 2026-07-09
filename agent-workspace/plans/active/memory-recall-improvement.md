# Memory Recall Improvement

**Status:** In progress  
**Mode:** Harness / Agent  
**Started:** 2026-05-22  
**Last Updated:** 2026-07-07

---

## Goal

Improve Fleet Pi's project-memory recall across three dimensions:

1. **Enrich** — canonical memory files contain substantive, accurate, durable facts
2. **Retrieve** — startup context snippets are selected by relevance to the current prompt, not position
3. **Evaluate** — a repeatable rubric with `pi-autocontext` detects regressions

---

## Success criteria

- All five canonical memory files (`architecture`, `decisions`, `preferences`,
  `open-questions`, `known-issues`) contain substantive content with at least 4 sections (✅ Done)
- `extractMemorySnippets` no longer caps at 4 bullets — all bullet items are extracted (✅ Done & Active)
- Startup context snippets for a relevant prompt are more topically focused than the
  static baseline (✅ Done & Active)
- `agent-workspace/evals/memory-recall.md` rubric exists with 4 scored dimensions
  and a documented 0.75 pass threshold (✅ Done)
- `autocontext_judge` can be invoked against any agent response to produce a 0–1 recall score (Stated workaround - Done)

---

## Steps

| #   | Step                                                                                     | Status     |
| --- | ---------------------------------------------------------------------------------------- | ---------- |
| 1   | Audit canonical memory content — identify gaps across all 5 files                        | ✅ Done    |
| 2   | Enrich canonical memory files — fill 9 identified gaps                                   | ✅ Done    |
| 3   | Design prompt-aware retrieval — spec the scoring and integration points                  | ✅ Done    |
| 4   | Implement retrieval in `workspace-memory-index.ts` and `workspace-context.ts`            | ✅ Done    |
| 5   | Write `memory-recall.md` eval rubric — 4 dimensions, pass threshold, regression triggers | ✅ Done    |
| 6   | Wire eval to `pi-autocontext` — document scenario spec as runnable artifact              | ❌ Blocked |
| 7   | Create active plan file and promote backlog candidate                                    | ✅ Done    |

_Note on Step 4:_ Fully implemented and applied to `.pi/extensions/lib/workspace-memory-index.ts` and `.pi/extensions/workspace-context.ts` during an Agent-mode write session! Prompt-aware dynamic context is now active for all user turns.
_Note on Step 6:_ Blocked by unhandled `Cannot find module './parsers/any.js'` error within the `pi-autocontext` zod-to-json-schema dependency. Direct manual scoring with `agent-workspace/evals/memory-recall.md` is the current active workaround.

---

## Artifacts produced

| Artifact                    | Path                                                               |
| --------------------------- | ------------------------------------------------------------------ |
| Enriched architecture notes | `agent-workspace/memory/project/architecture.md`                   |
| Enriched decisions          | `agent-workspace/memory/project/decisions.md`                      |
| Enriched preferences        | `agent-workspace/memory/project/preferences.md`                    |
| Updated open-questions      | `agent-workspace/memory/project/open-questions.md`                 |
| Updated known-issues        | `agent-workspace/memory/project/known-issues.md`                   |
| Active Retrieval engine     | `.pi/extensions/lib/workspace-memory-index.ts`                     |
| Active Context extension    | `.pi/extensions/workspace-context.ts`                              |
| Eval rubric                 | `agent-workspace/evals/memory-recall.md`                           |
| Scenario spec               | `agent-workspace/artifacts/reports/memory-recall-scenario-spec.md` |

The temporary scratch patch copies used during the earlier design phase were retired once the live `.pi/extensions/*` implementation and regression tests became the source of truth.

---

## Key implementation notes

### `workspace-memory-index.ts` changes (Active)

- Removed `.slice(0, 4)` cap from `extractMemorySnippets` — now extracts ALL bullet items
- Added `extractPromptTerms(prompt)` — tokenizes, strips stop words, deduplicates
- Added `selectScoredSnippets(files, promptText, limit=10)` — scores all snippets globally
  by prompt term count, stable-sorts descending, deduplicates, returns top-N formatted lines
- `formatProjectMemoryForStartupContext` now accepts optional `promptText` parameter;
  when provided, uses `selectScoredSnippets`; otherwise falls back to static top-3-per-file

### `workspace-context.ts` changes (Active)

- `context` event handler now:
  1. Finds the last user message text from `event.messages`
  2. Invokes `selectScoredSnippets` against the fresh memory index
  3. Updates the workspace context message content in-place with scored snippets
  4. Keeps startup and runtime context injection fully consistent

---

## Follow-up backlog

- Resolve `pi-autocontext` module error and register `memory-recall` as a named scenario
- Add `memory-recall` to the regression gate run after workspace-context changes
- Consider adding section-level scoring: weight snippets by which section heading they fall under
- Evaluate whether `selectScoredSnippets` limit=10 is the right default or should be
  configurable via `.pi/settings.json`
