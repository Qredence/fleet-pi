# Fleet Pi Tool Policy

- Use read and search before write or edit.
- Prefer repository-local context over guesses.
- Run relevant validation commands when the change affects behavior, docs, or
  workflows in a meaningful way.
- Capture important outputs in artifacts or summaries only when they are useful
  for future work.
- Do not over-preserve noisy command output, raw logs, or transient traces when
  a short summary will do.

The goal of tool use is accurate edits and legible follow-through, not maximum
activity.

## Web Access Tools

Three distinct tools for external access — prefer the narrowest one for the task:

| Tool                 | Use for                                                                                                                                   | Mode availability    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `web_fetch`          | Single quick URL read in extension code or one-off lookups when a URL is already known                                                    | Agent, Harness       |
| `web_search`         | Research queries where the best source is unknown; returns synthesized answer with citations via Exa → Perplexity → Gemini fallback chain | Plan, Harness, Agent |
| `code_search`        | Code examples, API references, library docs via Exa MCP; no API key required                                                              | Plan, Harness, Agent |
| `fetch_content`      | Smart URL router: GitHub repos (clones locally), YouTube videos, PDFs, general web pages with fallback extraction                         | Harness, Agent only  |
| `get_search_content` | Retrieve full content from a previous `web_search` or `fetch_content` call in the current session                                         | Plan, Harness, Agent |

`fetch_content` is excluded from Plan mode because it can clone GitHub repos to
`/tmp/pi-github-repos`, which is a side effect inconsistent with Plan mode's
read-only contract.

Prefer `web_search` or `code_search` over `web_fetch` for research tasks in chat
sessions. Use `web_fetch` in extension code or when a single specific URL is
sufficient.
