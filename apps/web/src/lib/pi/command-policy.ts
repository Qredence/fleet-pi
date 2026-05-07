export type CommandPolicyResult = {
  allowed: boolean
  reason?: string
}

const BLOCKED_SYNTAX_PATTERNS = [
  /\$\(/,
  /`/,
  /(^|[^<])>(?!>)/,
  />>/,
  /<\(/,
  />\(/,
  /\b(?:bash|sh|zsh|fish)\s+-c\b/i,
  /\b(?:node|python|python3|perl|ruby)\s+-[ce]\b/i,
]

const BLOCKED_COMMAND_SEPARATORS = /(;|&&|\|\|)/

const MUTATING_COMMANDS = new Set([
  "rm",
  "rmdir",
  "mv",
  "cp",
  "mkdir",
  "touch",
  "chmod",
  "chown",
  "chgrp",
  "ln",
  "tee",
  "truncate",
  "dd",
  "shred",
  "install",
  "sudo",
  "su",
  "kill",
  "pkill",
  "killall",
  "reboot",
  "shutdown",
  "systemctl",
  "service",
  "vim",
  "vi",
  "nano",
  "emacs",
  "code",
  "subl",
])

const NETWORK_COMMANDS = new Set([
  "curl",
  "wget",
  "nc",
  "ncat",
  "telnet",
  "ssh",
  "scp",
  "sftp",
  "rsync",
])

const READ_ONLY_COMMANDS = new Set([
  "cat",
  "head",
  "tail",
  "less",
  "more",
  "grep",
  "find",
  "ls",
  "pwd",
  "echo",
  "printf",
  "wc",
  "sort",
  "uniq",
  "diff",
  "file",
  "stat",
  "du",
  "df",
  "tree",
  "which",
  "whereis",
  "type",
  "env",
  "printenv",
  "uname",
  "whoami",
  "id",
  "date",
  "cal",
  "uptime",
  "ps",
  "top",
  "htop",
  "free",
  "jq",
  "sed",
  "awk",
  "rg",
  "fd",
  "bat",
  "eza",
])

const GIT_READ_ONLY_SUBCOMMANDS = new Set([
  "status",
  "log",
  "diff",
  "show",
  "branch",
  "remote",
  "ls-files",
  "ls-tree",
])

const PACKAGE_MANAGER_READ_ONLY_SUBCOMMANDS = new Set(["list", "ls", "why"])

export function evaluatePlanCommand(command: string): CommandPolicyResult {
  const trimmed = command.trim()
  if (!trimmed) return deny("Command is empty.")

  if (BLOCKED_COMMAND_SEPARATORS.test(trimmed)) {
    return deny("Command separators are not allowed in Plan mode.")
  }

  if (BLOCKED_SYNTAX_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return deny(
      "Shell execution, substitution, and redirection are not allowed."
    )
  }

  for (const segment of trimmed.split("|").map((part) => part.trim())) {
    const result = evaluatePipelineSegment(segment)
    if (!result.allowed) return result
  }

  return { allowed: true }
}

function evaluatePipelineSegment(segment: string): CommandPolicyResult {
  const tokens = tokenizeShellLike(segment)
  const commandIndex = tokens.findIndex((token) => !isEnvAssignment(token))
  const command = tokens[commandIndex]
  if (!command) return deny("Pipeline segment is empty.")

  const commandName = normalizeCommandName(command)
  const args = tokens.slice(commandIndex + 1)

  if (MUTATING_COMMANDS.has(commandName)) {
    return deny(`${commandName} can mutate files, processes, or system state.`)
  }

  if (NETWORK_COMMANDS.has(commandName)) {
    return deny("Network commands are not allowed in Plan mode.")
  }

  if (commandName === "git") return evaluateGitCommand(args)
  if (
    commandName === "npm" ||
    commandName === "pnpm" ||
    commandName === "yarn"
  ) {
    return evaluatePackageManagerCommand(commandName, args)
  }
  if (
    commandName === "node" ||
    commandName === "python" ||
    commandName === "python3"
  ) {
    return args.length === 1 && args[0] === "--version"
      ? { allowed: true }
      : deny(`${commandName} is only allowed for version checks.`)
  }
  if (
    commandName === "find" &&
    args.some((arg) => arg === "-delete" || arg === "-exec")
  ) {
    return deny(
      "find actions that execute commands or delete files are not allowed."
    )
  }
  if (commandName === "awk" && segment.includes("system(")) {
    return deny("awk system execution is not allowed.")
  }
  if (commandName === "sed" && !args.includes("-n")) {
    return deny("sed is only allowed in non-mutating print mode.")
  }

  return READ_ONLY_COMMANDS.has(commandName)
    ? { allowed: true }
    : deny(`${commandName} is not allowed in Plan mode.`)
}

function evaluateGitCommand(args: Array<string>): CommandPolicyResult {
  const subcommand = args[0]
  if (!subcommand) return deny("git requires a read-only subcommand.")
  if (subcommand === "config" && args[1] === "--get") return { allowed: true }
  return GIT_READ_ONLY_SUBCOMMANDS.has(subcommand)
    ? { allowed: true }
    : deny(`git ${subcommand} is not allowed in Plan mode.`)
}

function evaluatePackageManagerCommand(
  commandName: string,
  args: Array<string>
): CommandPolicyResult {
  const subcommand = args[0]
  if (!subcommand)
    return deny(`${commandName} requires a read-only subcommand.`)
  return PACKAGE_MANAGER_READ_ONLY_SUBCOMMANDS.has(subcommand)
    ? { allowed: true }
    : deny(`${commandName} ${subcommand} is not allowed in Plan mode.`)
}

function tokenizeShellLike(command: string) {
  const tokens: Array<string> = []
  let current = ""
  let quote: '"' | "'" | undefined

  for (const char of command) {
    if (quote) {
      if (char === quote) quote = undefined
      else current += char
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current)
        current = ""
      }
      continue
    }

    current += char
  }

  if (current) tokens.push(current)
  return tokens
}

function normalizeCommandName(command: string) {
  return command.split("/").pop()?.toLowerCase() ?? command.toLowerCase()
}

function isEnvAssignment(token: string) {
  return /^[A-Za-z_][A-Za-z0-9_]*=/.test(token)
}

function deny(reason: string): CommandPolicyResult {
  return { allowed: false, reason }
}
