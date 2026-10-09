import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { ToolRenderer } from "./tool-renderer"
import type { CustomToolRendererProps } from "../types"

function MarkerRenderer({ name, status }: CustomToolRendererProps) {
  return <div data-testid={`custom-${name}`}>{`${name}:${status}`}</div>
}

const toolRenderers = {
  project_inventory: MarkerRenderer,
}

describe("ToolRenderer custom-renderer dispatch", () => {
  it("routes plain fleet-pi tool parts (no mcp__ prefix) to the custom renderer map", () => {
    const html = renderToStaticMarkup(
      <ToolRenderer
        part={{
          type: "tool-project_inventory",
          toolCallId: "t1",
          state: "output-available",
          input: {},
          output: { details: {} },
        }}
        toolRenderers={toolRenderers}
      />
    )
    expect(html).toContain('data-testid="custom-project_inventory"')
    expect(html).toContain("project_inventory:success")
  })

  it("passes pending status through to the custom renderer", () => {
    const html = renderToStaticMarkup(
      <ToolRenderer
        part={{
          type: "tool-project_inventory",
          toolCallId: "t2",
          state: "input-streaming",
          input: {},
        }}
        toolRenderers={toolRenderers}
      />
    )
    expect(html).toContain("project_inventory:streaming")
  })

  it("keeps tool-mcp__* parts on the generic MCP path", () => {
    const html = renderToStaticMarkup(
      <ToolRenderer
        part={{
          type: "tool-mcp__postgres__query",
          toolCallId: "t3",
          state: "output-available",
          input: { query: "select 1" },
          output: { content: "" },
        }}
        toolRenderers={toolRenderers}
      />
    )
    expect(html).toContain("an-tool-mcp")
    expect(html).not.toContain("custom-mcp__postgres__query")
  })

  it("falls back to the generic tool when no custom renderer matches", () => {
    const html = renderToStaticMarkup(
      <ToolRenderer
        part={{
          type: "tool-project_inventory",
          toolCallId: "t4",
          state: "output-available",
          input: {},
        }}
      />
    )
    expect(html).not.toContain("data-testid")
  })
})
