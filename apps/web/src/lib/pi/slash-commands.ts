import type {
  ChatResourcesResponse,
  ChatSlashCommandInfo,
} from "@workspace/hax-design/lib/pi/chat-protocol"

/**
 * Discovery-only builtins for the InputBar slash menu.
 * Selecting an item inserts the command into the input; execution backends
 * for packages/OAuth/compact/reload are intentionally not shipped yet.
 */
export const WEB_BUILTIN_SLASH_COMMANDS: Array<ChatSlashCommandInfo> = [
  {
    name: "model",
    description: "Select provider/model or thinking level",
    argumentHint: "[provider/id[:thinking]]",
    source: "builtin",
  },
  {
    name: "models",
    description: "Open model allowlist settings",
    source: "builtin",
  },
  {
    name: "scoped-models",
    description: "Open model allowlist settings",
    source: "builtin",
  },
  {
    name: "settings",
    description: "Open Pi settings",
    source: "builtin",
  },
  {
    name: "new",
    description: "Start a new chat session",
    source: "builtin",
  },
  {
    name: "session",
    description: "Show current session metadata",
    source: "builtin",
  },
  {
    name: "config",
    description: "Open package configuration",
    source: "builtin",
  },
]

const WEB_BUILTIN_COMMAND_NAMES = new Set(
  WEB_BUILTIN_SLASH_COMMANDS.map((command) => command.name)
)

export function isWebBuiltinSlashCommand(commandName: string) {
  return WEB_BUILTIN_COMMAND_NAMES.has(commandName)
}

export function parseSlashInput(message: string) {
  const match = message.trim().match(/^\/(\S+)(?:\s+(.*))?$/)
  if (!match) return null
  const [, command = "", rawArgs = ""] = match
  return {
    command,
    args: rawArgs.trim(),
  }
}

export type SlashCommandSuggestion = {
  id: string
  label: string
  value: string
  description?: string
}

function normalizeSlashCommandName(name: string) {
  const normalized = name.trim().replace(/\s+/g, "-")
  return /^[\w.-]+$/.test(normalized) ? normalized : ""
}

/**
 * Prefer API command catalog when present; otherwise fall back to builtins
 * (and optional skill/prompt slash commands when enabled).
 */
export function buildSlashCommands(
  resources: ChatResourcesResponse | null,
  enabled: boolean,
  commandsData?: {
    commands: Array<{
      name: string
      description?: string
      argumentHint?: string
    }>
  }
): Array<SlashCommandSuggestion> {
  if (commandsData && commandsData.commands.length > 0) {
    return commandsData.commands.map((command) => ({
      id: command.name,
      label: `/${command.name}`,
      value: `/${command.name}${command.argumentHint ? ` ${command.argumentHint}` : ""} `,
      description: command.description,
    }))
  }

  const builtins = WEB_BUILTIN_SLASH_COMMANDS.map((command) => ({
    id: command.name,
    label: `/${command.name}`,
    value: `/${command.name}${command.argumentHint ? ` ${command.argumentHint}` : ""} `,
    description: command.description,
  }))

  if (!enabled || !resources) return builtins

  const resourceCommands = [...resources.skills, ...resources.prompts]
    .filter(
      (resource) =>
        !resource.activationStatus || resource.activationStatus === "active"
    )
    .map((resource) => {
      const commandName = normalizeSlashCommandName(resource.name)
      if (!commandName) return null
      return {
        id: commandName,
        label: `/${commandName}`,
        value: `/${commandName} `,
        description: resource.description,
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  return Array.from(
    new Map(
      [...builtins, ...resourceCommands].map((item) => [item.id, item])
    ).values()
  )
}
