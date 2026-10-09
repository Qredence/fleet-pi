import { describe, expect, it } from "vitest"
import {
  serializeProjectSettingsPreservingFormat,
  settingsValuesEqual,
} from "../project-settings-format"

const COMMITTED_STYLE = `{
  "packages": [
    "npm:pi-autoresearch",
    "npm:pi-skill-palette",
    "npm:pi-autocontext",
    "npm:pi-web-access"
  ],
  "skills": ["../agent-workspace/pi/skills"],
  "extensions": ["../agent-workspace/pi/extensions/enabled"],
  "prompts": ["../agent-workspace/pi/prompts"],
  "defaultThinkingLevel": "high"
}
`

describe("settingsValuesEqual", () => {
  it("treats object key order as insignificant", () => {
    expect(settingsValuesEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
  })

  it("treats array order as significant", () => {
    expect(settingsValuesEqual(["a", "b"], ["b", "a"])).toBe(false)
  })

  it("compares nested structures deeply", () => {
    expect(
      settingsValuesEqual(
        { packages: ["npm:a", { source: "npm:b" }] },
        { packages: ["npm:a", { source: "npm:b" }] }
      )
    ).toBe(true)
    expect(settingsValuesEqual({ a: 1 }, { a: 2 })).toBe(false)
    expect(settingsValuesEqual({ a: 1 }, undefined)).toBe(false)
  })
})

describe("serializeProjectSettingsPreservingFormat", () => {
  it("returns byte-identical output when content is unchanged", () => {
    const next = JSON.parse(COMMITTED_STYLE) as Record<string, unknown>
    expect(
      serializeProjectSettingsPreservingFormat(COMMITTED_STYLE, next)
    ).toBe(COMMITTED_STYLE)
  })

  it("returns byte-identical output when only key order differs", () => {
    const next = {
      defaultThinkingLevel: "high",
      prompts: ["../agent-workspace/pi/prompts"],
      extensions: ["../agent-workspace/pi/extensions/enabled"],
      skills: ["../agent-workspace/pi/skills"],
      packages: [
        "npm:pi-autoresearch",
        "npm:pi-skill-palette",
        "npm:pi-autocontext",
        "npm:pi-web-access",
      ],
    }
    expect(
      serializeProjectSettingsPreservingFormat(COMMITTED_STYLE, next)
    ).toBe(COMMITTED_STYLE)
  })

  it("updates a changed scalar while keeping array wrapping and trailing newline", () => {
    const next = {
      ...(JSON.parse(COMMITTED_STYLE) as Record<string, unknown>),
      defaultThinkingLevel: "medium",
    }
    expect(
      serializeProjectSettingsPreservingFormat(COMMITTED_STYLE, next)
    ).toBe(
      COMMITTED_STYLE.replace(
        '"defaultThinkingLevel": "high"',
        '"defaultThinkingLevel": "medium"'
      )
    )
  })

  it("keeps short changed arrays inline when the line fits", () => {
    const source = '{\n  "skills": ["../agent-workspace/pi/skills"]\n}\n'
    const next = {
      skills: ["../agent-workspace/pi/skills", "../agent-workspace/pi/extra"],
    }
    expect(serializeProjectSettingsPreservingFormat(source, next)).toBe(
      '{\n  "skills": ["../agent-workspace/pi/skills", "../agent-workspace/pi/extra"]\n}\n'
    )
  })

  it("wraps long changed arrays one element per line with the detected indent", () => {
    const source = '{\n  "skills": ["../agent-workspace/pi/skills"]\n}\n'
    const next = {
      skills: [
        "../agent-workspace/pi/skills",
        "../agent-workspace/pi/a-very-long-skill-path-that-does-not-fit-inline",
        "../agent-workspace/pi/another-very-long-skill-path-inline",
      ],
    }
    expect(serializeProjectSettingsPreservingFormat(source, next)).toBe(
      [
        "{",
        '  "skills": [',
        '    "../agent-workspace/pi/skills",',
        '    "../agent-workspace/pi/a-very-long-skill-path-that-does-not-fit-inline",',
        '    "../agent-workspace/pi/another-very-long-skill-path-inline"',
        "  ]",
        "}",
        "",
      ].join("\n")
    )
  })

  it("appends new keys with the detected indent before the closing brace", () => {
    const source = '{\n  "skills": ["../agent-workspace/pi/skills"]\n}\n'
    const next = {
      skills: ["../agent-workspace/pi/skills"],
      defaultThinkingLevel: "high",
    }
    expect(serializeProjectSettingsPreservingFormat(source, next)).toBe(
      '{\n  "skills": ["../agent-workspace/pi/skills"],\n  "defaultThinkingLevel": "high"\n}\n'
    )
  })

  it("drops keys that are absent from the next content", () => {
    const next = JSON.parse(COMMITTED_STYLE) as Record<string, unknown>
    delete next.prompts
    expect(
      serializeProjectSettingsPreservingFormat(COMMITTED_STYLE, next)
    ).toBe(
      COMMITTED_STYLE.replace(
        '  "prompts": ["../agent-workspace/pi/prompts"],\n',
        ""
      )
    )
  })

  it("preserves a four-space indent style", () => {
    const source = '{\n    "skills": ["a"]\n}\n'
    const next = { skills: ["a"], defaultThinkingLevel: "low" }
    expect(serializeProjectSettingsPreservingFormat(source, next)).toBe(
      '{\n    "skills": ["a"],\n    "defaultThinkingLevel": "low"\n}\n'
    )
  })

  it("preserves a missing trailing newline", () => {
    const source = '{\n  "skills": ["a"]\n}'
    const next = { skills: ["a"], defaultThinkingLevel: "low" }
    expect(serializeProjectSettingsPreservingFormat(source, next)).toBe(
      '{\n  "skills": ["a"],\n  "defaultThinkingLevel": "low"\n}'
    )
  })

  it("fills an empty object preserving style", () => {
    expect(
      serializeProjectSettingsPreservingFormat("{}", {
        packages: ["npm:pi-autocontext"],
      })
    ).toBe('{\n  "packages": ["npm:pi-autocontext"]\n}')
  })

  it("serializes from scratch when no source exists", () => {
    expect(
      serializeProjectSettingsPreservingFormat(undefined, {
        skills: ["a"],
      })
    ).toBe('{\n  "skills": [\n    "a"\n  ]\n}\n')
  })

  it("falls back to normalized output when the source is not valid JSON", () => {
    expect(
      serializeProjectSettingsPreservingFormat("not json", { skills: ["a"] })
    ).toBe('{\n  "skills": [\n    "a"\n  ]\n}\n')
  })
})
