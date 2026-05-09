# Fleet Pi Agent Behavior

- Inspect before editing. Read the relevant code, docs, and workspace notes
  before changing behavior.
- Prefer small diffs. Keep edits easy to review and easy to roll back.
- Preserve existing conventions. Match the repo's current architecture, naming,
  and tooling unless the task explicitly changes them.
- Validate changes. Run the smallest relevant checks and record any important
  gaps honestly.
- Summarize durable learnings. If a lesson should survive the session, capture
  it in the appropriate memory or plan file.
- Treat `agent-workspace/` as Fleet Pi's agent home. Skills, tools context,
  memory, plans, evals, artifacts, and Pi extension orientation should be
  discoverable there, even when executable extension code lives under `.pi/`.
- Install runtime resources with `resource_install`. Chat-installed Pi skills,
  prompts, extensions, and package bundles belong under `agent-workspace/pi`;
  extensions and packages require explicit activation and a reload/new session.
- Recall before denying memory. For memory or recall requests, inspect canonical
  project memory first, then search `agent-workspace/memory/project` before
  saying the information is unavailable.
- Use plans for complex work. Multi-step tasks should leave behind a resumable
  execution plan.
- Avoid hiding state in scratch files. Scratch space is temporary and should not
  become the system of record.
- Avoid turning one-off notes into permanent memory without synthesis. Daily
  notes and raw traces should be distilled before they become durable guidance.
- For normal "remember this" requests, update the narrowest canonical project
  memory file rather than creating ad hoc files. Use separate project-memory
  files only when explicitly requested, for temporary harness tests, or for raw
  material that will later be synthesized.

## Installing Runtime Resources

Use `resource_install` for Fleet Pi runtime resources. It preserves the source
content in `agent-workspace/pi`, updates the root `.pi/settings.json`
compatibility bridge when needed, and reports whether a reload/new session is
required. Treat "plugins" as Pi package/resource bundles in v1; do not install
Codex or Claude plugin bundles unless the user asks for a separate artifact.

## Installing Workspace Skills

When adding a skill to `agent-workspace/skills/`, always preserve the source
content exactly — do not summarize, paraphrase, or excerpt it. Copy the full
file verbatim using `workspace_write`. The skill's frontmatter, guidelines,
examples, and any other sections must all be present in the destination file.

Place each skill in its own subdirectory matching the skill name:
`agent-workspace/skills/<skill-name>/SKILL.md`.

## Capability Gaps

If a request requires something you cannot do directly — a missing tool, network
access, an unknown CLI, or content you cannot retrieve — do not improvise silently.

1. Use the `questionnaire` tool to surface the gap.
2. State clearly what is missing and why you cannot proceed without it.
3. List every option you can identify. Examples:
   - Install a Pi skill: `gh skill install <url>` (if the source follows Pi skill format)
   - Fetch via researcher subagent: `subagent { agent: "researcher", task: "fetch and summarize <url>" }`
   - Fetch directly with `web_fetch` if available
   - Ask the user to paste the content directly
4. Wait for the user's choice before taking any action.

Transparency is more valuable than a partial attempt. A clear question with
options unblocks the user faster than a silent failure.
