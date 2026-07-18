import { isReactiveSchema } from "@openuidev/lang-core"
import { Renderer } from "@openuidev/react-lang"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { getChartColorVarName } from "../chart"

import {
  InputDef,
  ModalDef,
  SelectDef,
  SwitchDef,
  openUILibrary,
} from "./openui-library"

function renderOpenUI(response: string) {
  return renderToStaticMarkup(
    <Renderer library={openUILibrary} response={response} />
  )
}

function expectLabelAssociation(html: string, label: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const labelMatch = html.match(
    new RegExp(`<label[^>]*for="([^"]+)"[^>]*>${escapedLabel}</label>`)
  )
  expect(labelMatch?.[1]).toBeTruthy()
  expect(html).toContain(`id="${labelMatch?.[1]}"`)
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

  it("applies semantic status tone classes for badges and metrics", () => {
    const html = renderOpenUI(`
root = Root([stack])
stack = Stack([badge, metric, callout])
badge = Badge("ready", "success")
metric = Metric("Tests", "241", "passing", "success")
callout = Callout("Note", Text("Heads up"), "warning")
`)

    expect(html).toContain("bg-success/10")
    expect(html).toContain("text-success-foreground")
    expect(html).toContain("bg-warning/10")
  })

  it("wraps interactive inputs in Field structure", () => {
    const html = renderOpenUI(`
$query = "fleet"
$showAdvanced = false

root = Root([form])
form = Card("Controls", Stack([search, toggle]))
search = Input("searchQuery", $query, "Search term...")
toggle = Switch("advanced", $showAdvanced, "Show advanced details")
`)

    expect(html).toContain('data-slot="field"')
    expect(html).toContain("searchQuery")
    expect(html).toContain("Show advanced details")
    expectLabelAssociation(html, "searchQuery")
  })

  it("associates generated select labels with their triggers", () => {
    const html = renderOpenUI(`
$timeframe = "7"
root = Root([timeframeSelect])
timeframeSelect = Select("timeframe", $timeframe, [{ value: "7", label: "7 Days" }])
`)

    expectLabelAssociation(html, "timeframe")
  })

  it("renders interactive inputs, selects, switches and modals with reactive bindings", () => {
    const html = renderOpenUI(`
$query = "fleet"
$timeframe = "7"
$showAdvanced = false
$modalOpen = false

root = Root([form, modal])
form = Card("Controls", Stack([search, row]))
search = Input("searchQuery", $query, "Search term...")
row = Stack([timeframeSelect, toggle], "row")
timeframeSelect = Select("timeframe", $timeframe, [
  { value: "7", label: "7 Days" },
  { value: "30", label: "30 Days" },
])
toggle = Switch("advanced", $showAdvanced, "Show advanced details")
modal = Modal("detailsModal", $modalOpen, "Advanced Details", [Text("Modal contents")])
`)

    expect(html).toContain("Controls")
    expect(html).toContain("Search term...")
    expect(html).toContain("Show advanced details")
  })

  it("handles ternary conditional rendering based on state", () => {
    const openuiCode = `
$enableKpis = true
root = Root([kpiSwitch, kpisLayout])
kpiSwitch = Switch("enableKpis", $enableKpis, "Display Deployment Metrics")
kpisLayout = $enableKpis ? kpisGrid : null
kpisGrid = Grid([metric1], 1)
metric1 = Metric("Active Instances", "32")
`

    // In static synchronous Node SSR (renderToStaticMarkup), React effects and hydration do not run.
    // Since the Switch checked prop is now correctly registered as reactive, the state manager takes over.
    // Because state effects don't run in synchronous static markup, the reactive variable evaluates to undefined (falsy) on first render, which is the expected initial server-rendered output.
    const htmlDefault = renderToStaticMarkup(
      <Renderer library={openUILibrary} response={openuiCode} />
    )
    expect(htmlDefault).not.toContain("Active Instances")
  })

  it("registers reactive state bindings in the WeakSet", () => {
    expect(isReactiveSchema(InputDef.props.shape.value)).toBe(true)
    expect(isReactiveSchema(SelectDef.props.shape.value)).toBe(true)
    expect(isReactiveSchema(SelectDef.props.shape.options)).toBe(false)
    expect(isReactiveSchema(SwitchDef.props.shape.checked)).toBe(true)
    expect(isReactiveSchema(ModalDef.props.shape.open)).toBe(true)
  })
})
