import { basename, dirname, extname } from "node:path"
import { collectResourceExpectationDiagnostics } from "../resource-expectations"
import {
  applyWorkspaceResourceMetadata,
  loadWorkspaceResourceOverlay,
  mergeResourceInfo,
  readWorkspacePiSettings,
} from "../workspace-resource-catalog"
import { collectDiagnostics } from "./diagnostics"
import { createSessionServices } from "./session-factory"
import type { PromptTemplate, Skill } from "@earendil-works/pi-coding-agent"
import type { ChatResourcesResponse } from "@workspace/pi-protocol/chat-protocol"
import type { AppRuntimeContext } from "@/lib/app-runtime"

export async function loadChatResources(
  context: AppRuntimeContext
): Promise<ChatResourcesResponse> {
  const services = await createSessionServices(context)
  const workspaceSettings = await readWorkspacePiSettings(context.projectRoot)
  const skills = services.resourceLoader.getSkills()
  const prompts = services.resourceLoader.getPrompts()
  const extensions = services.resourceLoader.getExtensions()
  const themes = services.resourceLoader.getThemes()
  const agentsFiles = services.resourceLoader.getAgentsFiles()
  const workspaceOverlay = await loadWorkspaceResourceOverlay(context)
  const enableSkillCommands = services.settingsManager.getEnableSkillCommands()

  const response: ChatResourcesResponse = {
    packages: workspaceOverlay.packages,
    skills: mergeResourceInfo(
      context.projectRoot,
      skills.skills.map((skill) =>
        applyWorkspaceResourceMetadata(
          context.projectRoot,
          workspaceSettings,
          skillToResourceInfo(skill)
        )
      ),
      workspaceOverlay.skills
    ),
    prompts: mergeResourceInfo(
      context.projectRoot,
      prompts.prompts.map((prompt) =>
        applyWorkspaceResourceMetadata(
          context.projectRoot,
          workspaceSettings,
          promptToResourceInfo(prompt)
        )
      ),
      workspaceOverlay.prompts
    ),
    extensions: mergeResourceInfo(
      context.projectRoot,
      extensions.extensions.map((extension) =>
        applyWorkspaceResourceMetadata(context.projectRoot, workspaceSettings, {
          name: extensionNameFromPath(extension.path),
          path: extension.resolvedPath,
          source: getSource(extension),
        })
      ),
      workspaceOverlay.extensions
    ),
    themes: themes.themes.map((theme) => {
      const resource = theme as unknown as Record<string, unknown>
      return {
        name: stringValue(resource.name) ?? stringValue(resource.id) ?? "Theme",
        path: stringValue(resource.filePath) ?? stringValue(resource.path),
      }
    }),
    agentsFiles: agentsFiles.agentsFiles.map((file) => ({
      name: basename(file.path),
      path: file.path,
    })),
    diagnostics: collectDiagnostics(services),
  }

  const diagnostics = [
    ...new Set([
      ...response.diagnostics,
      ...collectResourceExpectationDiagnostics(response),
    ]),
  ]

  if (!enableSkillCommands) {
    diagnostics.push(
      "Skill slash commands are disabled in project Pi settings."
    )
  }

  return {
    ...response,
    diagnostics,
  }
}

function skillToResourceInfo(skill: Skill) {
  return {
    name: skill.name,
    description: skill.description,
    path: skill.filePath,
    source: getSource(skill),
  }
}

function promptToResourceInfo(prompt: PromptTemplate) {
  return {
    name: prompt.name,
    description: prompt.description,
    path: prompt.filePath,
    source: getSource(prompt),
    argumentHint: prompt.argumentHint,
  }
}

function extensionNameFromPath(path: string | undefined) {
  if (!path) return "Resource"

  const fileName = basename(path)
  if (fileName.toLowerCase() === "index.ts") {
    return basename(dirname(path))
  }

  const extension = extname(fileName)
  return extension ? fileName.slice(0, -extension.length) : fileName
}

function getSource(resource: { sourceInfo?: unknown }) {
  const sourceInfo = resource.sourceInfo
  if (!sourceInfo || typeof sourceInfo !== "object") return undefined
  return stringValue((sourceInfo as Record<string, unknown>).source)
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined
}
