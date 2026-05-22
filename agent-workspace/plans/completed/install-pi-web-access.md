# Plan: Install pi-web-access

**Status**: Ready to execute  
**Package**: `npm:pi-web-access` v0.10.7  
**Source**: https://pi.dev/packages/pi-web-access  
**Scope**: Project (`.pi/settings.json`)

---

## What this adds

| Capability           | Details                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `web_search`         | Exa / Perplexity / Gemini search with smart fallback chain                                      |
| `fetch_content`      | URL fetch, GitHub repo clone, YouTube video understanding, PDF extraction, local video analysis |
| `code_search`        | Code + API reference search via Exa MCP — no key needed                                         |
| `get_search_content` | Retrieve stored search results from current session                                             |
| `librarian` skill    | Evidence-backed OSS library research workflow                                                   |
| `/websearch` command | Interactive search curator with summary-review                                                  |
| `/curator` command   | Toggle/configure curator workflow at runtime                                                    |
| `/search` command    | Browse stored session search results                                                            |

---

## Steps

### 1. Add to `.pi/settings.json` packages array

Add `"npm:pi-web-access"` to the `packages` list. Pi resolves and installs it to `.pi/npm/node_modules/pi-web-access/` on next startup.

```diff
 "packages": [
   "npm:pi-autoresearch",
   "npm:pi-skill-palette",
-  "npm:pi-autocontext"
+  "npm:pi-autocontext",
+  "npm:pi-web-access"
 ],
```

### 2. Update project memory

Record the decision to add web access tooling in `agent-workspace/memory/project/decisions.md`.

### 3. Verify (post-restart)

- `pi-web-access` appears in `.pi/npm/node_modules/pi-web-access/`
- `web_search` and `fetch_content` are callable tools in a new Pi session
- Resources surface appears in `/api/chat/resources`

---

## Optional post-install configuration

Create `~/.pi/web-search.json` to enable more providers:

```json
{
  "exaApiKey": "exa-...",
  "perplexityApiKey": "pplx-...",
  "geminiApiKey": "AIza..."
}
```

Zero-config works without this (Exa MCP handles search out of the box).

Optional binaries for video frame extraction:

```bash
brew install ffmpeg yt-dlp
```

---

## Decision points resolved

| Question              | Decision                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| Project vs user scope | **Project** — matches existing `pi-autoresearch`, `pi-skill-palette`, `pi-autocontext` pattern             |
| Stage vs activate     | **Activate** — npm packages in `settings.json` are loaded directly; staging is for local extension bundles |
| API keys              | **Zero-config for now** — can be added to `~/.pi/web-search.json` post-install                             |
| Browser cookie opt-in | **Off by default** — user can enable via `allowBrowserCookies: true` if needed                             |

---

## Files changed

- `.pi/settings.json` — add `"npm:pi-web-access"` to `packages`
- `agent-workspace/memory/project/decisions.md` — record the addition
