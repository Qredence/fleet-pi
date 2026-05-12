# Fleet Pi Agent-Workspace Architecture Review

**Date**: 2026-05-12  
**Status**: Comprehensive Review  
**Scope**: agent-workspace/ structure, system guidance, memory, skills, runtime resources, and Pi integration

---

## Executive Summary

Fleet Pi's agent-workspace is well-designed and follows sound principles for a durable, adaptive agent layer. The architecture establishes clear separation between durable memory/skills, temporary scratch, protected system policies, and workspace-native Pi resources.

**Status**: Functional with 1 architecture issue requiring attention.

### Key Strengths

✅ Clear policy boundaries (freely mutable / rationale-required / protected)  
✅ Well-documented identity and behavior guidelines  
✅ 5 specialized workspace skills addressing core agent tasks  
✅ Manifest-driven structure with explicit sections and kinds  
✅ Proper Pi resource routing (workspace-native vs. built-in extensions)  
✅ Memory organization scaffolding with canonical project memory files  
✅ Structured plan tracking (active / completed / abandoned / backlog)

### Issues Requiring Attention

⚠️ **Under-utilization**: Project memory, evals, and research notes are seeded but empty

---

## 1. Directory Structure Assessment

### Current Layout

```
agent-workspace/
├── system/              ← System identity & behavior (6 files)
├── policies/            ← Compatibility stubs pointing to `system/`
├── memory/
│   ├── project/         ← Canonical memory (5 stubs)
│   ├── research/        ← Research distillation (1 stub)
│   └── daily/           ← Temporary daily notes
├── plans/
│   ├── active/          ← Active work plans (.gitkeep)
│   ├── completed/       ← Finished plans (.gitkeep)
│   ├── abandoned/       ← Abandoned plans (.gitkeep)
│   └── backlog.md       ← Candidate plans (stub)
├── skills/              ← 5 workspace skills
├── evals/               ← 4 evaluation definitions
├── artifacts/
│   ├── datasets/
│   ├── diagrams/
│   ├── reports/         ← Review output
│   └── traces/
├── scratch/tmp/         ← Temporary scratch space
├── pi/                  ← Chat-installed Pi resources
│   ├── skills/          ← Empty (awaiting installs)
│   ├── prompts/         ← Empty (awaiting installs)
│   ├── packages/        ← Empty (awaiting installs)
│   └── extensions/      ← 1 enabled extension
├── instructions/        ← Empty (reserved)
├── indexes/             ← Projection directory
├── manifest.json        ← Structure declaration
├── index.md             ← Navigation hub
└── README.md            ← Overview
```

### Assessment

The structure is **well-organized** and follows Pi conventions, but has noted issues below.

---

## 2. Critical Architecture Issues

### Issue 1: Canonical Policy Home

**Problem**: `system/` is the canonical home for policy files, while
`policies/` remains only for compatibility stubs.

| File                         | Location     | Status    |
| ---------------------------- | ------------ | --------- |
| `workspace-policy.md`        | system/      | Canonical |
| `tool-policy.md`             | system/      | Canonical |
| `self-improvement-policy.md` | system/      | Canonical |
| `constraints.md`             | system/      | Canonical |
| `identity.md`                | system/ only | Unique    |
| `behavior.md`                | system/ only | Unique    |

**Root Cause**:

- Historical duplication left both `system/` and `policies/` in the repo
- The current branch aligns manifest, workspace indexing, and documentation to `system/`
- Compatibility stubs remain under `policies/` for older references only

**Impact**:

- Agents should update only `system/` files
- Older references can still resolve through compatibility stubs
- Maintenance now has a single canonical source of truth

**Recommendation**:

- Keep `system/` as the single canonical policy location
- Preserve `policies/` only as redirect stubs for backward compatibility
- Ensure indexing and tests ignore `policies/` as a canonical section

---

### Issue 2: Underutilized Memory Structure ⚠️

**Problem**: Canonical project memory files exist but are seeded stubs only:

| File                               | Lines | Status           |
| ---------------------------------- | ----- | ---------------- |
| `memory/project/architecture.md`   | 9     | Template only    |
| `memory/project/decisions.md`      | 12    | Template only    |
| `memory/project/preferences.md`    | ?     | Template only    |
| `memory/project/open-questions.md` | ?     | Template only    |
| `memory/project/known-issues.md`   | 11    | Template only    |
| `memory/research/index.md`         | 20    | Index + template |

**Impact**:

- No durable learnings have been captured from agent work
- Memory recall requests may fail because files are empty
- Agents cannot benefit from collective session learnings
- Evals and skills are disconnected from memory feedback

**Recommendation**:

- This is **expected and healthy** for a new agent setup
- Populate memory files as work progresses:
  - After significant codebase insights → update `architecture.md`
  - After tradeoff analysis → update `decisions.md`
  - After discovering patterns → update `preferences.md`
  - After hitting rough edges → update `known-issues.md`
- Use `memory/research/` for distilled lessons from multi-session patterns
- Avoid turning raw daily notes into permanent memory without synthesis

---

## 3. Workspace Skills Assessment

### 5 Defined Skills

| Skill               | Location                            | Purpose                            | Status         |
| ------------------- | ----------------------------------- | ---------------------------------- | -------------- |
| `execution-plan`    | `skills/execution-plan/SKILL.md`    | Plan complex work systematically   | ✅ Implemented |
| `codebase-research` | `skills/codebase-research/SKILL.md` | Inspect and understand repository  | ✅ Implemented |
| `memory-synthesis`  | `skills/memory-synthesis/SKILL.md`  | Distill lessons into memory        | ✅ Implemented |
| `doc-gardening`     | `skills/doc-gardening/SKILL.md`     | Maintain and improve documentation | ✅ Implemented |
| `frontend-design`   | `skills/frontend-design/SKILL.md`   | Frontend interface creation        | ✅ Implemented |

**Assessment**: Well-balanced skill set covering core agent workflows.

**Strengths**:

- ✅ Each skill has a SKILL.md with clear structure
- ✅ Complementary functions (research → plan → execute → document → synthesize)
- ✅ Some skills have supplementary files (changelog.md, examples.md, evals.md)

**Gaps Identified**:

- No runtime debugging skill for chat/streaming issues (though `.pi/skills/chat-runtime-debugging` exists at project level)
- No agent-UI integration skill (though `.pi/skills/agent-ui-workflows` exists at project level)

**Recommendation**: Consider symlinked or coordinated skills between `agent-workspace/skills/` and project-level `.pi/skills/` to avoid duplication.

---

## 4. Evaluation Framework Assessment

### 4 Defined Evaluations

| Eval                | File                         | Purpose                             | Status  |
| ------------------- | ---------------------------- | ----------------------------------- | ------- |
| `agentic-coding`    | `evals/agentic-coding.md`    | Quality of agent code work          | Defined |
| `tool-use`          | `evals/tool-use.md`          | Tool selection & execution accuracy | Defined |
| `regression-checks` | `evals/regression-checks.md` | Prevent regressions                 | Defined |
| `memory-quality`    | `evals/memory-quality.md`    | Quality of memory captures          | Defined |

**Assessment**: Good coverage of key agent quality dimensions.

**Strengths**:

- ✅ Defined evals for core agent workflows
- ✅ Protected area (requires rationale to modify)

**Gaps Identified**:

- Evals are defined but may lack active integration with autocontext loop
- No visible recent runs or improvement iterations

**Recommendation**:

- Link evals to active autocontext scenarios
- Consider adding eval for memory recall accuracy
- Document eval rubrics and expected quality thresholds

---

## 5. Pi Runtime Resources Assessment

### Current State

**Workspace-native Pi resources** (`agent-workspace/pi/`):

```
pi/
├── skills/           → EMPTY (awaiting chat-installed resources)
├── prompts/          → EMPTY (awaiting chat-installed resources)
├── packages/         → EMPTY (awaiting chat-installed resources)
└── extensions/
    └── enabled/
        └── web-fetch/index.ts  (1 enabled extension)
```

**Root `.pi/settings.json` configuration**:

```json
{
  "packages": [
    "npm:pi-autoresearch",
    "npm:pi-skill-palette",
    "npm:pi-autocontext"
  ],
  "skills": ["../agent-workspace/pi/skills"],
  "prompts": ["../agent-workspace/pi/prompts"],
  "extensions": [
    "extensions/bedrock-bearer-auth",
    "extensions/resource-install",
    "extensions/vendor/filechanges",
    "extensions/vendor/subagents",
    "../agent-workspace/pi/extensions/enabled"
  ]
}
```

**Assessment**: Well-structured routing, minimal initial state.

**Strengths**:

- ✅ Proper separation: chat-installed resources → workspace home
- ✅ Root `.pi/settings.json` acts as compatibility bridge
- ✅ Pre-configured npm packages (autoresearch, skill-palette, autocontext)
- ✅ Vendor extensions properly isolated

**Expected State**:

- This is **correct for fresh setup**
- Skills/prompts/packages will populate as agents use `resource_install`
- Growth into `agent-workspace/pi/` is normal and healthy

---

## 6. Policy Alignment Assessment

### System Policies Review

**Files checked**:

- ✅ `system/identity.md` — Clear, repo-grounded identity
- ✅ `system/behavior.md` — Comprehensive behavior guidelines with 11 key principles
- ✅ `system/constraints.md` — Core operating constraints
- ✅ `system/tool-policy.md` — Tools by mode (Agent/Plan)
- ✅ `system/workspace-policy.md` — Mutation boundaries and resource routing
- ✅ `system/self-improvement-policy.md` — Learning and iteration patterns

**Assessment**: Policies are mature and well-documented.

**Strengths**:

- ✅ Clear identity as repo-local implementation partner
- ✅ Specific behavior prescriptions (inspect before editing, prefer small diffs)
- ✅ Capability gap protocol (questionnaire, no silent improvisation)
- ✅ Memory recall protocol (check project memory first)
- ✅ Well-defined mutation tiers with specific rationale requirements

**Quality of constraints**:

- Constraints are reasonable and actionable

**Recommendations**:

- Keep system/ as single source of truth (resolve duplication)
- Consider adding constraint about memory synthesis requirements
- Periodically review constraints for obsolescence

---

## 7. Plan Tracking Assessment

### Structure

```
plans/
├── active/        → .gitkeep (no active plans)
├── completed/     → .gitkeep (no completed plans)
├── abandoned/     → .gitkeep (no abandoned plans)
└── backlog.md     → Stub template
```

**Assessment**: Structure is correct, but no activity yet.

**Strengths**:

- ✅ Clear lifecycle: active → completed or abandoned
- ✅ Backlog for candidate work
- ✅ Gitkeep files preserve directory structure

**Usage Recommendations**:

- Create `plans/active/` files for multi-step tasks
- Use `plans/backlog.md` for follow-up opportunities
- Archive completed work to `plans/completed/` with outcomes
- Keep plans as `.md` files with clear structure

---

## 8. Integration With Chat Runtime

### Current Integration Points

**Manifest-aware discovery**:

- ✅ `manifest.json` defines sections and kinds
- ✅ `workspace_index` tool returns manifest-aligned structure
- ✅ `project_inventory` discovers app-level resources

**Resource installation flow**:

- ✅ `resource_install` writes to `agent-workspace/pi/`
- ✅ `.pi/settings.json` loads workspace resources
- ✅ Chat reloads to activate extensions/packages

**Memory/Plan persistence**:

- ✅ Plan mode reads from workspace plans
- ✅ Session state can reference workspace memory
- ✅ Artifacts accumulate in workspace

**Assessment**: Integration is well-designed and follows Pi conventions.

---

## 9. Recommendations Summary

### Priority: HIGH (Resolve Now)

1. **Resolve policy file duplication**
   - Keep `system/` canonical and `policies/` compatibility-only
   - Update manifest, docs, and tests to match
   - **Estimated effort**: 1 session

### Priority: MEDIUM (Plan Soon)

2. **Populate project memory as work progresses**
   - This is normal and expected; no action needed now
   - Synthesize learnings after significant sessions
   - Use canonical memory files, not ad hoc notes

3. **Link evals to active autocontext loop**
   - Integrate eval definitions with autocontext scenarios
   - Run periodic evaluation batches
   - Track improvements over time

4. **Document skill/eval relationships**
   - Create index showing which skills target which evals
   - Add rubrics and quality thresholds to eval files

### Priority: LOW (Nice-to-Have)

5. **Consider skill namespace alignment**
   - Coordinate workspace skills with project-level `.pi/skills/`
   - Use symlinks or explicit coordination to avoid duplication

6. **Expand plan tracking**
   - Use `plans/active/` more aggressively for complex work
   - Archive patterns from completed plans to memory/research

---

## 10. Conclusion

**Overall Assessment**: ⭐⭐⭐⭐ (4/5)

Fleet Pi's agent-workspace is thoughtfully designed and well-aligned with Pi principles. The architecture successfully establishes:

- Clear durable memory structures
- Protected system policies
- Specialized skills for core agent tasks
- Proper Pi runtime resource routing
- Well-organized artifact and plan tracking

**One remaining issue** (underutilized memory) should improve naturally as the workspace accumulates real agent work. The policy-location cleanup leaves the architecture solid and ready for growth as agents populate memory, install resources, and complete work.

The seeded-but-empty state of project memory and backlog is **healthy and expected** for a new setup. As the agent workspace is used, these files will naturally fill with learnings and capture future work.

---

## Appendix: File Completeness Checklist

- [x] System identity/behavior defined
- [x] Workspace policies documented
- [x] Mutation boundaries declared
- [x] Canonical memory scaffolding in place
- [x] Workspace skills collection (5 skills)
- [x] Evaluation framework (4 evals)
- [x] Plan tracking structure
- [x] Artifact organization
- [x] Pi resource routing configured
- [x] Manifest declarations complete
- [ ] Project memory populated (expected in future)
- [ ] Active plans (expected in future)
- [ ] Research distillations (expected in future)
