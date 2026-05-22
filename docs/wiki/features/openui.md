# OpenUI inline renderer

Fleet Pi can render interactive UI components directly inside chat messages. When Pi wraps output in a ` ```openui ` fenced block, the browser parses it with `@openuidev/react-lang` and renders live React components in place of the raw text block.

## What OpenUI is

OpenUI Lang is a token-efficient DSL for generating UI from a language model. A program is a small sequence of variable assignments where each value is a component constructor call:

```openui
root = Root([summary, actions])
summary = Card("Status", Stack([ok, note]))
ok = Badge("Tests passing", "success")
note = Text("3 of 3 suites green.", "muted")
actions = Group([run, skip])
run = Button("Re-run tests", "Run the test suite again")
skip = Button("Skip", "Skip this step", "outline")
```

Programs are declarative and stateless from Pi's point of view. State lives in the React renderer.

## Integration with chat

````mermaid
flowchart LR
    Pi["Pi assistant message"] -->|contains ```openui block| Segment["segmentOpenUIContent()"]
    Segment -->|openui segment| OpenUIBlock["<OpenUIBlock>"]
    Segment -->|markdown segment| Markdown["<Markdown>"]
    OpenUIBlock --> Renderer["@openuidev/react-lang Renderer"]
    Renderer --> Library["openUILibrary (shadcn components)"]
    Renderer -->|action event| onOpenUIAction["sendMessage()"]
````

The assistant message text is passed to `GenerativeTextRenderer` (`apps/web/src/components/openui/openui-renderer.tsx`), which:

1. Calls `segmentOpenUIContent` to split the text into alternating markdown and openui segments.
2. Renders markdown segments with the existing `<Markdown>` component.
3. Renders openui segments with `<OpenUIBlock>`, which wraps the `@openuidev/react-lang` `<Renderer>`.

If the entire message is plain markdown (no openui segments), `GenerativeTextRenderer` renders it directly without going through the segmenter.

### Segmentation rules (`openui-utils.ts`)

- A ` ```openui ` or ` ```openui-lang ` fenced block whose body starts with `root =` is treated as an OpenUI program.
- If the entire message matches that pattern it is treated as a single openui segment.
- Otherwise the message is split at each fenced block. Fenced blocks that do not start with `root =` fall back to markdown.
- Mixed content (prose + openui) renders both parts in document order.

### Streaming support

`GenerativeTextRenderer` passes `isStreaming` through to each `<OpenUIBlock>`. While streaming, `getFinalErrors` suppresses unresolved-reference errors so partially-written programs do not flash error states. Error reporting is deferred until the `done` event arrives and `isStreaming` is false.

### Action events

When the user clicks a `Button` inside a rendered block, `@openuidev/react-lang` fires an `ActionEvent`. The renderer converts it to a plain string message via `getActionMessage` and calls the `onOpenUIAction` prop, which is wired to `sendMessage()` in the chat hook. This lets Pi create conversational buttons that send a follow-up without the user having to type.

Only `ContinueConversation` actions produce messages. `OpenUrl` actions are silently ignored. Destructive action types (`Query`, `Mutation`) are blocked at the prompt level.

### Per-block state

Each `<OpenUIBlock>` has a stable `blockId` (`<messageId>:<segmentIndex>`). State updates from the `Renderer` are stored in a `Record<blockId, state>` map on `GenerativeTextRenderer`, so interactive components (e.g. progress bars, inputs) keep their state even if the parent re-renders.

## Component library (`openui-library.tsx`)

The library is built with `createLibrary` and registered in `@openuidev/react-lang`. All components map to existing shadcn/ui primitives from `@workspace/ui`.

| Component     | Description                                                            |
| ------------- | ---------------------------------------------------------------------- |
| `Root`        | Top-level container — every program must start with `root = Root(...)` |
| `Stack`       | Flexbox layout, vertical or horizontal                                 |
| `Grid`        | CSS grid layout                                                        |
| `Group`       | Wrapping horizontal group for badges or buttons                        |
| `Divider`     | Horizontal rule with optional label                                    |
| `Heading`     | h1–h4 heading                                                          |
| `Text`        | Body text with tone and size variants                                  |
| `Badge`       | Small status badge                                                     |
| `Button`      | Conversational button — fires a `ContinueConversation` action          |
| `Input`       | Display-only text input (for form mockups)                             |
| `Card`        | Chat-sized card container                                              |
| `Callout`     | Highlighted note, warning, or error block                              |
| `KeyValue`    | Single label / value row                                               |
| `Metric`      | Compact KPI card                                                       |
| `ProgressBar` | Progress indicator                                                     |
| `List`        | Bulleted or numbered list                                              |
| `CodeBlock`   | Preformatted code or command output                                    |
| `Table`       | Small data table                                                       |
| `BarChart`    | Bar chart powered by Recharts                                          |

All component props are validated at parse time with Zod schemas. Unknown component names or named arguments cause a parse error surfaced by `<OpenUIDiagnostics>`.

## Prompt builder (`openui-prompt.ts`)

Before each turn, the server calls `buildOpenUIPrompt(mode)` and injects the result into Pi's system instructions. The prompt contains:

1. A preamble explaining that OpenUI blocks can appear inline.
2. Base rules (fence syntax, positional arguments, component-list constraint, prefer markdown for prose).
3. Mode-specific rules:
   - **Agent/harness mode** — encourages using OpenUI for dashboards, status cards, result summaries, and safe conversational buttons; bars destructive actions.
   - **Plan mode** — restricts OpenUI to optional visual summaries and disables buttons.
4. Two canonical examples (status card and conversational action row).

The component signatures embedded in the prompt come from `openUILibrary.prompt(...)`, which serialises each component's name, description, and Zod schema into a compact format Pi can follow.

## Error handling

`<OpenUIBlock>` tracks two error sources independently:

- **Runtime errors** from the `Renderer` itself (e.g. prop type mismatches caught at runtime).
- **Parse/validation errors** from the `ParseResult` via `onParseResult`, including unresolved references.

Both are merged and passed to `<OpenUIDiagnostics>`, which renders a collapsible error panel showing the human-readable messages, the full JSON error list, and the raw OpenUI source. This makes it easy to diagnose problems with a generated program without leaving the chat.

## Key source files

| File                                                 | Role                                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| `apps/web/src/components/openui/inline-renderer.tsx` | Re-export of `GenerativeTextRenderer` (entry point used by message rendering) |
| `apps/web/src/components/openui/openui-renderer.tsx` | `GenerativeTextRenderer`, `OpenUIBlock`, `OpenUIDiagnostics`                  |
| `apps/web/src/components/openui/openui-library.tsx`  | Component definitions and `openUILibrary` instance                            |
| `apps/web/src/components/openui/openui-prompt.ts`    | `buildOpenUIPrompt(mode)` — assembles the system prompt fragment              |
| `apps/web/src/components/openui/openui-utils.ts`     | `segmentOpenUIContent`, `stripOpenUIWrapper`, `isOpenUIProgram`               |

## Related pages

- [Chat](./chat.md)
- [Agent-elements UI components](../packages/ui/agent-elements.md)
