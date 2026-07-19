import {
  WEB_BUILTIN_SLASH_COMMANDS,
  isWebBuiltinSlashCommand,
} from "../slash-commands"
import { createSessionServices } from "./session-factory"
import type { ChatSlashCommandInfo } from "@workspace/pi-protocol/chat-protocol"
import type { AppRuntimeContext } from "@/lib/app-runtime"

export async function loadChatCommands(
  context: AppRuntimeContext,
  options?: { userId?: string }
) {
  const services = await createSessionServices(context, undefined, {
    userId: options?.userId,
    projectRoot: context.projectRoot,
  })
  const diagnostics: Array<string> = []
  const commands = new Map<string, ChatSlashCommandInfo>()

  for (const command of WEB_BUILTIN_SLASH_COMMANDS) {
    commands.set(command.name, command)
  }

  const enableSkillCommands = services.settingsManager.getEnableSkillCommands()
  if (!enableSkillCommands) {
    diagnostics.push(
      "Skill slash commands are disabled in project Pi settings."
    )
  } else {
    for (const skill of services.resourceLoader.getSkills().skills) {
      const name = normalizeCommandName(skill.name)
      if (!name || isWebBuiltinSlashCommand(name)) continue
      commands.set(name, {
        name,
        description: skill.description,
        source: "skill",
        passThrough: true,
      })
    }

    for (const prompt of services.resourceLoader.getPrompts().prompts) {
      const name = normalizeCommandName(prompt.name)
      if (!name || isWebBuiltinSlashCommand(name)) continue
      commands.set(name, {
        name,
        description: prompt.description,
        source: "prompt",
        passThrough: true,
      })
    }
  }

  return {
    commands: [...commands.values()].sort((left, right) =>
      left.name.localeCompare(right.name)
    ),
    diagnostics,
  }
}

function normalizeCommandName(name: string) {
  const normalized = name.trim().replace(/\s+/g, "-")
  return /^[\w.-]+$/.test(normalized) ? normalized : ""
}
