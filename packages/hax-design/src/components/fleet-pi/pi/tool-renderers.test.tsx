import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { WorkspaceWriteToolRenderer } from "./tool-renderers"

function renderTone(status: "pending" | "streaming" | "success" | "error") {
  const html = renderToStaticMarkup(
    <WorkspaceWriteToolRenderer
      name="tool-workspace_write"
      input={{}}
      output={{ details: { message: "ok" } }}
      status={status}
    />
  )
  // RuntimeToolCard's outer card div carries the tone classes.
  const match = html.match(
    /class="rounded-\[12px\] border px-3 py-2\.5 shadow-sm ([^"]*)"/
  )
  return match ? match[1] : ""
}

describe("RuntimeToolCard tones", () => {
  it("error tone uses semantic destructive tokens with no rose/sky", () => {
    const tone = renderTone("error")
    expect(tone).toContain("border-destructive/30")
    expect(tone).toContain("bg-destructive/8")
    expect(tone).toContain("text-destructive-foreground")
    expect(tone).toContain("dark:text-destructive")
    expect(tone).not.toMatch(/rose|sky/)
  })

  it("running tone uses semantic info tokens with no sky/rose", () => {
    const tone = renderTone("streaming")
    expect(tone).toContain("border-info/30")
    expect(tone).toContain("bg-info/8")
    expect(tone).toContain("text-info-foreground")
    expect(tone).toContain("dark:text-info")
    expect(tone).not.toMatch(/rose|sky/)
  })

  it("neutral ready tone keeps semantic chrome unchanged", () => {
    const tone = renderTone("success")
    expect(tone).toContain("border-border/70")
    expect(tone).toContain("bg-background")
    expect(tone).toContain("text-foreground/80")
    expect(tone).not.toMatch(/rose|sky/)
  })

  it("keeps the card structure (rounded-[12px], shadow-sm)", () => {
    const html = renderToStaticMarkup(
      <WorkspaceWriteToolRenderer
        name="tool-workspace_write"
        input={{}}
        output={undefined}
        status="error"
      />
    )
    expect(html).toContain("rounded-[12px]")
    expect(html).toContain("shadow-sm")
  })
})
