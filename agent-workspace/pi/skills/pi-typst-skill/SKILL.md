---
name: typst-markup
description: Write, convert, and review Typst markup in pi coding agent and other coding-agent sessions. Use when the user asks for Typst, .typ files, replacing Markdown with Typst, creating reports, specs, handouts, papers, templates, or docs in Typst, converting Markdown documentation to Typst, packaging Typst guidance as a pi skill, or configuring coding agents to prefer Typst output instead of Markdown for document artifacts.
---

# Typst Markup

## Pi Package Context

This skill is designed for pi coding agent packages. In pi, it is loaded from the package manifest in `package.json` via:

```json
{
  "pi": {
    "skills": ["./typst-markup"]
  }
}
```

When active in pi, favor creating or editing `.typ` files for document artifacts. Do not assume that a TypeScript extension is available; this package is a skills-only package unless the repository adds `extensions/` later.

## Operating Mode

When this skill is active, treat Typst as the default authoring format for document-like artifacts.

- Create or edit `.typ` files instead of `.md` files unless the user explicitly asks for Markdown or an existing tool requires Markdown.
- For chat responses, use the host application's normal response format if needed, but put deliverable document content in Typst syntax or write it to a `.typ` file.
- Respect existing repository conventions. If the project already has Typst templates, imports, package pins, or style files, reuse them before inventing new structure.
- Prefer simple Typst markup for prose. Use functions only when markup syntax is insufficient, such as tables, figures, layout, reusable components, or styling.
- Avoid Markdown-only constructs in generated Typst documents: Markdown tables, `#` headings, `**bold**`, `[text](url)`, HTML blocks, YAML frontmatter, and GitHub task lists.

## Workflow

1. Determine whether the user needs a final `.typ` artifact, an inline Typst snippet, a conversion, or a coding-agent instruction.
2. Inspect nearby files for Typst style, imports, helper functions, and output conventions.
3. Write idiomatic Typst with a small preamble only when useful. Do not add heavy styling unless the user requested a designed document.
4. If converting Markdown, preserve semantic structure first: headings, lists, code blocks, links, tables, math, figures, labels, and cross-references.
5. Validate with `typst compile <file.typ>` when the Typst CLI is available. If it is not available, do a syntax review and say that compilation was not run.

## Default Typst Patterns

Use these defaults unless the repo or user request indicates otherwise:

```typ
#set page(margin: 2.5cm)
#set heading(numbering: "1.")

= Title

Introductory text with *strong emphasis*, _emphasis_, `inline code`, and
#link("https://typst.app")[a named link].

== Section

- Bullet item
- Another item

+ Numbered item
+ Another numbered item
```

For tables, do not attempt Markdown pipe tables. Use `table`:

```typ
#table(
  columns: (1fr, 2fr),
  table.header([*Name*], [*Purpose*]),
  [Skill], [Prefer Typst for document artifacts],
  [Validation], [Compile with the Typst CLI when available],
)
```

For code samples inside Typst documents, use raw blocks with language tags:

````typ
```rust
fn main() {
  println!("Hello, Typst!");
}
```
````

## Reference

Read `references/typst-cheatsheet.md` when you need syntax details, Markdown-to-Typst mappings, examples for tables/figures/math/references, or validation guidance.
