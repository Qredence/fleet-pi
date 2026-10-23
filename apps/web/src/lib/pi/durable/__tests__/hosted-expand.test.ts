import { describe, expect, it } from "vitest"
import { assertHttpsMcpServer, hostedMcpToolName } from "../durable-mcp"
import { selectHostedExtensions } from "../hosted-extensions"
import { toolsForChatMode } from "../spike-harness"

describe("hosted extensions, code mode, and MCP", () => {
  it("turns on a bundled extension by name and leaves unknown files unavailable", () => {
    const selected = selectHostedExtensions([
      "spike-sandbox",
      "extensions/spike-sandbox.ts",
      "extensions/vendor/filechanges.ts",
    ])
    expect(selected.enabled).toEqual(["spike-sandbox"])
    expect(selected.unavailable).toEqual(["extensions/vendor/filechanges.ts"])
  })

  it("keeps code mode and MCP off the plan tool list", () => {
    const tools = [
      { name: "read" },
      { name: "search" },
      { name: "codemode" },
      { name: "docs_list" },
    ]
    expect(
      toolsForChatMode(tools, "plan", true).map((tool) => tool.name)
    ).toEqual(["read", "search"])
    expect(
      toolsForChatMode(tools, "agent", true).map((tool) => tool.name)
    ).toEqual(["read", "search", "codemode", "docs_list"])
    expect(
      toolsForChatMode(
        tools.filter(
          (tool) => tool.name !== "codemode" && tool.name !== "docs_list"
        ),
        "agent",
        true
      ).map((tool) => tool.name)
    ).toEqual(["read", "search"])
  })

  it("refuses stdio, non-https, and private/metadata MCP servers", () => {
    expect(() =>
      assertHttpsMcpServer({ name: "local", url: "stdio://files" })
    ).toThrow(/https/)
    expect(() =>
      assertHttpsMcpServer({ name: "local", url: "http://example.com/mcp" })
    ).toThrow(/https/)
    expect(() =>
      assertHttpsMcpServer({
        name: "metadata",
        url: "https://169.254.169.254/latest/meta-data",
      })
    ).toThrow(/https/)
    expect(() =>
      assertHttpsMcpServer({
        name: "mapped-metadata",
        url: "https://[::ffff:169.254.169.254]/mcp",
      })
    ).toThrow(/https/)
    expect(() =>
      assertHttpsMcpServer({
        name: "private",
        url: "https://10.0.0.1/mcp",
      })
    ).toThrow(/https/)
    expect(() =>
      assertHttpsMcpServer({ name: "docs", url: "https://example.com/mcp" })
    ).not.toThrow()
    expect(hostedMcpToolName("docs", "search")).toBe("docs_search")
  })
})
