import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import {
  RightPanelProvider,
  useChatPanelDataContext,
  useRightPanelContext,
  useSettingsActionsContext,
  useWorkspaceTreeContext,
} from "./right-panel-context"
import type { ReactElement } from "react"
import type {
  ChatPanelDataContextValue,
  SettingsActionsContextValue,
  WorkspaceTreeContextValue,
} from "./right-panel-context"
import type { ChatSettingsResponse } from "../../../lib/pi/chat-protocol"

const SETTINGS_RESPONSE: ChatSettingsResponse = {
  diagnostics: [],
  effective: {
    compaction: { enabled: true, reserveTokens: 1000, keepRecentTokens: 2000 },
    enableSkillCommands: true,
    extensions: [],
    followUpMode: "one-at-a-time",
    packages: [],
    prompts: [],
    retry: { enabled: true, maxRetries: 2, baseDelayMs: 500 },
    skills: [],
    steeringMode: "all",
    themes: [],
    transport: "auto",
  },
  project: {},
  projectPath: "/tmp/fleet-pi",
  updateImpact: {
    newSessionRecommended: false,
    resourceReloadRequired: false,
  },
}

const CHAT_PANEL_DATA: ChatPanelDataContextValue = {
  activityLabel: "Thinking",
  mode: "agent",
  models: [],
  planLabel: "Plan ready",
  queue: { followUp: [], steering: [] },
  refreshResources: () => {},
  resources: null,
  resourcesError: null,
  resourcesLoading: false,
  rightPanel: "workspace",
  selectedModelKey: "google/gemini-2.5-flash-lite",
  setRightPanel: () => {},
  status: "ready",
}

const WORKSPACE_TREE_CONTEXT: WorkspaceTreeContextValue = {
  loadWorkspaceFile: (path) =>
    Promise.resolve({
      content: "# Workspace",
      mediaType: "text/markdown",
      name: "project.md",
      path,
    }),
  openWorkspacePath: () => {},
  refreshWorkspace: () => {},
  selectedWorkspacePath: "agent-workspace/memory/project/architecture.md",
  setSelectedWorkspacePath: () => {},
  workspaceError: null,
  workspaceLoading: false,
  workspaceTree: { diagnostics: [], nodes: [], root: "agent-workspace" },
}

const SETTINGS_ACTIONS: SettingsActionsContextValue = {
  isLoadingProviders: false,
  isUpdatingProvider: false,
  modelCatalog: [],
  onDiscoverModels: () => Promise.resolve([]),
  onRemoveProvider: () => Promise.resolve({ providers: [], success: true }),
  onThemePreferenceChange: () => {},
  onUpdateProvider: () => Promise.resolve({ providers: [], success: true }),
  providers: [],
  saveSettings: () => Promise.resolve(SETTINGS_RESPONSE),
  settings: null,
  settingsError: null,
  settingsLoading: false,
  themePreference: "system",
}

const CHAT_PANEL_DATA_KEYS = [
  "activityLabel",
  "mode",
  "models",
  "planLabel",
  "queue",
  "refreshResources",
  "resources",
  "resourcesError",
  "resourcesLoading",
  "rightPanel",
  "selectedModelKey",
  "setRightPanel",
  "status",
].sort()

const WORKSPACE_TREE_KEYS = [
  "loadWorkspaceFile",
  "openWorkspacePath",
  "refreshWorkspace",
  "selectedWorkspacePath",
  "setSelectedWorkspacePath",
  "workspaceError",
  "workspaceLoading",
  "workspaceTree",
].sort()

const SETTINGS_ACTIONS_KEYS = [
  "isLoadingProviders",
  "isUpdatingProvider",
  "modelCatalog",
  "onDiscoverModels",
  "onRemoveProvider",
  "onThemePreferenceChange",
  "onUpdateProvider",
  "providers",
  "saveSettings",
  "settings",
  "settingsError",
  "settingsLoading",
  "themePreference",
].sort()

const COMPAT_KEYS = [
  ...CHAT_PANEL_DATA_KEYS,
  ...WORKSPACE_TREE_KEYS,
  ...SETTINGS_ACTIONS_KEYS,
].sort()

function ChatPanelDataKeys() {
  return <div>{Object.keys(useChatPanelDataContext()).sort().join(",")}</div>
}

function WorkspaceTreeKeys() {
  return <div>{Object.keys(useWorkspaceTreeContext()).sort().join(",")}</div>
}

function SettingsActionsKeys() {
  return <div>{Object.keys(useSettingsActionsContext()).sort().join(",")}</div>
}

function CompatKeys() {
  return <div>{Object.keys(useRightPanelContext()).sort().join(",")}</div>
}

function renderKeys(Probe: () => ReactElement) {
  return renderToStaticMarkup(
    <RightPanelProvider
      chatPanelData={CHAT_PANEL_DATA}
      settingsActions={SETTINGS_ACTIONS}
      workspaceTree={WORKSPACE_TREE_CONTEXT}
    >
      <Probe />
    </RightPanelProvider>
  )
    .replace("<div>", "")
    .replace("</div>", "")
}

describe("right-panel context narrowing", () => {
  it("exposes chat panel data fields on the chat hook only", () => {
    expect(renderKeys(ChatPanelDataKeys).split(",")).toEqual(
      CHAT_PANEL_DATA_KEYS
    )
  })

  it("exposes workspace tree fields on the workspace hook only", () => {
    expect(renderKeys(WorkspaceTreeKeys).split(",")).toEqual(
      WORKSPACE_TREE_KEYS
    )
  })

  it("exposes settings action fields on the settings hook only", () => {
    expect(renderKeys(SettingsActionsKeys).split(",")).toEqual(
      SETTINGS_ACTIONS_KEYS
    )
  })

  it("compat hook merges the same 34 fields previously provided", () => {
    expect(COMPAT_KEYS).toHaveLength(34)
    expect(renderKeys(CompatKeys).split(",")).toEqual(COMPAT_KEYS)
  })

  it("passes slice values through unchanged", () => {
    function ValueProbe() {
      const chat = useChatPanelDataContext()
      const tree = useWorkspaceTreeContext()
      const settings = useSettingsActionsContext()
      return (
        <div>
          {[
            chat.mode,
            chat.status,
            String(chat.rightPanel),
            String(tree.selectedWorkspacePath),
            String(tree.workspaceTree?.root),
            settings.themePreference,
          ].join("|")}
        </div>
      )
    }
    expect(renderStaticValueProbe(ValueProbe)).toBe(
      "agent|ready|workspace|agent-workspace/memory/project/architecture.md|agent-workspace|system"
    )
  })

  it("compat hook throws outside RightPanelProvider", () => {
    expect(() => renderToStaticMarkup(<CompatKeys />)).toThrow(
      "must be used within RightPanelProvider"
    )
  })
})

function renderStaticValueProbe(Probe: () => ReactElement) {
  return renderToStaticMarkup(
    <RightPanelProvider
      chatPanelData={CHAT_PANEL_DATA}
      settingsActions={SETTINGS_ACTIONS}
      workspaceTree={WORKSPACE_TREE_CONTEXT}
    >
      <Probe />
    </RightPanelProvider>
  )
    .replace("<div>", "")
    .replace("</div>", "")
    .replace(/<!-- -->/g, "")
}
