#!/usr/bin/env tsx
import {
  executeCommand,
  planCommand,
  statusCommand,
  validateCommand,
  type CommandOptions,
} from "./commands.js"

const COMMANDS = new Set(["plan", "execute", "status", "validate"])

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2))

  switch (command) {
    case "plan": {
      const state = await planCommand(options)
      printResult(options, {
        runId: state.runId,
        phase: state.phase,
        planPath: state.planPath,
        reportPath: state.reportPath,
      })
      return
    }
    case "execute": {
      const state = await executeCommand(options)
      printResult(options, {
        runId: state.runId,
        phase: state.phase,
        approvedForExecution: state.approvedForExecution,
        reportPath: state.reportPath,
      })
      return
    }
    case "status": {
      printResult(options, await statusCommand(options))
      return
    }
    case "validate": {
      printResult(options, await validateCommand())
      return
    }
  }
}

export function parseArgs(args: Array<string>): {
  command: "plan" | "execute" | "status" | "validate"
  options: CommandOptions
} {
  const normalizedArgs = args.filter((arg) => arg !== "--")
  const [rawCommand, ...rest] = normalizedArgs
  const command = COMMANDS.has(rawCommand ?? "") ? rawCommand : "status"
  const remaining = command === rawCommand ? rest : args
  const options: CommandOptions = {}

  for (let index = 0; index < remaining.length; index += 1) {
    const arg = remaining[index]
    const next = remaining[index + 1]

    switch (arg) {
      case "--issue-key":
        options.issueKey = readValue(arg, next)
        index += 1
        break
      case "--issue-title":
        options.issueTitle = readValue(arg, next)
        index += 1
        break
      case "--issue-url":
        options.issueUrl = readValue(arg, next)
        index += 1
        break
      case "--message":
      case "--prompt":
        options.prompt = readValue(arg, next)
        index += 1
        break
      case "--run-id":
        options.runId = readValue(arg, next)
        index += 1
        break
      case "--workspace":
        options.workspace = readValue(arg, next)
        index += 1
        break
      case "--use-codex":
        options.useCodex = true
        break
      case "--json":
        options.json = true
        break
      default:
        if (arg.startsWith("--")) {
          throw new Error(`Unknown option: ${arg}`)
        }
    }
  }

  return {
    command: command as "plan" | "execute" | "status" | "validate",
    options,
  }
}

function readValue(flag: string, value: string | undefined) {
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`)
  }
  return value
}

function printResult(options: CommandOptions, value: unknown) {
  if (options.json) {
    console.log(JSON.stringify(value, null, 2))
    return
  }

  if (Array.isArray(value)) {
    console.log(value.length > 0 ? value.join("\n") : "No codex-v2 runs found.")
    return
  }

  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      console.log(`${key}: ${String(item)}`)
    }
    return
  }

  console.log(String(value))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
