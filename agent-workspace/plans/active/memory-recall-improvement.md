# Memory Recall Improvement

**Status:** In progress  
**Mode:** Harness  
**Started:** 2026-05-22

---

## Goal

Improve Fleet Pi's project-memory recall across three dimensions:

1. **Enrich** — canonical memory files contain substantive, accurate, durable facts
2. **Retrieve** — startup context snippets are selected by relevance to the current prompt, not position
3. **Evaluate** — a repeatable rubric with `pi-autocontext` detects regressions

---

## Success criteria

- All five canonical memory files (`architecture`, `decisions`, `preferences`,
  `open-questions`, `known-issues`) contain substantive content with at least 4 sections
- `extractMemorySnippets` no longer caps at 4 bullets — all bullet items are extracted
- Startup context snippets for a relevant prompt are more topically focused than the
  static baseline
- `agent-workspace/evals/memory-recall.md` rubric exists with 4 scored dimensions
  and a documented 0.75 pass threshold
- `autocontext_judge` can be invoked against any agent response to produce a 0–1 recall score

---

## Steps

| #   | Step                                                                                     | Status  |
| --- | ---------------------------------------------------------------------------------------- | ------- |
| 1   | Audit canonical memory content — identify gaps across all 5 files                        | ✅ Done |
| 2   | Enrich canonical memory files — fill 9 identified gaps                                   | ✅ Done |
| 3   | Design prompt-aware retrieval — spec the scoring and integration points                  | ✅ Done |
| 4   | Implement retrieval in `workspace-memory-index.ts` and `workspace-context.ts`            | ✅ Done |
| 5   | Write `memory-recall.md` eval rubric — 4 dimensions, pass threshold, regression triggers | ✅ Done |
| 6   | Wire eval to `pi-autocontext` — document scenario spec as runnable artifact              | ✅ Done |
| 7   | Create active plan file and promote backlog candidate                                    | ✅ Done |

---

## Artifacts produced

| Artifact                     | Path                                                               |
| ---------------------------- | ------------------------------------------------------------------ |
| Enriched architecture notes  | `agent-workspace/memory/project/architecture.md`                   |
| Enriched decisions (2 new)   | `agent-workspace/memory/project/decisions.md`                      |
| Enriched preferences (2 new) | `agent-workspace/memory/project/preferences.md`                    |
| Updated open-questions       | `agent-workspace/memory/project/open-questions.md`                 |
| Updated known-issues (1 new) | `agent-workspace/memory/project/known-issues.md`                   |
| Retrieval engine             | `.pi/extensions/lib/workspace-memory-index.ts`                     |
| Updated context extension    | `.pi/extensions/workspace-context.ts`                              |
| Eval rubric                  | `agent-workspace/evals/memory-recall.md`                           |
| Scenario spec                | `agent-workspace/artifacts/reports/memory-recall-scenario-spec.md` |

---

## Key implementation notes

### `workspace-memory-index.ts` changes

- Removed `.slice(0, 4)` cap from `extractMemorySnippets` — now extracts ALL bullet items
- Added `extractPromptTerms(prompt)` — tokenizes, strips stop words, deduplicates
- Added `selectScoredSnippets(files, promptText, limit=10)` — scores all snippets globally
  by prompt term count, stable-sorts descending, deduplicates, returns top-N formatted lines
- `formatProjectMemoryForStartupContext` now accepts optional `promptText` parameter;
  when provided, uses `selectScoredSnippets`; otherwise falls back to static top-3-per-file

### `workspace-context.ts` changes

- Session-keyed `sessionSnippetPools: Map<string, Array<ProjectMemoryFile>>` pre-loads
  the full snippet set at `before_agent_start`
- `context` event handler now accepts `(event, ctx)` and:
  1. Finds the last user message text from `event.messages`
  2. Calls `selectScoredSnippets` against the pre-loaded pool (synchronous)
  3. Replaces the workspace context message content via `replaceSnippetSection`
  4. Falls back to existing dedup-only behavior when no pool or no prompt text

### Known limitation

- `pi-autocontext` package has a runtime module error (`Cannot find module './parsers/any.js'`)
  that prevents formal scenario registration. Use `autocontext_judge` directly with the
  rubric from `memory-recall.md`. Log a follow-up in known-issues when resolved.

---

## Follow-up backlog

- Resolve `pi-autocontext` module error and register `memory-recall` as a named scenario
- Add `memory-recall` to the regression gate run after workspace-context changes
- Consider adding section-level scoring: weight snippets by which section heading they fall under
- Evaluate whether `selectScoredSnippets` limit=10 is the right default or should be
  configurable via `.pi/settings.json`
