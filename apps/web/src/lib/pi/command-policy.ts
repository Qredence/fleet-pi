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
  // Input validation: reject null/undefined and non-string inputs
  if (!command || typeof command !== "string") {
    return deny("Invalid command input.")
  }

  const trimmed = command.trim()
  if (!trimmed) return deny("Command is empty.")

  // Reject commands with control characters (except tab, newline, carriage return)
  const hasControlChars = [...trimmed].some((char) => {
    const code = char.charCodeAt(0)
    // Allow: tab (9), newline (10), carriage return (13)
    // Block: all other control characters (0-8, 11-12, 14-31, 127)
    return (
      (code >= 0 && code <= 8) ||
      code === 11 ||
      code === 12 ||
      (code >= 14 && code <= 31) ||
      code === 127
    )
  })
  if (hasControlChars) {
    return deny("Command contains invalid control characters.")
  }

  // Reject excessively long commands to prevent DoS
  if (trimmed.length > 10000) {
    return deny("Command is too long.")
  }

  if (BLOCKED_COMMAND_SEPARATORS.test(trimmed)) {
    return deny("Command separators are not allowed in Plan mode.")
  }

  if (BLOCKED_SYNTAX_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return deny(
      "Shell execution, substitution, and redirection are not allowed."
    )
  }

  const segments = parsePipelineSegments(trimmed)
  for (const segment of segments) {
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

function parsePipelineSegments(command: string): Array<string> {
  const segments: Array<string> = []
  let current = ""
  let quote: '"' | "'" | undefined
  let escaped = false

  for (const char of command) {
    if (escaped) {
      current += char
      escaped = false
      continue
    }

    if (char === "\\") {
      escaped = true
      continue
    }

    if (quote) {
      if (char === quote) {
        quote = undefined
      } else {
        current += char
      }
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (char === "|") {
      segments.push(current.trim())
      current = ""
      continue
    }

    current += char
  }

  if (current) {
    segments.push(current.trim())
  }

  return segments.filter((segment) => segment.length > 0)
}

function deny(reason: string): CommandPolicyResult {
  return { allowed: false, reason }
}
