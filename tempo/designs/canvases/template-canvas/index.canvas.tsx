// ───────────────────────────────────────────────────────────────────────────
// Template canvas
//
// A canvas is a design surface that renders REAL React components from your app
// as "storyboards". The tempo/ folder this file lives in is an auto-generated
// dev server that POWERS the canvas — it is NOT your app. Your real app code
// lives OUTSIDE tempo/, at the project root (e.g. <projectRoot>/src/...).
//
// Two ways to put something on a canvas:
//   1. A canvas-local storyboard — isolated UI that only exists here, never
//      shipped in your app. See ./Storyboard1 below.
//   2. A REAL component imported from your app (the main, intended use): build
//      it in your app outside tempo/, then import it here to preview it. See
//      the commented example below.
//
// Note: canvas_project_init must be run before any canvas exists (it created this one).
// Create further canvases with the create-canvas tool — don't hand-write
// *.canvas.tsx files.
// ───────────────────────────────────────────────────────────────────────────

import type { TempoCanvasConfig, TempoStoryboard } from "tempo-sdk"
import Storyboard1 from "./Storyboard1"

// Example — import a REAL component from your app, which lives OUTSIDE tempo/.
// Your app is at the project root, so climb out of tempo/ to reach it. From
// tempo/designs/canvases/template-canvas/ that is four levels up:
//   import { Button } from "../../../../src/components/Button";

const config: TempoCanvasConfig = {
  name: "Template",
}

export default config

// A canvas-local storyboard: isolated, UI-only, not used by your app.
export const Example: TempoStoryboard = {
  render: () => <Storyboard1 />,
  name: "Storyboard 1 (canvas-local example)",
  layout: { x: 0, y: 0, width: 480, height: 320 },
}

// Example of projecting a REAL component from your app onto the canvas.
// Uncomment after adding the import above and having that component in your app:
// export const RealButton: TempoStoryboard = {
//   render: () => <Button>Click me</Button>,
//   name: "Button (from your app)",
//   layout: { x: 0, y: 380, width: 240, height: 120 },
// };
