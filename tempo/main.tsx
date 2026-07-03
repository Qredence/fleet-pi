import { createRoot } from "react-dom/client"
import "./globals.css"
import TempoHost from "./.tempo/tempo-host"

// This is the Tempo canvas dev server ("tempo-host"). It exists only to render
// your real components onto the design canvas — it is NOT your app. Build your
// actual app OUTSIDE the tempo/ folder, at the project root (e.g. src/...).
//
// Deliberately NOT wrapped in <StrictMode>: the host mounts every storyboard as
// its own full production component tree (often dozens of live frames), and
// StrictMode's dev-only double-invoke of every render + mount effect roughly
// doubles that mount cost — a real, visible "the canvas takes a while to load"
// hit. StrictMode renders nothing and is dev-only, so omitting it here is purely
// a canvas load-time win with zero visual or production impact. Your real app
// (outside tempo/) keeps whatever StrictMode setup it already had.
createRoot(document.getElementById("root")!).render(<TempoHost />)
