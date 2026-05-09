# Fleet Pi Runtime Initialization

## AgentSessionRuntime Creation Pipeline

### Phase 1: Entry Point (`createPiRuntime`)

```
Input:
  ├─ context: AppRuntimeContext { projectRoot, workspaceRoot }
  ├─ metadata: ChatRuntimeMetadata { mode?, planAction?, sessionFile?, sessionId? }
  └─ modelSelection?: ChatModelSelection

Decision:
  ├─ Check runtimeRecords cache (reuse if valid & not expired)
  │   └─ If found: applyModelSelection + applyPlanMode, return cached
  └─ Otherwise: create fresh runtime (proceed to Phase 2)
```

### Phase 2: Session Manager Setup

```
createSessionManager(metadata, projectRoot, sessionDir):
  ├─ resolveSessionFile() → may open existing JSONL
  │   ├─ validate path is inside sessionDir (security boundary)
  │   └─ by sessionFile path or sessionId lookup
  └─ Return SessionManager (either fresh or opened from file)

SessionManager responsibilities:
  ├─ Manages JSONL session file
  ├─ Tracks session ID + file path
  ├─ getBranch() → returns Pi turn entries
  └─ prompt() → sends message to Pi + logs events
```

### Phase 3: Runtime Factory Configuration

```
createRuntime (async factory function):

  Input (from createAgentSessionRuntime):
    ├─ cwd: string
    ├─ agentDir: string
    ├─ sessionManager: SessionManager
    └─ sessionStartEvent: SessionStartEvent

  Step 1: Create Services
    createSessionServices(context, { cwd, agentDir, resourceLoaderOptions })
      ├─ Pi ModelRegistry
      │   ├─ Connects to Bedrock (AWS credentials)
      │   ├─ Lists available models
      │   └─ Supports thinking levels (off/minimal/low/medium/high/xhigh)
      │
      ├─ SettingsManager
      │   ├─ Reads .pi/settings.json (defaults, thresholds)
      │   ├─ Reads environment variables (AWS_REGION, PI_AGENT_DIR, etc.)
      │   └─ Tracks diagnostics (config errors, deprecated fields, etc.)
      │
      ├─ ResourceLoader
      │   ├─ Loads skills from .pi/skills + agent-workspace/pi/skills
      │   ├─ Loads prompts from .pi/prompts + agent-workspace/pi/prompts
      │   ├─ Loads extensions from .pi/extensions + agent-workspace/pi/extensions
      │   ├─ Loads themes
      │   └─ Tracks diagnostics (missing/broken resources)
      │
      ├─ ToolRegistry
      │   ├─ Registers built-in tools (read, write, edit, bash, web_fetch)
      │   ├─ Registers extensions (project_inventory, workspace_index, etc.)
      │   └─ Filters by CHAT_TOOL_ALLOWLIST (or plan-mode-specific subset)
      │
      └─ LLMProvider bridge (Bedrock)
          ├─ Handles authentication
          └─ Streams model responses

  Step 2: Extension Setup
    extensionFactories: [createPlanModeExtension()]
      ├─ Registers plan-questionnaire tool (virtual)
      ├─ Hooks tool_call events (blocks non-read-only bash if plan mode)
      ├─ Hooks context events (extracts Plan: steps)
      └─ Returns custom state for plan tracking

  Step 3: Model Resolution
    resolveModelSelection(runtimeServices, modelSelection)
      ├─ Parse provider + model ID from input
      ├─ Validate against available models from ModelRegistry
      ├─ Resolve thinking level
      └─ Return { model: Model, thinkingLevel: ChatThinkingLevel }

  Step 4: Bedrock Circuit Breaker
    bedrockCircuitBreaker.fire({
      services,
      sessionManager,
      sessionStartEvent,
      model,
      thinkingLevel,
      tools: CHAT_TOOL_ALLOWLIST,
    })
      ├─ Wraps Bedrock invocation with fallback behavior
      ├─ Returns createAgentSessionFromServices result
      │   ├─ AgentSession (streaming interface)
      │   ├─ modelFallbackMessage? (if circuit breaker engaged)
      │   └─ diagnostics: string[]
      └─ On failure: throws or calls fallback()
          └─ fallback: createBedrockFallbackError()
```

### Phase 4: Session Runtime Activation

```
createAgentSessionRuntime(createRuntime, { cwd, agentDir, sessionManager }):
  ├─ Calls createRuntime factory
  ├─ Wraps result in AgentSessionRuntime
  └─ Returns ready-to-use runtime
      ├─ runtime.session (Agent session for streaming)
      ├─ runtime.services (all registered services)
      ├─ runtime.execute() (execute tool call)
      ├─ runtime.evaluate() (evaluate expressions)
      └─ runtime.dispose() (cleanup)

trackRuntime(runtime):
  ├─ Store in runtimeRecords[sessionId]
  ├─ Initialize disposeTimer (will schedule cleanup after RUNTIME_TTL_MS)
  └─ Return ActiveSessionRecord

applyPlanMode(runtime, mode?, planAction?):
  ├─ If mode === "plan": restrict tools to PLAN_MODE_TOOLS
  ├─ If planAction: restore plan execution state
  └─ Restore persisted plan steps if resuming
```

## Tool Allowlists by Mode

### Agent Mode (Full Access)

```typescript
NORMAL_MODE_TOOLS = [
  "read",
  "bash",
  "edit",
  "write",
  "workspace_write",
  "resource_install",
  "questionnaire",
  "web_fetch",
  "project_inventory",
  "workspace_index",
  // Autocontext tools (evaluation, improvement, status checks)
  "autocontext_status",
  "autocontext_scenarios",
  "autocontext_runtime_snapshot",
  "autocontext_judge",
  "autocontext_improve",
  "autocontext_queue",
  // Autoresearch tools (experiment tracking)
  "init_experiment",
  "run_experiment",
  "log_experiment",
  // Subagents
  "subagent",
]
```

### Plan Mode (Read-Only)

```typescript
PLAN_MODE_TOOLS = [
  "read", "bash" (read-only only), "grep", "find", "ls",
  "questionnaire",
  "project_inventory", "workspace_index",
  // Status checks only (no mutations)
  "autocontext_status", "autocontext_scenarios", "autocontext_runtime_snapshot",
]

Bash Command Policy (Plan Mode):
  ├─ Allowed: ls, find, grep, cat, tail, head, ps, df, etc. (read-only)
  ├─ Blocked: rm, mv, cp, mkdir, curl (network), etc.
  ├─ Blocked: eval, exec, source (code execution)
  ├─ Blocked: command substitution ($()), pipes to non-read-only, etc.
  └─ Reason: enforced via command-policy.ts + plan-mode.ts tool_call hook
```

## Model & Provider Setup

### Bedrock Integration

```
AWS Credentials (standard AWS SDK chain):
  ├─ Environment: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN
  ├─ AWS Profile: ~/.aws/credentials [profile-name]
  ├─ EC2 IAM Role
  └─ ECS Task Role

Region:
  ├─ Environment: AWS_REGION (default: us-east-1)
  ├─ Settings: via .pi/settings.json
  └─ Bedrock availability varies by region

Default Model:
  ├─ claude-sonnet-4-6 (us.anthropic.claude-sonnet-4-6)
  ├─ Fallback chain: settings.json → environment → hardcoded default
  └─ Circuit breaker: if unavailable, offers alternative
```

### Model Registry Flow

```
services.modelRegistry.getAvailable():
  ├─ Query Bedrock ListFoundationModels API
  ├─ Filter by provider (Amazon, Anthropic, etc.)
  ├─ Cache results (TTL not specified, likely per-session)
  └─ Return available Model[]

services.modelRegistry.getAll():
  ├─ Fallback to known model list
  └─ Used if API call fails

Model Selection:
  ├─ User picks from ModelPicker
  ├─ POST /api/chat includes model + optional thinkingLevel
  ├─ applyModelSelection() updates runtime.session.model
  └─ Next turn uses new model
```

## Extension Architecture

### Plan Mode Extension

```
createPlanModeExtension():
  ├─ Registers virtual questionnaire tool
  │   └─ Handles multi-option plan decisions (execute/refine/stay)
  │
  ├─ Hooks tool_call event:
  │   └─ If bash in plan mode: check command policy
  │       ├─ Allowed: pass through
  │       └─ Blocked: return { block: true, reason: "..." }
  │
  ├─ Hooks context event:
  │   ├─ Extract "Plan:" section from LLM response
  │   ├─ Parse numbered steps
  │   ├─ Track completed steps ([DONE:n] markers)
  │   └─ Update plan state
  │
  └─ Hooks end event:
      └─ Finalize plan (mark completed, return tool part for UI)
```

### Project-Local Extensions

```
Loaded from:
  ├─ .pi/extensions/
  ├─ agent-workspace/pi/extensions/enabled/
  └─ agent-workspace/pi/extensions/staged/

Examples:
  ├─ project-inventory.ts → project_inventory tool
  ├─ workspace-index.ts → workspace_index tool
  ├─ resource-install.ts → resource_install tool
  └─ subagents/index.ts → subagent tool
```

## Diagnostics & Error Handling

### Diagnostic Collection

```
collectDiagnostics(services, modelFallbackMessage?):
  ├─ Model registry errors
  ├─ Settings manager errors (per scope)
  ├─ Resource loader warnings (missing skills, broken extensions, etc.)
  ├─ Resource expectation mismatches
  ├─ Bedrock circuit breaker fallback message
  └─ Return: string[] (sent to browser in ChatStartEvent)
```

### Error Handling Strategy

```
Bedrock unavailable:
  ├─ Circuit breaker catches error
  ├─ Falls back to createBedrockFallbackError()
  ├─ Returns modelFallbackMessage to diagnostics
  └─ User sees warning but can still interact (limited)

Invalid session file:
  ├─ SecurityError (outside sessionDir)
  └─ SessionManager.open() throws
      └─ Fresh session created (silent fallback)

Model not available:
  ├─ Validation fails during applyModelSelection
  ├─ Error thrown to browser
  └─ User sees error toast, can try different model

Extension load failure:
  ├─ ResourceLoader catches error
  ├─ Diagnostic added (path + error message)
  └─ Other extensions continue to load
```

## Environment Configuration

### Required

```
AWS_ACCESS_KEY_ID      # Bedrock auth
AWS_SECRET_ACCESS_KEY  # Bedrock auth
```

### Optional

```
AWS_REGION                  # default: us-east-1
AWS_SESSION_TOKEN           # for temporary credentials
FLEET_PI_REPO_ROOT          # project root (default: process.cwd())
FLEET_PI_RUNTIME_TTL_MS     # in-memory runtime lifetime (default: 600000)
PI_AGENT_DIR                # pi agent installation dir
PI_THEME                    # UI theme
```

### Settings File (.pi/settings.json)

```json
{
  "awsRegion": "us-west-2",
  "defaultProvider": "amazon-bedrock",
  "defaultModel": "us.anthropic.claude-opus-4-1",
  "sessionDir": ".fleet/sessions",
  "thinkingLevel": "high",
  "resources": {
    "skills": ["../agent-workspace/pi/skills"],
    "prompts": ["../agent-workspace/pi/prompts"],
    "extensions": ["../agent-workspace/pi/extensions/enabled"]
  }
}
```

## Summary: Runtime Lifecycle

```
User sends message
  ↓
POST /api/chat with sessionId
  ↓
createPiRuntime()
  ├─ Check runtimeRecords cache
  │   ├─ If hit (< TTL): reuse + applyModelSelection + applyPlanMode, return
  │   └─ If miss/expired: create fresh
  │
  ├─ Load SessionManager (fresh or from file)
  ├─ Create services (models, settings, resources, tools)
  ├─ Resolve model selection
  ├─ Invoke Bedrock (circuit breaker protected)
  └─ Wrap in AgentSessionRuntime

Runtime ready:
  ├─ trackRuntime() adds to cache
  ├─ scheduleRuntimeDisposal() at RUNTIME_TTL_MS
  └─ Return to /api/chat streaming handler

Message processing:
  ├─ runtime.session.prompt(message)
  ├─ Stream Pi events (tool calls, LLM output, etc.)
  └─ Browser normalizes to ChatStreamEvent

After streaming:
  ├─ retainPiRuntime() clears dispose timeout (extends TTL)
  ├─ If follow-up: queuePromptOnActiveSession()
  └─ If idle > TTL: scheduleRuntimeDisposal() disposes + removes from cache

Cleanup:
  ├─ runtime.dispose()
  ├─ services.modelRegistry.dispose()
  ├─ resourceLoader cleanup
  └─ runtimeRecords.delete(sessionId)
```
