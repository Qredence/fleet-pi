import { describe, expect, it } from "vitest"
import {
  WEB_BUILTIN_SLASH_COMMANDS,
  buildSlashCommands,
  isWebBuiltinSlashCommand,
  parseSlashInput,
} from "../slash-commands"

describe("slash commands", () => {
  it("lists discovery builtins without unfinished package/oauth aliases", () => {
    const names = WEB_BUILTIN_SLASH_COMMANDS.map((command) => command.name)
    expect(names).toContain("model")
    expect(names).toContain("settings")
    expect(names).toContain("new")
    expect(names).toContain("session")
    expect(names).toContain("config")
    expect(names).not.toContain("install")
    expect(names).not.toContain("login")
    expect(names).not.toContain("logout")
    expect(names).not.toContain("compact")
    expect(names).not.toContain("reload")
  })

  it("falls back to builtins when command catalog is loading or empty", () => {
    const empty = buildSlashCommands(null, true, { commands: [] })
    const loading = buildSlashCommands(null, true, undefined)
    expect(empty.map((item) => item.id)).toEqual(
      WEB_BUILTIN_SLASH_COMMANDS.map((command) => command.name)
    )
    expect(loading.map((item) => item.id)).toEqual(
      WEB_BUILTIN_SLASH_COMMANDS.map((command) => command.name)
    )
  })

  it("still returns builtins when skill commands are disabled and resources missing", () => {
    const suggestions = buildSlashCommands(null, false)
    expect(suggestions.some((item) => item.id === "model")).toBe(true)
  })

  it("uses API catalog when present", () => {
    const suggestions = buildSlashCommands(null, true, {
      commands: [
        {
          name: "fleet-pi-orientation",
          description: "Project orientation",
          argumentHint: "",
        },
      ],
    })
    expect(suggestions).toEqual([
      {
        id: "fleet-pi-orientation",
        label: "/fleet-pi-orientation",
        value: "/fleet-pi-orientation ",
        description: "Project orientation",
      },
    ])
  })

  it("parses slash input with optional args", () => {
    expect(parseSlashInput("/model google/gemini-3.5-flash:high")).toEqual({
      command: "model",
      args: "google/gemini-3.5-flash:high",
    })
    expect(parseSlashInput("  /settings  ")).toEqual({
      command: "settings",
      args: "",
    })
    expect(parseSlashInput("hello")).toBeNull()
  })

  it("detects builtin command names", () => {
    expect(isWebBuiltinSlashCommand("settings")).toBe(true)
    expect(isWebBuiltinSlashCommand("reload")).toBe(false)
    expect(isWebBuiltinSlashCommand("fleet-pi-orientation")).toBe(false)
  })
})
