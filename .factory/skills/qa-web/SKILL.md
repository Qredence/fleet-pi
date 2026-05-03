---
name: qa-web
description: >
  QA tests for the Fleet Pi web app. Tests the browser-based chat UI including
  messaging, tool rendering, session management, model selection, plan mode,
  and the workspace/resources browser. Uses agent-browser for interactive web
  testing against a local dev server.
---

# QA Tests for Fleet Pi Web App

## App Configuration

- **Framework:** TanStack Start + React 19 + Vite
- **Dev server:** `pnpm --filter web dev` (port 3000)
- **Build:** `pnpm --filter web build`
- **Test tool:** agent-browser
- **Auth:** None (anonymous access)

## Testing Target

This project has **no preview deployments**. The QA workflow starts a local dev server and tests against `http://localhost:3000`.

1. Start the dev server: `pnpm --filter web dev`
2. Poll `http://localhost:3000` until it responds with HTTP 200
3. Use `http://localhost:3000` as the base URL for all browser tests

**CRITICAL:** Never fall back to a remote environment when testing a PR branch. If the dev server cannot start, report ALL web tests as BLOCKED: "Dev server failed to start -- cannot verify branch code."

## Authentication in CI

No authentication is required. The app is fully accessible as an anonymous user.

**AWS Credentials for Bedrock:** Chat functionality requires AWS credentials with Bedrock access. These are provided via environment variables in CI:

- `AWS_REGION` (defaults to `us-east-1`)
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

If AWS credentials are missing or invalid, chat tests will fail with a 500 error from `/api/chat`. In this case, report chat-related tests as BLOCKED with the specific error.

## Available Test Flows

### Flow 1: Page Load & Initial State

**Maps to:** `apps/web/src/routes/index.tsx`, `apps/web/src/routes/__root.tsx`, `packages/ui/src/components/agent-elements/agent-chat.tsx`

1. Navigate to `http://localhost:3000`
2. Verify the page loads without errors (HTTP 200, no console errors)
3. Verify the chat interface is visible with:
   - Session controls (New session button, Session dropdown)
   - Mode selector (Agent / Plan)
   - Model picker dropdown
   - Chat input area
   - Suggestion pills ("What can you do?", "Tell me about this project")
4. Verify no messages are present in a fresh session
5. Capture accessibility tree snapshot for evidence

### Flow 2: Send Chat Message & Stream Response

**Maps to:** `apps/web/src/routes/index.tsx` (usePiChat), `apps/web/src/routes/api/chat.ts`

1. Start a new session (click "New session" button)
2. Type "What can you do?" in the input and submit
3. Verify the user message appears in the message list
4. Verify a streaming assistant response appears (status shows "Starting turn" or "Receiving response")
5. Wait for the stream to complete
6. Verify the assistant message contains meaningful text
7. Capture snapshot of the completed conversation

**Negative test:** Send an empty message and verify it is not submitted.

### Flow 3: Tool Execution Cards

**Maps to:** `packages/ui/src/components/agent-elements/tools/`, `apps/web/src/lib/pi/server.ts`

1. Send a message that triggers a tool: "read package.json"
2. Verify a `tool-Read` card appears in the chat showing the file contents
3. Send "create a small temp file under this repo"
4. Verify a `tool-Write` card appears showing the created file
5. Send "edit that temp file to add a greeting"
6. Verify a `tool-Edit` card appears showing a diff
7. Send "run pnpm --version"
8. Verify a `tool-Bash` card appears showing command and output
9. Capture snapshots of each tool card

**Negative test:** Send a message requesting a file outside the repo (e.g., "/etc/hosts") and verify the tool card shows an error or the request is blocked.

### Flow 4: Session Management

**Maps to:** `apps/web/src/routes/api/chat/new.ts`, `apps/web/src/routes/api/chat/session.ts`, `apps/web/src/routes/api/chat/sessions.ts`, `apps/web/src/routes/api/chat/resume.ts`

1. Send a message to create some chat history
2. Click "New session" button
3. Verify the chat clears and a fresh session starts
4. Send another message in the new session
5. Open the "Session" dropdown
6. Verify previous sessions appear in the list
7. Select a previous session from the dropdown
8. Verify the chat transcript restores with previous messages
9. Refresh the page
10. Verify the session hydrates from localStorage and previous messages reappear

**Negative test:** Corrupt localStorage with an outside session file path and verify the app starts a fresh repo-scoped session instead of showing an error.

### Flow 5: Model Selection

**Maps to:** `apps/web/src/routes/api/chat/models.ts`, `packages/ui/src/components/agent-elements/input/model-picker.tsx`

1. Open the model picker dropdown
2. Verify at least one model option is listed
3. Select a different model
4. Send a chat message
5. Verify the message streams a response (confirming the selected model is used)

### Flow 6: Agent / Plan Mode Switching

**Maps to:** `apps/web/src/lib/pi/plan-mode.ts`, `packages/ui/src/components/agent-elements/input/mode-selector.tsx`

1. Verify the mode selector shows "Agent" by default
2. Switch to "Plan" mode
3. Send "Create a plan for adding a new feature"
4. Verify the assistant produces a numbered `Plan:` without using write/edit tools
5. Verify plan status appears in the info bar
6. Switch back to "Agent" mode
7. Verify full tools are available again

### Flow 7: Plan Mode Question Prompts

**Maps to:** `apps/web/src/routes/api/chat/question.ts`, `packages/ui/src/components/agent-elements/question/`

1. Switch to Plan mode
2. Send an ambiguous request: "Make it better"
3. Verify a question prompt appears in the InputBar (asking for clarification)
4. Answer the question
5. Verify the same Pi turn continues and produces a plan
6. Verify the plan decision card appears with Execute/Refine/Stay options

### Flow 8: Follow-up Queuing

**Maps to:** `apps/web/src/routes/index.tsx` (queueFollowUp), `apps/web/src/routes/api/chat.ts`

1. Send a message that will take some time to respond
2. While streaming, type and send another message
3. Verify a "follow-up queued" or "steering message queued" status appears in the info bar
4. Wait for the first response to complete
5. Verify the follow-up is then processed

### Flow 9: Abort Streaming

**Maps to:** `apps/web/src/routes/api/chat/abort.ts`, `apps/web/src/routes/index.tsx` (stop)

1. Send a message that will stream a long response
2. While streaming, click the Stop button (square icon)
3. Verify the stream stops
4. Verify the status returns to "ready"
5. Verify partial assistant message remains visible

### Flow 10: Workspace & Resources Browser

**Maps to:** `apps/web/src/components/pi/resource-library.tsx`, `apps/web/src/routes/api/chat/resources.ts`, `apps/web/src/routes/api/workspace/tree.ts`, `apps/web/src/routes/api/workspace/file.ts`

1. Click the resources/browser icon to open the Pi resources panel
2. Verify the panel opens (desktop: right-side canvas; mobile: overlay)
3. Verify the "Resources" tab is active and shows discovered skills, prompts, extensions
4. Switch to the "Workspace" tab
5. Verify `agent-workspace/` directory and seeded files appear in the tree
6. Click a Markdown file in the workspace tree
7. Verify the preview panel renders the file contents
8. Switch to the "Configurations" tab
9. Verify UI-first configuration rows appear
10. Verify the theme control (Light/Dark/System) is present and functional
11. Close the resources panel and verify the chat interface returns to full width

**Negative test:** Attempt to access a file outside the workspace root and verify it is blocked.

### Flow 11: Error Handling

**Maps to:** Error states in `usePiChat`, `/api/chat` error events

1. If AWS credentials are unavailable, verify the chat shows an error message instead of crashing
2. Send a malformed request (if possible via UI) and verify graceful error handling
3. Verify error messages are displayed to the user in the chat interface

## Per-Persona Variations

### Anonymous User

All flows above are run as an anonymous user. No login step is needed.

### Fresh Session User

Run Flows 1, 2, 3, 6, 10 with a fresh session to test empty states and first-run behavior.

## Error Handling Specific to This App

- **Dev server not ready:** The Vite dev server can take 10-30 seconds to start on cold boot. Poll with increasing backoff.
- **Bedrock credentials missing:** `/api/chat` will return a 500 error. Report as BLOCKED with "AWS credentials missing -- set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY."
- **Model unavailable:** If the selected Bedrock model is not available in the configured region, the chat stream will error. Report as BLOCKED and suggest checking `AWS_REGION`.
- **Session file corruption:** Invalid session metadata in localStorage is handled gracefully by starting a fresh session.
- **Empty message submission:** The UI blocks empty messages (trim check in `sendMessage`).
- **Workspace file access blocked:** Attempts to access files outside `workspaceRoot` are rejected by the server.

## Known Failure Modes

1. **Dev server slow startup.** Vite dev server may take 20-30 seconds on first build. Increase polling timeout to 60 seconds.
2. **Bedrock throttling.** Amazon Bedrock may throttle requests in shared AWS accounts. If streams fail with throttling errors, retry once after a 10-second delay.
3. **Agent mode tool execution delay.** Tool cards may take several seconds to appear while the agent thinks. Wait at least 15 seconds for tool execution to begin.
4. **Plan mode requires specific prompt structure.** Plan mode works best with explicit requests like "Plan how to..." rather than vague prompts. Use clear, actionable prompts for plan mode tests.
5. **LocalStorage session mismatch.** If the server restarts between tests, stored session metadata may reference a session file that no longer exists. The app handles this by starting fresh, but the test should verify this graceful fallback.
6. **Model picker empty.** If Bedrock credentials are invalid, `/api/chat/models` may return an empty list. In this case, model selection tests should be reported as BLOCKED.
7. **Resources panel resize on desktop.** The right-side canvas opens at 70% viewport width and clamps resizing to that maximum. On mobile it opens as a compact overlay. Tests should verify both open and close behaviors.
