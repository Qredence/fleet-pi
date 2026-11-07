import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { GenerativeTextRenderer } from "../openui-renderer"

describe("GenerativeTextRenderer", () => {
  it("renders mixed markdown and OpenUI segments", () => {
    const html = renderToStaticMarkup(
      <GenerativeTextRenderer
        content={`Intro
\`\`\`openui
root = Root([card])
card = Card("Hello", Text("World"))
\`\`\`
Outro`}
        messageId="m1"
      />
    )

    expect(html).toContain("Intro")
    expect(html).toContain("Hello")
    expect(html).toContain("World")
    expect(html).toContain("Outro")
  })

  it("renders a bare ToAssistant button", () => {
    const html = renderToStaticMarkup(
      <GenerativeTextRenderer
        content={`\`\`\`openui
root = Root([ask])
ask = Button("Explain", @ToAssistant("Explain this chart"))
\`\`\``}
        messageId="m2"
      />
    )

    expect(html).toContain("Explain")
    expect(html).not.toContain("OpenUI Render Error")
  })
})
