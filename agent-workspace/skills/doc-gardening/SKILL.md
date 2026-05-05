# Doc Gardening Skill

## When to use it

Use this skill when agent-facing docs, memory, or workspace notes feel stale,
duplicated, contradictory, noisy, or hard to navigate.

## What to detect

- stale notes that no longer match the repo
- duplicate facts split across multiple files
- contradictions between policy, memory, and current implementation
- overly broad claims that should be narrowed or qualified
- unlinked or orphaned memory with no clear entry point
- raw logs that should be summarized or deleted instead of preserved

## Procedure

1. Start from `agent-workspace/index.md` and the most likely affected area.
2. Compare the note against the current repository state.
3. Collapse duplicates and replace vague claims with smaller grounded ones.
4. Remove or summarize raw noise that does not deserve durable storage.
5. Leave links or cross-references so the cleaned note is easier to find next
   time.

## Quality checklist

- The workspace became easier to navigate.
- Durable notes still point at real repository evidence.
- Contradictions were resolved or clearly called out.
- No important context was deleted without being synthesized elsewhere.
- The resulting diff is reviewable and justified.
