# Fleet Pi Model Discovery & Resource Loading

## Model Discovery Pipeline

### 1. ModelRegistry: Bedrock Integration

```typescript
// During runtime creation:
services.modelRegistry = await createAgentSessionServices(...)
  ├─ Connects to AWS Bedrock
  ├─ Calls ListFoundationModels API
  └─ Caches results per session
```

**AWS Setup:**

```
Required Environment:
  ├─ AWS_ACCESS_KEY_ID
  ├─ AWS_SECRET_ACCESS_KEY
  └─ AWS_REGION (default: us-east-1)

OR AWS Profile (~/.aws/credentials):
  ├─ [default] or [named-profile]
  └─ AWS SDK auto-discovers
```

### 2. Model Availability Discovery

```typescript
services.modelRegistry.getAvailable():
  ├─ Query Bedrock ListFoundationModels(region)
  ├─ Parse response → Model[]
  └─ Return only models with status="active"

services.modelRegistry.getAll():
  ├─ Fallback list (hardcoded known models)
  └─ Used if API call fails
```

**Example Models (Bedrock):**

```
us.anthropic.claude-opus-4-1           // Extended thinking available
us.anthropic.claude-sonnet-4-6         // Default
us.anthropic.claude-haiku-3-5
us.meta.llama3-2-70b-instruct
us.amazon.nova-pro
eu.anthropic.claude-3-sonnet           // Regional variant
```

### 3. Model Selection Flow

**User Selection:**

```
GET /api/chat/models
  ├─ loadChatModels(context)
  │   ├─ services.modelRegistry.getAvailable()
  │   ├─ Convert each Model → ChatModelInfo
  │   └─ Apply settings defaults
  └─ Return ChatModelsResponse
      ├─ models: ChatModelInfo[]
      ├─ selectedModelKey: string (default)
      ├─ defaultProvider: string
      ├─ defaultThinkingLevel: ChatThinkingLevel
      └─ diagnostics: string[]

Browser:
  ├─ Render ModelPicker dropdown
  ├─ Display models grouped by provider
  └─ Show thinking level selector (if applicable)
```

**Runtime Application:**

```
POST /api/chat { model: ChatModelSelection, ... }
  ├─ createPiRuntime()
  ├─ resolveModelSelection(services, selection)
  │   ├─ Parse provider + model ID
  │   ├─ Lookup in ModelRegistry
  │   ├─ Extract thinking level
  │   └─ Return { model: Model, thinkingLevel }
  ├─ applyModelSelection(runtime, selection)
  │   ├─ runtime.session.setModel(model)
  │   ├─ runtime.session.setThinkingLevel(level)
  │   └─ Validate against available
  └─ Next prompt uses new model
```

### 4. Model Resolution: Bedrock Region/Prefix Handling

**Problem:** Bedrock models have region prefixes:

- `us.anthropic.claude-sonnet-4-6` (US region)
- `eu.anthropic.claude-sonnet-4-6` (EU region)
- `global.anthropic.claude-sonnet-4-6` (Global endpoint)

**Solution:**

```typescript
bedrockModelCandidates(id: string):
  Example: id = "claude-sonnet-4-6"

  hasRegionPrefix = false
  candidates = [
    "us.anthropic.claude-sonnet-4-6",
    "global.anthropic.claude-sonnet-4-6",
    "anthropic.claude-sonnet-4-6",
    "claude-sonnet-4-6"
  ]

  ModelRegistry.find(provider, candidate) returns first match

Legacy Support:
  ├─ If user provides "anthropic/claude-3-sonnet-20240229"
  ├─ Parse: provider="anthropic", id="claude-3-sonnet-20240229"
  └─ Convert to region prefixes, try candidates
```

### 5. Thinking Level Support

**Available Levels:**

```typescript
type ChatThinkingLevel =
  | "off" // No thinking tokens used
  | "minimal" // Minimal thinking
  | "low" // Low thinking budget
  | "medium" // Medium thinking budget
  | "high" // High thinking budget
  | "xhigh" // Extra high thinking budget
```

**Model Support:**

- Claude 3.7/4 models: Full thinking support
- Claude 3.5 models: Limited thinking support
- Other models: Thinking not supported (auto-set to "off")

**Flow:**

```
User selects model + thinking level
  ├─ POST /api/chat { model: {..., thinkingLevel: "high"} }
  ├─ resolveModelSelection() returns thinkingLevel
  ├─ runtime.session.setThinkingLevel("high")
  └─ Pi allocates thinking tokens in prompt

Response includes:
  ├─ Thinking tokens in ChatThinkingEvent
  ├─ Final response after thinking
  └─ Tool usage (if applicable)
```

### 6. Model Fallback & Circuit Breaker

**Bedrock Unavailable:**

```typescript
createPiRuntime():
  ├─ bedrockCircuitBreaker.fire(...)
  ├─ On error:
  │   ├─ Fallback triggered
  │   ├─ modelFallbackMessage = "Bedrock unavailable, using fallback..."
  │   └─ Return error + diagnostics
  └─ Browser sees diagnostics warning
```

**Default Model Selection:**

```
Order of precedence:
  1. User selection (POST /api/chat)
  2. Settings default (.pi/settings.json)
  3. Environment default
  4. Hardcoded: "us.anthropic.claude-sonnet-4-6"
```

## Resource Loading Pipeline

### 1. Resource Locations

**Project-Local (Workspace):**

```
agent-workspace/pi/
  ├─ skills/                    # Skill directories
  │   ├─ fleet-pi-orientation/SKILL.md
  │   ├─ chat-runtime-debugging/SKILL.md
  │   └─ ...
  ├─ prompts/                   # Prompt files
  │   ├─ default-prompt.md
  │   └─ ...
  ├─ extensions/
  │   ├─ enabled/                # Active extensions
  │   │   ├─ project-inventory.ts
  │   │   └─ workspace-index.ts
  │   └─ staged/                 # Inactive extensions
  │       ├─ custom-tool.ts
  │       └─ ...
  └─ packages/                   # Pi packages
      ├─ npm:pi-autoresearch
      └─ ...
```

**Pi Installation (Root):**

```
.pi/
  ├─ skills/                    # Project skills
  ├─ prompts/                   # Project prompts
  ├─ extensions/
  │   ├─ project-inventory.ts    # Built-in (symlink to workspace)
  │   ├─ workspace-index.ts
  │   └─ vendor/                 # Vendored extensions
  │       ├─ filechanges/
  │       └─ subagents/
  ├─ settings.json               # Configuration bridge
  └─ npm/
      └─ node_modules/pi-*/      # npm-based packages
```

### 2. ResourceLoader: Discovery & Loading

**During Runtime Initialization:**

```typescript
createSessionServices(context, { resourceLoaderOptions }):
  ├─ Pi ResourceLoader created
  ├─ Configure extension factories (Plan mode, etc.)
  ├─ Load from directories:
  │   ├─ .pi/skills/ → services.resourceLoader.getSkills()
  │   ├─ agent-workspace/pi/skills/
  │   ├─ .pi/prompts/ → getPrompts()
  │   ├─ .pi/extensions/enabled/ → getExtensions()
  │   ├─ .pi/extensions/vendor/
  │   └─ theme resources → getThemes()
  └─ Collect diagnostics (missing, broken resources)
```

### 3. Skill Discovery & Loading

**What is a Skill:**

```
Skills are specialized knowledge/workflow documents:
  ├─ Location: agent-workspace/pi/skills/{skill-name}/SKILL.md
  ├─ Format: Markdown with frontmatter
  ├─ Content: Step-by-step instructions, code samples, best practices
  ├─ Accessible to: Agent (full access), Plan mode (read-only)
  └─ Example: fleet-pi-orientation, chat-runtime-debugging
```

**Loading Process:**

```typescript
readSkillDirectories(context):
  ├─ List directories in agent-workspace/pi/skills/
  ├─ For each directory: check for SKILL.md
  │   ├─ If SKILL.md exists: add to resources
  │   └─ If not: skip (not a valid skill)
  └─ Return ChatResourceInfo[]
      ├─ name: "fleet-pi-orientation"
      ├─ path: "agent-workspace/pi/skills/fleet-pi-orientation/SKILL.md"
      ├─ activationStatus: "active"
      └─ source: "workspace"
```

**Usage in Chat:**

```
Browser fetches /api/chat/resources
  ├─ Get skills.getSkills()
  ├─ Display in Resources panel
  └─ User can click to load skill context

Pi chat context:
  ├─ Skills are injected into system prompt (if user loads)
  ├─ Or used as explicit context files
  └─ Skill content informs agent reasoning
```

### 4. Prompt Loading

**What is a Prompt:**

```
Prompts are instruction templates for Pi:
  ├─ Location: agent-workspace/pi/prompts/*.{md,txt}
  ├─ Format: Plain text or Markdown
  ├─ Content: Example instructions, task definitions
  ├─ Accessible to: Agent (full access)
  └─ Used for: Custom prompts, templates, system instructions
```

**Loading Process:**

```typescript
readPromptFiles(context):
  ├─ List files in agent-workspace/pi/prompts/
  ├─ Filter: *.md and *.txt files only
  ├─ For each file:
  │   ├─ Extract filename as name
  │   ├─ Create ChatResourceInfo
  │   └─ Mark as "active"
  └─ Return sorted by name
```

### 5. Extension Loading

**What is an Extension:**

```
Extensions are TypeScript modules that extend Pi behavior:
  ├─ Location: agent-workspace/pi/extensions/{enabled,staged}/*.ts
  ├─ Activation: "enabled" = active, "staged" = inactive
  ├─ Exports: ExtensionAPI functions (tool_call, context, etc. hooks)
  ├─ Examples: project-inventory, workspace-index, plan-mode, subagents
  └─ Registered: in Pi at runtime
```

**Active vs Staged:**

```
Enabled Extensions:
  ├─ Loaded automatically at runtime
  ├─ Tools + hooks registered
  └─ Available to chat immediately

Staged Extensions:
  ├─ Downloaded but not active
  ├─ Can be activated by resource_install (with user approval)
  ├─ Moved from staged/ → enabled/
  └─ Require session reload to become active
```

**Loading Process:**

```typescript
readExtensionFiles(context, directory, activationStatus):
  ├─ List files in agent-workspace/pi/extensions/{enabled,staged}
  ├─ Filter: *.ts files only
  ├─ For each file:
  │   ├─ Extract filename (without .ts) as name
  │   ├─ Create ChatResourceInfo { name, path, activationStatus }
  │   └─ Mark source: "workspace"
  └─ Return sorted by name
```

**Extension Registration at Runtime:**

```
extensionFactories: [createPlanModeExtension()]
  ├─ Pi instantiates each factory with ExtensionAPI
  ├─ Extension registers tools (questionnaire, custom tools, etc.)
  ├─ Extension hooks Pi events (tool_call, context, end)
  └─ Hooks run for every session event
```

### 6. Package Loading

**What is a Package:**

```
Packages are bundles of resources (skills, prompts, extensions):
  ├─ npm packages: npm:pi-autoresearch, npm:pi-autocontext, npm:pi-skill-palette
  ├─ Local packages: agent-workspace/pi/packages/{package-name}
  ├─ Activation: Listed in .pi/settings.json "packages" array
  ├─ Contents: May include nested skills, prompts, extensions
  └─ Management: Via resource_install
```

**Loading Process:**

```typescript
readPackages(context, settings):
  ├─ List directories in agent-workspace/pi/packages/
  ├─ Check .pi/settings.json for activePackages
  ├─ For each directory:
  │   ├─ activationStatus = activePackages.has(package) ? "active" : "staged"
  │   ├─ Create ChatResourceInfo
  │   └─ Add to resources
  └─ Return packages
```

### 7. Resource Expectations & Diagnostics

**Expected Extensions:**

```typescript
EXPECTED_PROJECT_EXTENSION_NAMES = [
  "project-inventory", // Query project structure
  "workspace-index", // Browse workspace files
  "workspace-write", // Write to agent-workspace/
  "workspace-context", // Workspace introspection
  "web-fetch", // Fetch external URLs
  "resource-install", // Install Pi resources
]
```

**Validation:**

```
collectResourceExpectationDiagnostics(resources):
  ├─ Get extensionNames (case-insensitive)
  ├─ For each expected name:
  │   ├─ If missing: add diagnostic
  │   │   └─ "Missing expected Pi extension: project-inventory"
  │   └─ If present: OK (no diagnostic)
  └─ Return diagnostics[]

Browser sees diagnostics in:
  ├─ /api/chat/resources { diagnostics: [...] }
  ├─ /api/chat (ChatStartEvent.diagnostics)
  └─ Chat right panel: Resources tab
```

### 8. Model Diagnostics

**Collected Diagnostics:**

```
collectDiagnostics(services, modelFallbackMessage):
  ├─ Model registry errors
  │   ├─ Bedrock unavailable
  │   ├─ Region not supported
  │   └─ Invalid credentials
  ├─ Settings errors
  │   ├─ Invalid .pi/settings.json
  │   ├─ Deprecated fields
  │   └─ Missing required config
  ├─ Resource diagnostics
  │   ├─ Skill not found
  │   ├─ Broken extension (parse error)
  │   ├─ Missing SKILL.md
  │   └─ Theme load failed
  ├─ Model fallback message
  │   └─ "Bedrock circuit breaker activated"
  └─ Return: string[] (sent to browser in ChatStartEvent)
```

## loadChatResources() Complete Response

```typescript
async function loadChatResources(context: AppRuntimeContext) {
  const services = await createSessionServices(context)

  // Load from Pi installation
  const skills = services.resourceLoader.getSkills()
  const prompts = services.resourceLoader.getPrompts()
  const extensions = services.resourceLoader.getExtensions()
  const themes = services.resourceLoader.getThemes()

  // Load from workspace
  const workspaceResources = await loadWorkspaceResourceCatalog(context)

  // Merge (workspace takes precedence)
  const response: ChatResourcesResponse = {
    packages: workspaceResources.packages,
    skills: mergeResourceInfo(
      skills.skills.map(skillToResourceInfo),
      workspaceResources.skills
    ),
    prompts: mergeResourceInfo(
      prompts.prompts.map(promptToResourceInfo),
      workspaceResources.prompts
    ),
    extensions: mergeResourceInfo(
      extensions.extensions.map(extensionNameFromPath),
      workspaceResources.extensions
    ),
    themes: themes.themes.map(themeToResourceInfo),
    agentsFiles: agentsFiles.agentsFiles.map(...),
    diagnostics: collectDiagnostics(services),
  }

  return response
}
```

## Resource Installation (resource_install)

**User Request:**

```
"Please install the @earendil-works/pi-coding-agent skill"

Browser:
  ├─ Send to chat (Agent mode only)
  └─ Pi processes resource_install tool call

Server:
  ├─ download resource from source (npm, GitHub, URL, or pasted content)
  ├─ validate resource type (skill, prompt, extension, package)
  ├─ If extension/package: stage (don't auto-activate)
  ├─ Write to agent-workspace/pi/{skills,prompts,extensions/staged,packages}/
  └─ Return success + activation instructions
```

**Activation:**

```
Staged extension becomes active:
  ├─ User runs resource_install with activate:true
  ├─ Move file from staged/ → enabled/
  ├─ Update .pi/settings.json if needed
  └─ User must reload Pi session to apply

Skills/Prompts:
  ├─ Active immediately after install
  ├─ Available in next API call (/api/chat/resources)
  └─ User may need to reload page to see in UI
```

## Performance Notes

- **Model discovery:** Cached per session (Bedrock API called once)
- **Resource loading:** Filesystem scan at runtime creation (~10-50ms)
- **Extension registration:** Executed in-process, synchronous (~1-5ms)
- **Workspace resources:** Async filesystem I/O, cached in memory (~20-100ms)
- **Diagnostics:** Lazy collection, not sent until needed
