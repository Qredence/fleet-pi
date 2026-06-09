import { Renderer } from "@openuidev/react-lang"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { getChartColorVarName } from "../chart"

import { openUILibrary } from "./openui-library"

function renderOpenUI(response: string) {
  return renderToStaticMarkup(
    <Renderer library={openUILibrary} response={response} />
  )
}

describe("openUILibrary", () => {
  it("renders nested child components", () => {
    const html = renderOpenUI(`
root = Root([card])
card = Card("Status", Stack([heading, body, badge]))
heading = Heading("OpenUI", 2)
body = Text("Rendered correctly.", "muted")
badge = Badge("ready", "success")
`)

    expect(html).toContain("OpenUI")
    expect(html).toContain("Rendered correctly.")
    expect(html).toContain("ready")
  })

  it("renders data display components", () => {
    const html = renderOpenUI(`
root = Root([grid])
grid = Grid([metric, kv, progress], 3)
metric = Metric("Tests", "241", "passing", "success")
kv = KeyValue("Renderer", "OpenUI")
progress = ProgressBar("Complete", 75)
`)

    expect(html).toContain("Tests")
    expect(html).toContain("Renderer")
    expect(html).toContain("75%")
  })

  it("renders tables and charts without throwing", () => {
    const html = renderOpenUI(`
root = Root([table, chart])
table = Table(["Area", "Status"], [["Prompt", "Ready"], ["Renderer", "Ready"]])
chart = BarChart("Coverage", "OpenUI checks", "area", [{dataKey: "value", label: "Checks"}], [{area: "Prompt", value: 2}, {area: "Renderer", value: 3}])
`)

    expect(html).toContain("Coverage")
    expect(html).toContain("Prompt")
  })

  it("sanitizes chart series keys for CSS variable usage", () => {
    const html = renderOpenUI(`
root = Root([chart])
chart = BarChart("Coverage", "OpenUI checks", "area", [{dataKey: "value/%", label: "Checks"}], [{area: "Prompt", "value/%": 2}, {area: "Renderer", "value/%": 3}])
`)

    expect(html).toContain("--color-value__")
    expect(getChartColorVarName("value/%")).toBe("--color-value__")
  })
})
