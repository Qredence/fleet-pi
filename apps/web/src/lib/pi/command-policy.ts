import { classifyToolPath } from "../../../../../.pi/extensions/lib/mutation-tier"

export type CommandPolicyResult = {
  allowed: boolean
  reason?: string
}

const PROTECTED_WORKSPACE_MENTION =
  /agent-workspace\/(?:system|evals)\b|(?:^|[\s;&|()])(?:system|evals)\b|\/(?:system|evals)\//

const BASH_PROTECTED_MUTATION_HINT =
  /\b(rm|rmdir|mv|cp|install|sed|tee|chmod|truncate|python|node|perl|ruby|php|awk|git|xargs|env)\b/i

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

/**
 * Path arguments of mutating commands, plus redirection targets.
 * Agent mode uses this to keep `system/` and `evals/` off raw bash.
 */
export function listMutatingCommandTargets(command: string): Array<string> {
  if (!command || typeof command !== "string") return []

  const targets: Array<string> = []
  for (const clause of splitShellClauses(command)) {
    const tokens = tokenizeShellLike(clause)
    let commandName: string | undefined
    let expectingRedirect = false
    for (const token of tokens) {
      if (!commandName && isEnvAssignment(token)) continue
      const redirectTarget = redirectionTarget(token)
      if (redirectTarget === "pending") {
        expectingRedirect = true
        continue
      }
      if (redirectTarget) {
        targets.push(redirectTarget)
        continue
      }
      if (expectingRedirect) {
        targets.push(token)
        expectingRedirect = false
        continue
      }
      if (!commandName) {
        commandName = normalizeCommandName(token)
        continue
      }
      if (MUTATING_COMMANDS.has(commandName) && !token.startsWith("-")) {
        targets.push(token)
      }
    }
    targets.push(...inPlaceEditTargets(commandName, tokens))
  }
  return targets
}

/**
 * Catches bash shapes that mention `system/` or `evals/` but evade token
 * extraction (interpreters, wrappers, or `cd` + relative targets).
 */
export function bashEvasionTargetsProtectedWorkspace(command: string): boolean {
  const normalized = command.replace(/\\/g, "/")
  if (!PROTECTED_WORKSPACE_MENTION.test(normalized)) return false

  for (const target of listMutatingCommandTargets(command)) {
    const classified = classifyToolPath(target)
    if (classified.scoped && classified.tier === "protected") {
      return false
    }
  }

  return BASH_PROTECTED_MUTATION_HINT.test(normalized)
}

/**
 * `sed` without `-n` and `find -delete` / `-exec` edit files, but they are
 * not in the mutating-command set because Plan mode allows their read forms.
 */
function inPlaceEditTargets(
  commandName: string | undefined,
  tokens: Array<string>
): Array<string> {
  if (!commandName) return []
  const args = tokens.slice(1).filter((token) => !isEnvAssignment(token))
  const findDeletes =
    commandName === "find" &&
    args.some((arg) => arg === "-delete" || arg === "-exec")
  const sedEdits =
    commandName === "sed" &&
    !args.some((arg) => arg === "-n" || arg.startsWith("-n"))
  const editsInPlace = findDeletes || sedEdits
  if (!editsInPlace) return []
  return args.filter((arg) => !arg.startsWith("-"))
}

function redirectionTarget(token: string): string | "pending" | undefined {
  if (token === ">" || token === ">>") return "pending"
  if (token.startsWith(">>") && token.length > 2) return token.slice(2)
  if (token.startsWith(">") && token.length > 1) return token.slice(1)
  return undefined
}

function splitShellClauses(command: string): Array<string> {
  const clauses: Array<string> = []
  let current = ""
  let quote: '"' | "'" | undefined

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index] ?? ""
    if (quote) {
      current += char
      if (char === quote) quote = undefined
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      current += char
      continue
    }
    const isAnd = char === "&" && command[index + 1] === "&"
    if (char === ";" || char === "|" || isAnd) {
      if (isAnd) index += 1
      const trimmed = current.trim()
      if (trimmed) clauses.push(trimmed)
      current = ""
      continue
    }
    current += char
  }

  const trimmed = current.trim()
  if (trimmed) clauses.push(trimmed)
  return clauses
}

export function evaluatePlanCommand(command: string): CommandPolicyResult {
  // Input validation: reject null/undefined and non-string inputs
  if (!command || typeof command !== "string") {
    return deny("Invalid command input.")
  }

  const trimmed = command.trim()
  if (!trimmed) return deny("Command is empty.")

  // Plan mode must never accept shell command termination or other controls.
  const hasControlChars = [...trimmed].some((char) => {
    const code = char.charCodeAt(0)
    // Allow tab for ordinary argument separation. Newline and carriage return
    // are command separators and therefore must be rejected.
    return (
      (code >= 0 && code <= 8) ||
      code === 10 ||
      code === 11 ||
      code === 12 ||
      code === 13 ||
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

/**
 * Agent-mode tiers for the Pi Durable spike. Protected paths stay blocked.
 * Rationale-required paths stay blocked until a later issue carries a rationale.
 */
export function agentWorkspaceMutationBlock(path: string): string | undefined {
  const classified = classifyToolPath(path)
  if (!classified.scoped) return undefined
  switch (classified.tier) {
    case "free":
      return undefined
    case "protected":
      return `protected ${classified.relativePath}`
    case "rationale-required":
      return `${classified.relativePath} without a rationale`
    default: {
      const exhaustive: never = classified.tier
      return exhaustive
    }
  }
}

export function agentWorkspaceBashBlock(command: string): string | undefined {
  if (bashEvasionTargetsProtectedWorkspace(command)) {
    return "protected system/** or evals/**"
  }
  for (const target of listMutatingCommandTargets(command)) {
    const block = agentWorkspaceMutationBlock(target)
    if (block) return block
  }
  return undefined
}
