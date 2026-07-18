import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { NumberField } from "./fields"

describe("NumberField", () => {
  it("associates its visible label with the input", () => {
    const html = renderToStaticMarkup(
      <NumberField label="Retry count" min={0} value={2} onChange={vi.fn()} />
    )
    const labelMatch = html.match(
      /<label[^>]*for="([^"]+)"[^>]*>Retry count<\/label>/
    )

    expect(labelMatch?.[1]).toBeTruthy()
    expect(html).toContain(`id="${labelMatch?.[1]}"`)
  })
})
