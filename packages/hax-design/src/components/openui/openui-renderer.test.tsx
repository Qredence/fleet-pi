import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { GenerativeTextRenderer } from "./openui-renderer"

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
})
