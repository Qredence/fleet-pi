/* THIS FILE IS AUTO-GENERATED. DO NOT EDIT. */

import React, {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"

/**
 * Component host is intentionally small.
 *
 * The generated .tempo directory has two separate responsibilities:
 *
 * 1. component-host.tsx, this file, is the stable renderer runtime. It owns
 *    the message protocol, the list of active render slots, and the React tree
 *    that displays those slots.
 * 2. component-registry.ts is the volatile file. It imports project canvas
 *    files and calls registerCanvasLoaders(...). Reconcile and HMR should be
 *    able to replace that registry module without replacing this host module.
 *
 * Keeping those roles separate is the main invariant of this file. If a change
 * would make component-host.tsx depend on the current list of canvases or
 * storyboard exports, that change belongs in component-registry.ts instead.
 */

// ---------------------------------------------------------------------------
// Problem Slots
// ---------------------------------------------------------------------------
//
// Error capture writes to these slots. Health checks read these slots. The host
// does not render any error UI; the parent canvas owns all presentation.

type ProblemSourceKind =
  | "render-error-boundary"
  | "page-error"
  | "unhandled-rejection"
  | "resource-load"
  | "vite-overlay"
  | "vite-hmr-error"
  | "console-vite-error"
  | "runtime-bootstrap"

type RuntimeProblem = {
  sourceKind: ProblemSourceKind
  message: string
  stack?: string
  componentStack?: string
  filename?: string
  line?: number
  column?: number
  frameUrl?: string
  frameId?: number
  timestamp: number
}

type ProblemSnapshot = {
  hostProblem?: RuntimeProblem
  componentProblems: Array<{ renderId: string; problem: RuntimeProblem }>
}

// Mirrors HealthSnapshot in error-tracking/protocol.ts. Answered by the
// query-health handler and consumed only by the renderer-side error-clear
// watchdog.
type HealthSnapshot = {
  alive: boolean
  reactConnected: boolean
  documentReadyState: DocumentReadyState
  hasViteOverlayElement: boolean
  lastHostRenderCommitAt: number | null
  lastClaimRenderCommitAt: number | null
  lastHostSourceAnnotatedCommitAt: number | null
  lastClaimSourceAnnotatedCommitAt: number | null
  renderSlotExists: boolean
  renderSlotHasSourceAnnotatedContent: boolean
  renderSlotObservedSourceFiles: string[]
  claimErrorBoundaryTripped: boolean
  observedAt: number
}

type ProblemWatcher = (problem: RuntimeProblem | undefined) => void
type ProblemSnapshotWatcher = (snapshot: ProblemSnapshot) => void

const problemSnapshotWatchers = new Set<ProblemSnapshotWatcher>()

class ProblemSlot {
  private current: RuntimeProblem | undefined = undefined
  private watchers = new Set<ProblemWatcher>()

  report(problem: RuntimeProblem): void {
    this.current = problem
    this.publish()
  }

  clear(sourceKinds?: readonly ProblemSourceKind[]): void {
    if (
      sourceKinds &&
      this.current &&
      !sourceKinds.includes(this.current.sourceKind)
    ) {
      return
    }
    this.current = undefined
    this.publish()
  }

  get(): RuntimeProblem | undefined {
    return this.current
  }

  watch(watcher: ProblemWatcher): () => void {
    this.watchers.add(watcher)
    watcher(this.current)

    return () => {
      this.watchers.delete(watcher)
    }
  }

  private publish(): void {
    for (const watcher of this.watchers) {
      watcher(this.current)
    }
  }
}

const hostProblemSlot = new ProblemSlot()
const componentProblemSlots = new Map<
  string,
  { slot: ProblemSlot; stopWatching: () => void }
>()

const ensureComponentProblemSlot = (renderId: string): ProblemSlot => {
  const existing = componentProblemSlots.get(renderId)?.slot
  if (existing) return existing

  const slot = new ProblemSlot()
  componentProblemSlots.set(renderId, {
    slot,
    stopWatching: slot.watch(() => publishProblemSnapshot()),
  })
  return slot
}

const deleteComponentProblemSlot = (renderId: string): void => {
  const entry = componentProblemSlots.get(renderId)
  if (entry?.slot.get()?.sourceKind === "render-error-boundary") {
    recordRenderRecoveryDebug("latched-slot-deleted", { renderId })
  }
  entry?.stopWatching()
  componentProblemSlots.delete(renderId)
  publishProblemSnapshot()
}

const createProblem = (
  sourceKind: ProblemSourceKind,
  error: unknown,
  componentStack?: string
): RuntimeProblem => ({
  sourceKind,
  message: error instanceof Error ? error.message : String(error),
  stack: error instanceof Error ? error.stack : undefined,
  componentStack,
  frameUrl: typeof window === "undefined" ? undefined : window.location.href,
  timestamp: Date.now(),
})

const reportHostProblem = (
  sourceKind: ProblemSourceKind,
  error: unknown,
  details: Partial<
    Pick<
      RuntimeProblem,
      "stack" | "filename" | "line" | "column" | "frameUrl" | "frameId"
    >
  > = {}
): void => {
  hostProblemSlot.report({ ...createProblem(sourceKind, error), ...details })
}

const reportComponentProblem = (
  renderId: string,
  sourceKind: ProblemSourceKind,
  error: unknown,
  componentStack?: string
): void => {
  ensureComponentProblemSlot(renderId).report(
    createProblem(sourceKind, error, componentStack)
  )
  if (sourceKind === "render-error-boundary") {
    recordRenderRecoveryDebug("boundary-latched", { renderId })
  }
}

const clearHostProblem = (sourceKinds?: readonly ProblemSourceKind[]): void => {
  hostProblemSlot.clear(sourceKinds)
}

const clearComponentProblem = (renderId: string): void => {
  componentProblemSlots.get(renderId)?.slot.clear()
}

// ---------------------------------------------------------------------------
// Commit-Phase Recovery
// ---------------------------------------------------------------------------
//
// A component that throws during React's COMMIT phase (a ref callback,
// useInsertionEffect / useLayoutEffect / passive useEffect,
// componentDidMount, a useImperativeHandle factory) on a slot's FIRST mount
// latches the render error boundary before any clean commit ever lands.
// In-place remount retries cannot recover that state even after the source
// is fixed: React routes the Suspense reveal through reappearLayoutEffects,
// which replays the stale (still-broken) effect closures instead of
// re-running the Fast-Refresh-patched component. The only reliable exit is a
// full host reload, which re-imports the fixed modules and mounts them fresh.
//
// This block owns that escalation. On every vite:afterUpdate while a slot is
// latched with a render-error-boundary problem, the slot is retried in place
// immediately (recoverable classes — render-phase throws, structural fixes
// in a parent — clear within that one retry). If a slot whose own failing
// module was part of the update is STILL latched after a short probation
// window, the host reloads. The reload is rate-limited (and the limit
// persists across reloads via sessionStorage) so a still-broken module the
// user keeps editing cannot reload-loop the host.

const slotRecoveryRetryCallbacks = new Map<string, () => void>()
const RENDER_RECOVERY_PROBATION_MS = 3_500
const RENDER_RECOVERY_RELOAD_MIN_INTERVAL_MS = 10_000
const RENDER_RECOVERY_RELOAD_AT_KEY = "__tempoRenderRecoveryReloadAt"
let renderRecoveryProbationTimer: ReturnType<typeof setTimeout> | null = null

// Bounded breadcrumb trail of recovery decisions, readable from diagnostics
// tooling (and tests) via window.__tempoRenderRecoveryDebug.
const RENDER_RECOVERY_DEBUG_LIMIT = 50
const renderRecoveryDebugTrail: Array<Record<string, unknown>> = []
if (typeof window !== "undefined") {
  ;(
    window as unknown as { __tempoRenderRecoveryDebug?: unknown }
  ).__tempoRenderRecoveryDebug = renderRecoveryDebugTrail
}
const recordRenderRecoveryDebug = (
  event: string,
  detail: Record<string, unknown> = {}
): void => {
  renderRecoveryDebugTrail.push({ event, at: Date.now(), ...detail })
  if (renderRecoveryDebugTrail.length > RENDER_RECOVERY_DEBUG_LIMIT) {
    renderRecoveryDebugTrail.splice(
      0,
      renderRecoveryDebugTrail.length - RENDER_RECOVERY_DEBUG_LIMIT
    )
  }
}

const readLastRecoveryReloadAt = (): number => {
  try {
    return (
      Number(window.sessionStorage.getItem(RENDER_RECOVERY_RELOAD_AT_KEY)) || 0
    )
  } catch {
    return 0
  }
}

const markRecoveryReloadAt = (timestamp: number): void => {
  try {
    window.sessionStorage.setItem(
      RENDER_RECOVERY_RELOAD_AT_KEY,
      String(timestamp)
    )
  } catch {
    // sessionStorage unavailable -- reloads are then only limited by the
    // probation timer within this page lifetime.
  }
}

// The update payload carries Vite module paths ("/src/Foo.tsx" or
// "/@fs/abs/path/Foo.tsx"); the latched problem's stack frames carry full
// URLs containing those same module paths. A substring hit links the update
// to the slot that is broken on it.
const problemImplicatesModulePath = (
  problem: RuntimeProblem,
  updatedPath: string
): boolean => {
  const cleanPath = updatedPath.split("?")[0]
  if (!cleanPath || cleanPath === "/") return false
  const haystack =
    (problem.stack ?? "") +
    " " +
    (problem.componentStack ?? "") +
    " " +
    (problem.filename ?? "")
  return haystack.includes(cleanPath)
}

const recoverLatchedRenderSlotsAfterHmrUpdate = (
  updatedPaths: string[]
): void => {
  const latched: string[] = []
  const matched: string[] = []
  for (const [renderId, entry] of componentProblemSlots) {
    const problem = entry.slot.get()
    if (problem?.sourceKind !== "render-error-boundary") continue
    latched.push(renderId)
    if (
      updatedPaths.some((path) => problemImplicatesModulePath(problem, path))
    ) {
      matched.push(renderId)
    }
    // The update may have fixed the broken module: retry the latched slot in
    // place right away instead of waiting out its backoff timer.
    slotRecoveryRetryCallbacks.get(renderId)?.()
  }
  recordRenderRecoveryDebug("after-update", {
    updatedPaths,
    latched,
    matched,
    probationAlreadyArmed: renderRecoveryProbationTimer != null,
  })

  // Reload escalation arms only when the update touched a latched slot's own
  // failing module -- edits to unrelated files never reload the host.
  if (matched.length === 0 || renderRecoveryProbationTimer != null) return
  renderRecoveryProbationTimer = setTimeout(() => {
    renderRecoveryProbationTimer = null
    const stillLatched = matched.some(
      (renderId) =>
        componentProblemSlots.get(renderId)?.slot.get()?.sourceKind ===
        "render-error-boundary"
    )
    if (!stillLatched) {
      recordRenderRecoveryDebug("probation-recovered", { matched })
      return
    }
    const now = Date.now()
    if (
      now - readLastRecoveryReloadAt() <
      RENDER_RECOVERY_RELOAD_MIN_INTERVAL_MS
    ) {
      recordRenderRecoveryDebug("reload-rate-limited", { matched })
      return
    }
    recordRenderRecoveryDebug("reloading", { matched })
    markRecoveryReloadAt(now)
    window.location.reload()
  }, RENDER_RECOVERY_PROBATION_MS)
}

const getProblemSnapshot = (): ProblemSnapshot => {
  const componentProblems: Array<{
    renderId: string
    problem: RuntimeProblem
  }> = []

  for (const [renderId, { slot }] of componentProblemSlots) {
    const problem = slot.get()
    if (problem) componentProblems.push({ renderId, problem })
  }

  return {
    hostProblem: hostProblemSlot.get(),
    componentProblems,
  }
}

const publishProblemSnapshot = (): void => {
  const snapshot = getProblemSnapshot()
  for (const watcher of problemSnapshotWatchers) {
    watcher(snapshot)
  }
}

const watchProblemSnapshot = (
  watcher: ProblemSnapshotWatcher
): (() => void) => {
  problemSnapshotWatchers.add(watcher)
  watcher(getProblemSnapshot())

  return () => {
    problemSnapshotWatchers.delete(watcher)
  }
}

hostProblemSlot.watch(() => publishProblemSnapshot())

// ---------------------------------------------------------------------------
// Health Snapshot (active liveness probe)
// ---------------------------------------------------------------------------
//
// Answers the render-host query-health command so renderer-side supervisors can
// distinguish "the frame is alive" from "this render slot has committed real
// Tempo source content." The commit fields are edge-triggered by
// ComponentReadySentinel; the render-slot fields are a live DOM probe.

const isReactConnected = (): boolean => {
  const hook = (
    window as unknown as {
      __REACT_DEVTOOLS_GLOBAL_HOOK__?: { renderers?: { size?: number } }
    }
  ).__REACT_DEVTOOLS_GLOBAL_HOOK__
  return (hook?.renderers?.size ?? 0) > 0
}

type RenderSlotSourceContent = {
  slotExists: boolean
  hasSourceAnnotatedContent: boolean
  observedSourceFiles: string[]
}

type RenderCommitSnapshot = {
  committedAt: number
  sourceAnnotatedCommitAt: number | null
  observedSourceFiles: string[]
}

const renderCommitSnapshotsByRenderId = new Map<string, RenderCommitSnapshot>()
let lastHostRenderCommitAt: number | null = null
let lastHostSourceAnnotatedCommitAt: number | null = null

const renderSlotSourceSelector =
  "[data-tempo-filepath], [data-tempo-html-filepath]"

const uniqueStrings = (values: Array<string | null>): string[] =>
  Array.from(
    new Set(
      values.filter(
        (value): value is string => typeof value === "string" && value !== ""
      )
    )
  )

const buildRenderContentSelector = (renderId: string): string =>
  "[data-render-content=" + JSON.stringify(renderId) + "]"

const inspectRenderSlotSourceContent = (
  renderId: string
): RenderSlotSourceContent => {
  if (renderId === "") {
    return {
      slotExists: false,
      hasSourceAnnotatedContent: false,
      observedSourceFiles: [],
    }
  }
  const slot = document.querySelector(buildRenderContentSelector(renderId))
  if (!slot) {
    return {
      slotExists: false,
      hasSourceAnnotatedContent: false,
      observedSourceFiles: [],
    }
  }

  const observedSourceFiles = uniqueStrings(
    Array.from(slot.querySelectorAll(renderSlotSourceSelector)).flatMap(
      (element) => [
        element.getAttribute("data-tempo-filepath"),
        element.getAttribute("data-tempo-html-filepath"),
      ]
    )
  )

  return {
    slotExists: true,
    hasSourceAnnotatedContent: observedSourceFiles.length > 0,
    observedSourceFiles,
  }
}

const recordRenderCommit = (renderId: string): void => {
  const committedAt = Date.now()
  const sourceContent = inspectRenderSlotSourceContent(renderId)
  const sourceAnnotatedCommitAt = sourceContent.hasSourceAnnotatedContent
    ? committedAt
    : null

  lastHostRenderCommitAt = committedAt
  if (sourceAnnotatedCommitAt != null) {
    lastHostSourceAnnotatedCommitAt = sourceAnnotatedCommitAt
  }
  renderCommitSnapshotsByRenderId.set(renderId, {
    committedAt,
    sourceAnnotatedCommitAt,
    observedSourceFiles: sourceContent.observedSourceFiles,
  })
}

const deleteRenderCommitSnapshot = (renderId: string): void => {
  renderCommitSnapshotsByRenderId.delete(renderId)
}

const buildHealthSnapshot = (renderId: string): HealthSnapshot => {
  const slotSourceContent = inspectRenderSlotSourceContent(renderId)
  const claimCommit =
    renderId !== "" ? renderCommitSnapshotsByRenderId.get(renderId) : undefined
  return {
    alive: true,
    reactConnected: isReactConnected(),
    documentReadyState: document.readyState,
    hasViteOverlayElement: document.querySelector("vite-error-overlay") != null,
    lastHostRenderCommitAt,
    lastClaimRenderCommitAt: claimCommit?.committedAt ?? null,
    lastHostSourceAnnotatedCommitAt,
    lastClaimSourceAnnotatedCommitAt:
      claimCommit?.sourceAnnotatedCommitAt ?? null,
    renderSlotExists: slotSourceContent.slotExists,
    renderSlotHasSourceAnnotatedContent:
      slotSourceContent.hasSourceAnnotatedContent,
    renderSlotObservedSourceFiles: slotSourceContent.observedSourceFiles,
    claimErrorBoundaryTripped:
      renderId !== "" &&
      componentProblemSlots.get(renderId)?.slot.get() != null,
    observedAt: Date.now(),
  }
}

// ---------------------------------------------------------------------------
// Vite Overlay Reader
// ---------------------------------------------------------------------------
//
// Shared by the live reconcile (useViteProblemCapture) and the on-demand probe.

const readViteOverlayContent = (
  overlay: Element
): { message: string; stack?: string; filename?: string } => {
  const shadow = overlay.shadowRoot
  if (!shadow) return { message: "Unknown Vite error" }
  const message =
    shadow.querySelector(".message-body")?.textContent?.trim() ||
    "Unknown Vite error"
  const stack = [
    shadow.querySelector(".stack")?.textContent?.trim(),
    shadow.querySelector(".plugin")?.textContent?.trim(),
    shadow.querySelector(".frame")?.textContent?.trim(),
  ]
    .filter(Boolean)
    .join("\n")
  const filename =
    shadow.querySelector(".file")?.textContent?.trim() || undefined
  return { message, stack: stack || undefined, filename }
}

// Fresh read of the current <vite-error-overlay> as a problem, independent of
// the live reconcile, so the on-demand probe can surface an overlay that is in
// the DOM right now even if the host's reconcile effect has not run yet.
const readCurrentViteOverlay = (): RuntimeProblem | undefined => {
  if (typeof document === "undefined") return undefined
  const overlay = document.querySelector("vite-error-overlay")
  if (!overlay) return undefined
  const { message, stack, filename } = readViteOverlayContent(overlay)
  return { ...createProblem("vite-overlay", message), stack, filename }
}

const readViteError = (
  value: unknown
): { message: string; stack?: string; filename?: string } | undefined => {
  if (value instanceof Error) {
    return {
      message: value.message,
      stack: value.stack,
      filename:
        typeof (value as Error & { id?: unknown }).id === "string"
          ? (value as Error & { id: string }).id
          : undefined,
    }
  }
  if (typeof value === "string") {
    return { message: value }
  }
  if (typeof value !== "object" || value === null) {
    return undefined
  }

  const record = value as Record<string, unknown>
  const nested =
    typeof record.err === "object" && record.err !== null
      ? (record.err as Record<string, unknown>)
      : record
  const message =
    typeof nested.message === "string"
      ? nested.message
      : typeof record.message === "string"
        ? record.message
        : undefined
  if (!message) return undefined

  const stack =
    typeof nested.stack === "string"
      ? nested.stack
      : typeof record.stack === "string"
        ? record.stack
        : undefined
  const filename =
    typeof nested.filename === "string"
      ? nested.filename
      : typeof nested.file === "string"
        ? nested.file
        : typeof record.id === "string"
          ? record.id
          : undefined
  return { message, stack, filename }
}

// ---------------------------------------------------------------------------
// Vite HMR Failure Tracker
// ---------------------------------------------------------------------------
//
// A small, isolated store of the modules Vite currently cannot hot-reload.
//
// It exists because an HMR edit that throws during module evaluation (a new
// top-level reference to an undefined global, an import of a now-missing file,
// etc.) is a REAL, persistent breakage that leaves NO observable live signal:
// Vite catches the failed re-import, keeps the last-good module, and the page
// keeps rendering old content -- there is no <vite-error-overlay>, no thrown
// render, no error-boundary trip. The only evidence is the one-time console
// burst Vite emits on the failed reload cycle ("[vite] Failed to reload
// <path>"). Every other problem source in this host is reconstructable from
// present DOM/runtime state; this one alone must be remembered.
//
// We track it per module path across HMR cycles (vite:beforeUpdate ->
// vite:afterUpdate, wired in useViteProblemCapture): a path is marked failed
// when its reload fails, and cleared when a later cycle updates that same path
// without failing (a clean reload == recovery). The tracker is the single
// source of truth for the "vite-hmr-error" host problem -- it writes that
// problem into hostProblemSlot and is exempt from the renderer-side health
// watchdog, so a still-broken module is never cleared just because the frame
// looks healthy (it always does, for this class of failure).

const viteHmrFailedModules = new Map<string, RuntimeProblem>()

// A module that no longer exists (a deleted canvas, a removed import) is served
// by the Vite dev server as the SPA HTML fallback (Content-Type text/html)
// rather than as a JS module (text/javascript). verifyModuleStillExists() uses
// that to tell a genuinely-gone module from one that merely failed to
// hot-reload. This is the dependable "does it still exist?" signal: Vite emits
// no reliable prune event for rapid deletes, so asking the dev server is the
// only thing that works in every case. Without it, a deleted canvas leaves a
// stale "Failed to reload" problem on EVERY storyboard sharing this host (since
// shownProblem falls back to the host problem) that never clears, because no
// clean reload of a deleted module ever arrives.
const verifyModuleStillExists = async (path: string): Promise<boolean> => {
  try {
    const response = await fetch(path, { cache: "no-store" })
    const contentType = response.headers.get("content-type") || ""
    // text/html == the dev server's SPA fallback == the module is gone.
    return !contentType.includes("text/html")
  } catch (err) {
    // Transport hiccup: assume it still exists so we never suppress a real
    // error on a transient fetch failure.
    void err
    return true
  }
}

const latestViteHmrFailure = (): RuntimeProblem | undefined => {
  let latest: RuntimeProblem | undefined
  for (const problem of viteHmrFailedModules.values()) {
    if (!latest || problem.timestamp >= latest.timestamp) latest = problem
  }
  return latest
}

// Project the tracker into the host problem slot: surface the most-recent
// failure, or clear the slot's vite-hmr-error once every module recovered.
const reconcileViteHmrHostProblem = (): void => {
  const latest = latestViteHmrFailure()
  if (latest) {
    hostProblemSlot.report(latest)
  } else {
    clearHostProblem(["vite-hmr-error"])
  }
}

// ---------------------------------------------------------------------------
// Current-Problem Probe (on-demand pull)
// ---------------------------------------------------------------------------
//
// An independent, synchronous inspection of the current frame state, installed
// on the window so the main process can scrape it on demand (frame-pool
// executeJavaScript -> component-pool probeCurrentProblem /
// probeCurrentHostProblems). It is NOT a mirror of the host's live slots: the
// host failure is a fresh <vite-error-overlay> DOM read (so an overlay present
// before the host reconciled it is still caught), falling back to the host slot
// for the host's own non-overlay problems. Render failures come from the
// component slots, since the host renders no [data-render-error] marker to
// scrape. RuntimeProblem is a superset of the FailureInput payload the consumer
// parses, so values are returned as-is.

type CurrentFrameProblemSnapshot = {
  currentHostFailure?: RuntimeProblem
  currentRenderFailures: Array<{ renderId: string; failure: RuntimeProblem }>
  observedAt: number
}

const inspectCurrentFrameProblems = (
  options: { renderId?: string | null } = {}
): CurrentFrameProblemSnapshot => {
  const renderIdFilter = options.renderId ?? undefined
  const currentRenderFailures: Array<{
    renderId: string
    failure: RuntimeProblem
  }> = []
  for (const [renderId, { slot }] of componentProblemSlots) {
    if (renderIdFilter != null && renderId !== renderIdFilter) continue
    const problem = slot.get()
    if (problem) currentRenderFailures.push({ renderId, failure: problem })
  }
  // Host failure: prefer a fresh overlay scrape (catches a live overlay even
  // before the host reconciled it into its slot), then the newer of the host's
  // own captured problem and the Vite HMR failure tracker. The tracker is the
  // ONE place this probe trusts stored state instead of scraping the present
  // DOM/runtime: an HMR module-eval failure has no live signal to read (Vite
  // keeps the last-good module, so the frame looks healthy), so without it a
  // still-broken module would probe as recovered. Newer-wins so a fresh
  // page-error is never masked by an older tracked HMR failure. Best-effort: it
  // can lag a fix by one HMR cycle, which is acceptable for an on-demand pull.
  const slotProblem = hostProblemSlot.get()
  const hmrProblem = latestViteHmrFailure()
  const trackedHostFailure =
    hmrProblem &&
    (!slotProblem || hmrProblem.timestamp >= slotProblem.timestamp)
      ? hmrProblem
      : slotProblem
  const hostProblem = readCurrentViteOverlay() ?? trackedHostFailure
  return {
    ...(hostProblem ? { currentHostFailure: hostProblem } : {}),
    currentRenderFailures,
    observedAt: Date.now(),
  }
}

if (typeof window !== "undefined") {
  ;(
    window as unknown as {
      __tempoErrorTrackingInspectCurrentProblems?: (options?: {
        renderId?: string | null
      }) => CurrentFrameProblemSnapshot
    }
  ).__tempoErrorTrackingInspectCurrentProblems = inspectCurrentFrameProblems
}

// ---------------------------------------------------------------------------
// Render error messaging
// ---------------------------------------------------------------------------
//
// The runtime never BLOCKS a component for being async -- React renders async
// components fine via Suspense, and in a Vite SPA there is no server-component
// concept at all. We only enrich the message AFTER a render genuinely throws,
// to point the user (and the AI agent) at the likely cause: a server component
// (e.g. a Next.js App Router page.tsx) rendered in the client-side canvas.

// Native async functions report constructor name "AsyncFunction" at modern
// build targets. Used only to record async-ness (never to block); if a project
// downlevels async to plain promise-returning functions this returns false and
// we fall back to the message-level signal below.
const isAsyncFunctionComponent = (value: unknown): boolean =>
  typeof value === "function" &&
  ((value as { constructor?: { name?: string } }).constructor?.name ===
    "AsyncFunction" ||
    Object.prototype.toString.call(value) === "[object AsyncFunction]")

// Render ids whose component currently renders as an async function. Maintained
// (add/delete) in resolveRenderableComponent (observe-only) and consulted by the
// error boundary on failure. A WORKING async component is tracked here too but
// never produces a message -- it doesn't throw.
const asyncRenderIds = new Set<string>()

// Front-loaded: the storyboard's error pill shows a truncated summary, so the
// "async/server component" + "Next.js" cue must come first; the rest (and the
// appended original error) is visible in the full diagnostic message.
const ASYNC_SERVER_COMPONENT_HINT =
  "Async/server component (e.g. a Next.js App Router page.tsx) can't render in " +
  "the canvas's client-side preview -- it runs only on the server. Render the " +
  "underlying client component instead."

// Near-certain server-component signals carried in the thrown message itself.
// Strings verified against real Next.js 16 errors: cookies()/headers() outside
// a request scope point at the next-dynamic-api-wrong-context doc; the
// server-only / client-only packages name the RSC boundary directly. (Plain
// string checks, not regex -- backslashes are unsafe inside this generated
// template string.)
const looksLikeServerComponentError = (message: string): boolean => {
  const lower = message.toLowerCase()
  return (
    lower.indexOf("server-only") !== -1 ||
    lower.indexOf("client-only") !== -1 ||
    lower.indexOf("next/headers") !== -1 ||
    lower.indexOf("outside a request scope") !== -1 ||
    lower.indexOf("next-dynamic-api-wrong-context") !== -1 ||
    lower.indexOf("only be used from a server component") !== -1 ||
    lower.indexOf("cannot be imported from a client component") !== -1 ||
    lower.indexOf("server component") !== -1 ||
    lower.indexOf("client component") !== -1 ||
    // React 18 cannot render an async component: it renders the returned Promise.
    (message.indexOf("Objects are not valid as a React child") !== -1 &&
      message.indexOf("[object Promise]") !== -1)
  )
}

// The message that flows to the canvas instead of a generic "Render timed out".
// Two layered signals identify a server-component-on-the-canvas failure:
//  - wasAsync (broad): the throwing component was an async function -- catches
//    the common case (e.g. awaiting route params) whose raw error names nothing
//    server-specific. An ordinary async component with a bug also lands here, so
//    the hint names Next.js as an example rather than asserting it.
//  - looksLikeServerComponentError (narrow): the error text itself names a
//    server-only API or the RSC boundary. Near-certain.
// The real error is always appended so nothing is hidden.
const renderErrorMessage = (error: unknown, wasAsync: boolean): string => {
  const message = error instanceof Error ? error.message : String(error)
  if (wasAsync || looksLikeServerComponentError(message)) {
    return ASYNC_SERVER_COMPONENT_HINT + " Original error: " + message
  }
  return message
}

type RenderErrorBoundaryProps = {
  renderId: string
  onRenderError: (renderId: string, message: string) => void
  children: React.ReactNode
}

// A render-error boundary latches hasError so one component throwing during
// render (or in a layout effect) does not take down the whole host, and renders
// null while latched. It is a thin catcher: it reports the error up via onError
// and leaves the retry/recovery policy to the owning RenderSlot, which can both
// re-render (cheap, preserves module state) and force a fresh module reload. A
// fresh RenderErrorBoundary instance (RenderSlot remounts it by key on each
// recovery attempt) starts with hasError=false, so each attempt gets a clean
// try at the children.
class RenderErrorBoundary extends React.Component<
  RenderErrorBoundaryProps,
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo): void {
    // Enrich the message ONCE, here, so both surfaces for this failure agree:
    // the problem slot (the error pill / diagnostics) and the readiness claim
    // (the toast). Enriching in two places would let shownProblem race between
    // the raw and enriched text.
    const baseError = error instanceof Error ? error : new Error(String(error))
    const message = renderErrorMessage(
      baseError,
      asyncRenderIds.has(this.props.renderId)
    )
    // Report the enriched summary while preserving the original stack +
    // component stack for diagnostics.
    const reportedError = new Error(message)
    reportedError.stack = baseError.stack
    reportComponentProblem(
      this.props.renderId,
      "render-error-boundary",
      reportedError,
      errorInfo.componentStack ?? undefined
    )
    // A thrown render is terminal for this slot: the boundary now renders null,
    // so ComponentReadySentinel never mounts and the readiness claim would
    // otherwise hang until the 30s watchdog -- surfacing a generic "Render
    // timed out" and holding the frame slot away from other storyboards. Fail
    // the claim now so the real (enriched) error surfaces immediately and the
    // slot frees.
    this.props.onRenderError(this.props.renderId, message)
  }

  render(): React.ReactNode {
    return this.state.hasError ? null : this.props.children
  }
}

function useHostProblemCapture(): void {
  useEffect(() => {
    const onError = (event: ErrorEvent): void => {
      if (event.target !== window) return
      reportHostProblem("page-error", event.error ?? event.message, {
        filename: event.filename || undefined,
        line: typeof event.lineno === "number" ? event.lineno : undefined,
        column: typeof event.colno === "number" ? event.colno : undefined,
      })
    }
    const onUnhandledRejection = (event: PromiseRejectionEvent): void => {
      reportHostProblem("unhandled-rejection", event.reason)
    }

    // Resource load failures (img/script/link/...) fire an "error" event on the
    // element that does NOT bubble, so it is only observable in the capture
    // phase (and is why onError above, a bubble-phase window listener, never
    // sees it). Scope it to the owning render slot when the element lives inside
    // one, so a broken asset in a single storyboard never surfaces host-wide.
    const resourceTags = new Set([
      "IMG",
      "SCRIPT",
      "LINK",
      "AUDIO",
      "VIDEO",
      "SOURCE",
    ])
    const onResourceError = (event: Event): void => {
      const target = event.target
      if (!(target instanceof Element) || !resourceTags.has(target.tagName)) {
        return
      }
      const url =
        target.getAttribute("src") || target.getAttribute("href") || ""
      const message =
        "Failed to load " +
        target.tagName.toLowerCase() +
        (url ? ": " + url : "")
      const renderId = target
        .closest("[data-render-id]")
        ?.getAttribute("data-render-id")
      if (renderId) {
        reportComponentProblem(renderId, "resource-load", message)
      } else {
        reportHostProblem("resource-load", message, {
          filename: url || undefined,
        })
      }
    }

    // @font-face load failures don't fire an element "error" event (the font is
    // requested by CSS, not by a resource element), so onResourceError never
    // sees them. document.fonts emits "loadingerror" with the failed FontFace
    // entries instead -- surface those as a host-wide resource-load problem.
    const onFontLoadingError = (event: Event): void => {
      const faces =
        (event as Event & { fontfaces?: ReadonlyArray<{ family?: string }> })
          .fontfaces ?? []
      const families = faces
        .map((face) => face.family)
        .filter(Boolean)
        .join(", ")
      reportHostProblem(
        "resource-load",
        "Failed to load font" + (families ? ": " + families : "")
      )
    }
    const fontFaceSet =
      typeof document.fonts?.addEventListener === "function"
        ? document.fonts
        : undefined

    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onUnhandledRejection)
    window.addEventListener("error", onResourceError, { capture: true })
    fontFaceSet?.addEventListener("loadingerror", onFontLoadingError)
    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onUnhandledRejection)
      window.removeEventListener("error", onResourceError, { capture: true })
      fontFaceSet?.removeEventListener("loadingerror", onFontLoadingError)
    }
  }, [])
}

function useViteProblemCapture(): void {
  useEffect(() => {
    // The <vite-error-overlay> element's presence IS the current Vite
    // server-error state. Vite appends it on an error HMR payload and removes
    // it on the next successful update (vite/dist/client/client.mjs ->
    // createErrorOverlay / clearErrorOverlay; close() does removeChild). We
    // project that element directly into the host slot on every DOM mutation
    // instead of tracking add/remove edges, so a stale overlay error is
    // structurally impossible: each reconcile re-reads the live DOM (via the
    // shared readCurrentViteOverlay, the same read the on-demand probe uses)
    // and is the single writer of the "vite-overlay" problem.
    const reconcileViteOverlay = (): void => {
      const problem = readCurrentViteOverlay()
      if (problem) {
        hostProblemSlot.report(problem)
      } else {
        clearHostProblem(["vite-overlay"])
      }
    }

    const observer = new MutationObserver(reconcileViteOverlay)

    if (document.body) {
      // Vite appends the overlay as a direct child of <body>, so childList on
      // body (no subtree) catches it and stays cheap: body's direct children
      // change rarely (React root, portals, the overlay).
      observer.observe(document.body, { childList: true })
      reconcileViteOverlay()
      Promise.resolve().then(reconcileViteOverlay)
    }

    // Resolve Vite's HMR endpoint without writing the bare `import.meta`
    // token in source. Two reasons:
    //   1. Some hosts (Metro web, classic <script> bundles) parse this file
    //      as non-module — `import.meta` is a hard SyntaxError there,
    //      `Cannot use 'import.meta' outside a module`, which would block
    //      the entire component host from loading.
    //   2. Wrapping the token in a string + direct eval defers parsing to
    //      runtime: Vite (module context) parses + evaluates fine and
    //      returns the HMR object; Metro (script context) throws at the
    //      eval call, caught below, and `hot` stays undefined — the
    //      Vite-specific HMR subscriptions then no-op.
    let hot:
      | {
          on?: (name: string, cb: (payload: unknown) => void) => void
          off?: (name: string, cb: (payload: unknown) => void) => void
        }
      | undefined
    try {
      // eslint-disable-next-line no-eval
      hot = eval("import.meta && import.meta.hot") as typeof hot
    } catch {
      hot = undefined
    }
    recordRenderRecoveryDebug("vite-hot-resolved", {
      hasHot: hot != null,
      hasOn: typeof hot?.on === "function",
    })

    // Compile/transform errors arriving as a Vite error HMR payload also mount
    // a <vite-error-overlay> (or, with the overlay disabled, log a "[vite]
    // Internal Server Error" console.error). Both are already captured -- by
    // reconcileViteOverlay and by the console sniff below -- so this hook does
    // NOT also subscribe to the vite error HMR event: that would be a second
    // writer of the host problem with no matching clear edge, and the payload
    // carries no module path to key the HMR tracker on.

    // HMR-cycle failure tracking. A failed hot-reload logs "[vite] Failed to
    // reload <path>" (console.error) between vite:beforeUpdate and
    // vite:afterUpdate. We collect the failed paths across the cycle and, on
    // afterUpdate, mark them failed and clear any path that was updated this
    // cycle WITHOUT failing (a clean reload == recovery). "[vite] hot updated:
    // <path>" is deliberately NOT used as the recovery signal: Vite logs it even
    // on a FAILED cycle (the update thunk still runs after the catch), so it
    // would cancel the failure within the same cycle. Reconciling by
    // "updated-this-cycle-and-did-not-fail" is the reliable signal.
    const failedReloadPattern = /^Failed to reload (.+?)\. This could be due to/
    let viteHmrCycleActive = false
    let cycleFailedPaths = new Map<string, RuntimeProblem>()
    let lastCycleViteErrorDetail:
      { message: string; stack?: string; filename?: string } | undefined

    const readUpdatePaths = (payload: unknown): string[] => {
      const updates =
        typeof payload === "object" &&
        payload !== null &&
        Array.isArray((payload as { updates?: unknown }).updates)
          ? (payload as { updates: Array<Record<string, unknown>> }).updates
          : []
      const paths = new Set<string>()
      const collectPath = (value: unknown): void => {
        if (typeof value === "string") paths.add(value)
      }
      for (const update of updates) {
        collectPath(update.path)
        collectPath(update.acceptedPath)
        collectPath(update.id)
      }
      return [...paths]
    }

    const onViteBeforeUpdate = (): void => {
      viteHmrCycleActive = true
      cycleFailedPaths = new Map()
      lastCycleViteErrorDetail = undefined
    }

    const onViteAfterUpdate = (payload: unknown): void => {
      const updatedPaths = readUpdatePaths(payload)
      // Recovery: a module updated this cycle that did not log a failure is
      // healthy again.
      for (const path of updatedPaths) {
        if (!cycleFailedPaths.has(path)) viteHmrFailedModules.delete(path)
      }
      // Failure: a module whose reload failed this cycle is (still) broken.
      for (const [path, problem] of cycleFailedPaths) {
        viteHmrFailedModules.set(path, problem)
      }
      viteHmrCycleActive = false
      cycleFailedPaths = new Map()
      reconcileViteHmrHostProblem()
      // A latched render-error boundary cannot recover in place when the
      // throw happened in the commit phase of the slot's first mount; this
      // update may be the fix for it. Retry latched slots now and escalate to
      // a host reload if a slot stays latched on a module this update
      // touched.
      recoverLatchedRenderSlotsAfterHmrUpdate(updatedPaths)
    }

    let hotEventsCancelled = false
    let subscribedHot: typeof hot = undefined
    const subscribeHotEvents = (hotLike: NonNullable<typeof hot>): void => {
      subscribedHot = hotLike
      hotLike.on?.("vite:beforeUpdate", onViteBeforeUpdate)
      hotLike.on?.("vite:afterUpdate", onViteAfterUpdate)
    }
    if (hot && typeof hot.on === "function") {
      subscribeHotEvents(hot)
    } else {
      // import.meta.hot only exists for modules Vite served WITH an HMR
      // context. This host module can be served without one (the generated
      // .tempo/component-host.tsx path), which silently kills every vite:*
      // subscription above -- the HMR failure tracker and the commit-phase
      // recovery never see updates. The page-level Vite client is still live
      // (it fetches and applies updates), so create a dedicated hot context
      // straight from the client module. Non-Vite hosts reject the import and
      // the subscriptions stay no-op, same as before.
      void import(
        /* @vite-ignore */
        /* webpackIgnore: true */
        /* turbopackIgnore: true */
        "/@vite/client"
      )
        .then((client: unknown) => {
          const createHotContext = (
            client as {
              createHotContext?: (ownerPath: string) => NonNullable<typeof hot>
            }
          ).createHotContext
          const context = createHotContext?.("/__tempo-render-pool-host__")
          recordRenderRecoveryDebug("vite-client-hot-context", {
            ok: context != null,
          })
          if (!context || hotEventsCancelled) return
          subscribeHotEvents(context)
        })
        .catch(() => {
          recordRenderRecoveryDebug("vite-client-hot-context", { ok: false })
        })
    }

    const originalConsoleError = console.error
    console.error = (...args: unknown[]): void => {
      originalConsoleError(...args)
      const first = args[0]
      const second = args[1]
      const error =
        first === "[vite]"
          ? readViteError(second)
          : typeof first === "string" && first.startsWith("[vite]")
            ? { message: first }
            : undefined
      if (!error) return

      // "Failed to reload <path>" names a module Vite could not hot-reload.
      // Record it against the current cycle and surface it immediately as the
      // tracker-owned vite-hmr-error; the afterUpdate reconcile keeps it until a
      // clean cycle for that path clears it.
      //
      // The MESSAGE is the root-cause eval error that fired just before this
      // line in the same cycle (a ReferenceError, a thrown value, ...), falling
      // back to the reload line only when Vite logged no separate error. The
      // path always rides in the filename field. This distinction matters
      // downstream: the kind classifier reads a bare "Failed to reload" as
      // module-load (a
      // missing/renamed import that 404s), but an eval throw is a runtime error
      // and must classify as such -- keeping "Failed to reload" out of the
      // message is what lets it.
      const failedReload = failedReloadPattern.exec(error.message)
      if (failedReload) {
        const path = failedReload[1]
        const detail = lastCycleViteErrorDetail
        const problem: RuntimeProblem = {
          ...createProblem(
            "vite-hmr-error",
            detail?.message ?? "Failed to reload " + path
          ),
          stack: detail?.stack ?? error.stack,
          filename: detail?.filename ?? path,
        }
        if (detail) {
          // A root-cause error was logged earlier this cycle (an eval throw,
          // a thrown value, ...): the module exists and genuinely failed at
          // runtime. Track it immediately.
          cycleFailedPaths.set(path, problem)
          viteHmrFailedModules.set(path, problem)
          reconcileViteHmrHostProblem()
        } else {
          // Bare "Failed to reload <path>" with no root-cause error: the module
          // either vanished (a deleted canvas / removed import) or genuinely
          // 404s. Verify against the dev server before surfacing -- a deleted
          // module must NOT become a stale module-load pill on every storyboard
          // sharing this host. Async, so it can't key cycleFailedPaths; commit
          // straight to viteHmrFailedModules once existence is known.
          verifyModuleStillExists(path).then((exists) => {
            if (exists) viteHmrFailedModules.set(path, problem)
            else viteHmrFailedModules.delete(path)
            reconcileViteHmrHostProblem()
          })
        }
        return
      }

      // Inside an HMR cycle, every other [vite] console error is part of the
      // failing reload (the root-cause eval error fires just before "Failed to
      // reload"): stash it to enrich the tracker problem rather than surface a
      // transient, health-refutable console-vite-error the watchdog would race
      // to clear. Outside a cycle it is a standalone Vite error (failed dynamic
      // import, internal server error, ...) -> surface it.
      if (viteHmrCycleActive) {
        lastCycleViteErrorDetail = error
        return
      }

      reportHostProblem("console-vite-error", error.message, {
        stack: error.stack,
        filename: error.filename,
      })
    }

    return () => {
      observer.disconnect()
      hotEventsCancelled = true
      subscribedHot?.off?.("vite:beforeUpdate", onViteBeforeUpdate)
      subscribedHot?.off?.("vite:afterUpdate", onViteAfterUpdate)
      console.error = originalConsoleError
    }
  }, [])
}

// ---------------------------------------------------------------------------
// Registry Loading
// ---------------------------------------------------------------------------
//
// The registry owns canvas-file imports. This host receives those lazy import
// functions, then loads a file and reads the requested export when React needs it.

type JsModule = Record<string, unknown>
type JsModuleLoader = ((cacheBust?: string) => Promise<JsModule>) & {
  __tempoSpecifier?: string
}
const canvasLoaders: Record<string, JsModuleLoader> = {}
const canvasModules: Record<string, JsModule> = {}
const canvasModuleLoadPromises = new Map<string, Promise<JsModule>>()
const canvasModuleWaiters = new Map<string, Set<() => void>>()
const canvasModuleGenerations: Record<string, number> = {}
const canvasExportGenerations: Record<string, Record<string, number>> = {}
type CanvasModuleChange = {
  importPath: string
  changedExports?: readonly string[]
}
const canvasModuleChangeListeners = new Set<
  (changes: readonly CanvasModuleChange[]) => void
>()
let readySent = false

const appendCanvasLoaderCacheBust = (
  specifier: string,
  cacheBust?: string
): string => {
  if (!cacheBust) return specifier
  const separator = specifier.includes("?") ? "&" : "?"
  return (
    specifier +
    separator +
    "tempo_module_retry=" +
    encodeURIComponent(cacheBust)
  )
}

const cleanVitePath = (path: string): string => path.replace(/[?#].*$/, "")

const normalizeVitePath = (path: string): string => {
  const clean = cleanVitePath(path)
  const withoutFs = clean.startsWith("/@fs/")
    ? clean.slice("/@fs".length)
    : clean
  return withoutFs.startsWith("/private/")
    ? withoutFs.slice("/private".length)
    : withoutFs
}

const stripLeadingRelativeSegments = (path: string): string => {
  let rest = cleanVitePath(path)
  while (true) {
    if (rest.startsWith("./")) {
      rest = rest.slice(2)
      continue
    }
    if (rest.startsWith("../")) {
      rest = rest.slice(3)
      continue
    }
    return rest
  }
}

const vitePathMatchesCandidate = (
  candidatePath: string,
  updatedPath: string
): boolean => {
  const normalizedCandidate = normalizeVitePath(candidatePath)
  const normalizedUpdated = normalizeVitePath(updatedPath)
  if (normalizedCandidate === normalizedUpdated) return true

  const relativeCandidate = stripLeadingRelativeSegments(candidatePath)
  return (
    relativeCandidate.length > 0 &&
    normalizedUpdated.endsWith("/" + relativeCandidate)
  )
}

const loaderSpecifier = (loader: JsModuleLoader | undefined): string | null =>
  loader?.__tempoSpecifier ?? null

const loaderMatchesViteUpdate = (
  importPath: string,
  loader: JsModuleLoader,
  updatedPath: string
): boolean => {
  const specifier = loaderSpecifier(loader)
  return (
    vitePathMatchesCandidate(importPath, updatedPath) ||
    (specifier != null && vitePathMatchesCandidate(specifier, updatedPath))
  )
}

const getCanvasModuleGeneration = (definition: ComponentDefinition): number =>
  (canvasModuleGenerations[definition.importPath] ?? 0) +
  (canvasExportGenerations[definition.importPath]?.[definition.importName] ?? 0)

const bumpCanvasModuleGeneration = (
  importPath: string,
  changedExports?: readonly string[]
): void => {
  if (changedExports) {
    const exportGenerations = (canvasExportGenerations[importPath] ??= {})
    for (const exportName of new Set(changedExports)) {
      exportGenerations[exportName] = (exportGenerations[exportName] ?? 0) + 1
    }
  } else {
    canvasModuleGenerations[importPath] =
      (canvasModuleGenerations[importPath] ?? 0) + 1
  }
  delete canvasModules[importPath]
  canvasModuleLoadPromises.delete(importPath)
  notifyCanvasWaiters(importPath)
}

const mergeCanvasModuleChange = (
  changes: Map<string, Set<string> | null>,
  importPath: string,
  changedExports?: readonly string[]
): void => {
  const existing = changes.get(importPath)
  if (existing === null) return
  if (!changedExports) {
    changes.set(importPath, null)
    return
  }
  const next = existing ?? new Set<string>()
  for (const exportName of changedExports) {
    next.add(exportName)
  }
  changes.set(importPath, next)
}

const publishCanvasModuleChanges = (
  changed: readonly CanvasModuleChange[]
): void => {
  if (changed.length === 0) return
  for (const listener of canvasModuleChangeListeners) {
    listener(changed)
  }
}

const subscribeCanvasModuleChanges = (
  listener: (changes: readonly CanvasModuleChange[]) => void
): (() => void) => {
  canvasModuleChangeListeners.add(listener)
  return () => {
    canvasModuleChangeListeners.delete(listener)
  }
}

type ChangedCanvasSpecifier =
  | string
  | {
      specifier: string
      changedExports?: readonly string[]
    }

type ChangedCanvasSpecifiers = readonly ChangedCanvasSpecifier[]

const readChangedCanvasSpecifier = (
  change: ChangedCanvasSpecifier
): { specifier: string; changedExports?: readonly string[] } =>
  typeof change === "string" ? { specifier: change } : change

export const createCanvasLoader = (
  staticLoader: () => Promise<unknown>,
  specifier: string
): JsModuleLoader => {
  const loader: JsModuleLoader = async (cacheBust?: string) => {
    const module = cacheBust
      ? await import(
          /* @vite-ignore */
          /* webpackIgnore: true */
          /* turbopackIgnore: true */
          appendCanvasLoaderCacheBust(specifier, cacheBust)
        )
      : await staticLoader()
    return module as JsModule
  }
  loader.__tempoSpecifier = specifier
  return loader
}

const notifyCanvasWaiters = (importPath: string): void => {
  const waiters = canvasModuleWaiters.get(importPath)
  if (!waiters) return

  canvasModuleWaiters.delete(importPath)
  for (const waiter of waiters) {
    waiter()
  }
}

const addCanvasWaiter = (
  importPath: string,
  waiter: () => void
): (() => void) => {
  const waiters = canvasModuleWaiters.get(importPath) ?? new Set<() => void>()
  waiters.add(waiter)
  canvasModuleWaiters.set(importPath, waiters)

  return () => {
    waiters.delete(waiter)
    if (waiters.size === 0) {
      canvasModuleWaiters.delete(importPath)
    }
  }
}

export const registerCanvasLoaders = (
  loaders: typeof canvasLoaders,
  changedSpecifiers?: ChangedCanvasSpecifiers
): void => {
  const previousLoaders = { ...canvasLoaders }

  for (const key of Object.keys(canvasLoaders)) {
    delete canvasLoaders[key]
  }
  Object.assign(canvasLoaders, loaders ?? {})

  const changed = new Map<string, Set<string> | null>()
  for (const key of Object.keys(canvasModules)) {
    const previousLoader = previousLoaders[key]
    const nextLoader = canvasLoaders[key]
    if (!nextLoader) {
      delete canvasModules[key]
      canvasModuleLoadPromises.delete(key)
      delete canvasModuleGenerations[key]
      delete canvasExportGenerations[key]
      continue
    }
    if (
      previousLoader &&
      loaderSpecifier(previousLoader) !== loaderSpecifier(nextLoader)
    ) {
      bumpCanvasModuleGeneration(key)
      mergeCanvasModuleChange(changed, key)
    }
  }
  if (changedSpecifiers && changedSpecifiers.length > 0) {
    const specifierChanges = changedSpecifiers.map(readChangedCanvasSpecifier)
    for (const [key, loader] of Object.entries(canvasLoaders)) {
      for (const change of specifierChanges) {
        if (!loaderMatchesViteUpdate(key, loader, change.specifier)) {
          continue
        }
        bumpCanvasModuleGeneration(key, change.changedExports)
        mergeCanvasModuleChange(changed, key, change.changedExports)
      }
    }
  }
  for (const key of Object.keys(canvasLoaders)) {
    notifyCanvasWaiters(key)
  }
  publishCanvasModuleChanges(
    [...changed].map(([importPath, changedExports]) => ({
      importPath,
      ...(changedExports ? { changedExports: [...changedExports] } : {}),
    }))
  )

  if (!readySent) {
    readySent = true
    window.postMessage({ type: "render-pool:ready" }, "*")
  }
}

// ---------------------------------------------------------------------------
// Component Model
// ---------------------------------------------------------------------------

type ComponentDefinition = {
  importPath: string // Project-relative canvas file path registered by component-registry.ts.
  importName: string // Named export inside the loaded canvas module.
  props?: Record<string, unknown> // Props passed directly to the resolved React component.
}

type Dimensions = { width: number; height: number }

// A slot dimension is a pixel count (number) or a CSS length carrying its own
// unit, e.g. "100vw". Unit lengths only enter via the direct-URL bootstrap —
// viewport units let an embedding iframe's live viewport drive the slot size
// through pure CSS (no re-render round trip). The parent's IPC commands always
// send numbers.
type SlotDimension = number | string
type SlotDimensions = { width: SlotDimension; height: SlotDimension }

type MountedComponent = {
  renderId: string // Parent-owned stable id; also used as React key and DOM marker.
  component: ComponentDefinition // Component identity and props for this slot.
  size?: SlotDimensions // Omitted means render at natural component size.
  intrinsicSize?: boolean // Use the component's root element as the measured size.
  moduleGeneration: number // Bumped when Vite updates this canvas module.
  renderAttemptId: number // Local id for this render command attempt.
  abortSignal: AbortSignal // Cancels async loading when the render is replaced or removed.
}

type RenderState = {
  mountedComponents: MountedComponent[]
  claimedComponentIds: string[]
  cachedComponents: Array<{ renderId: string; cachedAt: number }>
}

type ComponentClaimCommand = Omit<
  MountedComponent,
  "moduleGeneration" | "renderAttemptId" | "abortSignal"
>

type CommandResponse = {
  ack: () => void
  error: (error: unknown) => void
}

const maxCachedComponentsToKeepMounted = 20

// ---------------------------------------------------------------------------
// Component Loading
// ---------------------------------------------------------------------------

const canvasExportWaitMs = 10_000
const canvasExportRetryMs = 250

const resolveRenderableComponent = (
  value: unknown,
  importName: string,
  renderId: string
): React.ComponentType<Record<string, unknown>> => {
  if (typeof value === "function") {
    // A directly-exported async component (e.g. an "export default async
    // function Page()"). Record it; do NOT block -- React renders async via
    // Suspense.
    if (isAsyncFunctionComponent(value)) {
      asyncRenderIds.add(renderId)
    }
    return value as React.ComponentType<Record<string, unknown>>
  }

  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "render" in value &&
    typeof value.render === "function"
  ) {
    const render = (props: Record<string, unknown>) => {
      const element = (
        value.render as (props: Record<string, unknown>) => React.ReactNode
      )(props)
      // The common storyboard shape is a render function returning a single
      // element; track whether that element's component type is async so a later
      // throw can be attributed to it. Observe-only (the element renders
      // unchanged) and self-correcting (delete when no longer async, e.g. after
      // the user edits the storyboard).
      if (
        element != null &&
        typeof element === "object" &&
        isAsyncFunctionComponent((element as { type?: unknown }).type)
      ) {
        asyncRenderIds.add(renderId)
      } else {
        asyncRenderIds.delete(renderId)
      }
      return element
    }
    render.displayName = importName
    return render
  }

  throw new Error("Export " + importName + " is not renderable")
}

const loadCanvasModule = (
  importPath: string,
  cacheBust?: string
): Promise<Record<string, unknown>> => {
  const existing = cacheBust ? undefined : canvasModules[importPath]
  if (existing) return Promise.resolve(existing)

  const inFlight = cacheBust
    ? undefined
    : canvasModuleLoadPromises.get(importPath)
  if (inFlight) return inFlight

  const canvasLoader = canvasLoaders[importPath]
  if (!canvasLoader) {
    return Promise.reject(
      new Error("No canvas loader registered for " + importPath)
    )
  }

  const loadPromise = canvasLoader(cacheBust).then(
    (module) => {
      canvasModuleLoadPromises.delete(importPath)
      if (canvasLoaders[importPath] !== canvasLoader) {
        throw new Error("Canvas loader changed while loading " + importPath)
      }
      canvasModules[importPath] = module
      notifyCanvasWaiters(importPath)
      return module
    },
    (error) => {
      canvasModuleLoadPromises.delete(importPath)
      throw error
    }
  )
  if (!cacheBust) {
    canvasModuleLoadPromises.set(importPath, loadPromise)
  }
  return loadPromise
}

const waitForCanvasExport = (
  definition: ComponentDefinition,
  abortSignal: AbortSignal,
  cacheBust?: string
): Promise<unknown> =>
  new Promise((resolve, reject) => {
    if (abortSignal.aborted) {
      reject(new DOMException("Render was aborted", "AbortError"))
      return
    }

    const startedAt = Date.now()
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let removeCanvasWaiter: (() => void) | null = null
    let settled = false
    // The most recent reason loadCanvasModule REJECTED, if any. A rejection
    // means the canvas module (or one of its imports) failed to EVALUATE — a
    // server-only import reaching the client host, a syntax error mid-edit, a
    // throwing top-level import, etc. We keep retrying (the failure may be a
    // transient mid-edit state), but on timeout we surface this real reason
    // instead of the misleading "export was not found" — the export is usually
    // present in the source; the module just never finished loading.
    let lastLoadError: unknown = null

    const cleanup = (): void => {
      if (retryTimer) {
        clearTimeout(retryTimer)
        retryTimer = null
      }
      removeCanvasWaiter?.()
      removeCanvasWaiter = null
      abortSignal.removeEventListener("abort", abort)
    }

    const finish = (value: unknown): void => {
      if (settled) return
      settled = true
      cleanup()
      resolve(value)
    }

    const fail = (error: unknown): void => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }

    const abort = (): void => {
      fail(new DOMException("Render was aborted", "AbortError"))
    }
    abortSignal.addEventListener("abort", abort, { once: true })

    const scheduleRetry = (): void => {
      if (settled || retryTimer) return
      if (abortSignal.aborted) {
        abort()
        return
      }
      if (Date.now() - startedAt >= canvasExportWaitMs) {
        if (lastLoadError != null) {
          // The module never finished evaluating — surface the REAL reason
          // (and the original stack so the captured diagnostic points at the
          // throwing module, not this loader) instead of "was not found".
          const reason =
            lastLoadError instanceof Error
              ? lastLoadError.message
              : String(lastLoadError)
          const loadFailure = new Error(
            'Export "' +
              definition.importName +
              '" could not be loaded from canvas file "' +
              definition.importPath +
              '": ' +
              reason
          )
          if (lastLoadError instanceof Error && lastLoadError.stack) {
            loadFailure.stack = lastLoadError.stack
          }
          fail(loadFailure)
          return
        }
        fail(
          new Error(
            'Export "' +
              definition.importName +
              '" was not found in canvas file "' +
              definition.importPath +
              '"'
          )
        )
        return
      }
      retryTimer = setTimeout(() => {
        retryTimer = null
        attempt()
      }, canvasExportRetryMs)
    }

    const attempt = (): void => {
      if (abortSignal.aborted) {
        abort()
        return
      }

      const cachedModule = cacheBust
        ? undefined
        : canvasModules[definition.importPath]
      if (
        cachedModule &&
        typeof cachedModule[definition.importName] !== "undefined"
      ) {
        finish(cachedModule[definition.importName])
        return
      }

      delete canvasModules[definition.importPath]
      canvasModuleLoadPromises.delete(definition.importPath)
      loadCanvasModule(definition.importPath, cacheBust).then(
        (module) => {
          if (abortSignal.aborted) {
            abort()
            return
          }
          if (typeof module[definition.importName] !== "undefined") {
            finish(module[definition.importName])
            return
          }
          // Module evaluated cleanly but this export isn't present (yet) —
          // genuinely missing, or an HMR window mid-edit. Clear any prior load
          // error so a timeout reports "was not found", and keep waiting.
          lastLoadError = null
          scheduleRetry()
        },
        (error) => {
          // Module failed to evaluate. Remember the real reason for the
          // timeout message, but keep retrying in case it's transient.
          lastLoadError = error
          scheduleRetry()
        }
      )
    }

    removeCanvasWaiter = addCanvasWaiter(definition.importPath, attempt)
    attempt()
  })

const loadComponent = async (entry: MountedComponent) => {
  const generationCacheBust =
    entry.moduleGeneration > 0
      ? "generation-" + String(entry.moduleGeneration)
      : undefined
  const value = await waitForCanvasExport(
    entry.component,
    entry.abortSignal,
    generationCacheBust
  )

  return {
    default: resolveRenderableComponent(
      value,
      entry.component.importName,
      entry.renderId
    ),
  }
}

// ---------------------------------------------------------------------------
// Portal Tracking
// ---------------------------------------------------------------------------
//
// React portals mount outside their owning render slot in the DOM. The tracker
// uses React's fiber parent links to associate those external portal roots with
// the slot that rendered them.

type FiberLike = {
  return: FiberLike | null
  stateNode: unknown
}

type PortalWatcher = {
  element: Element
  onPortalFound: (portalRoot: Element) => void
  onPortalRemoved: (portalRoot: Element) => void
}

type PortalInlineStyle = {
  visibility: string
  pointerEvents: string
  contentVisibility: string
  transition: string
  animation: string
}

const portalElementsByRenderId = new Map<string, Set<Element>>()
const portalOwnerRenderIdsByElement = new Map<Element, Set<string>>()
const portalInlineStyleByElement = new Map<Element, PortalInlineStyle>()
const componentStatusByRenderId = new Map<string, "active" | "cached">()

const findFiberKey = (element: Element): string | null =>
  Object.keys(element).find(
    (key) =>
      key.startsWith("__reactFiber$") ||
      key.startsWith("__reactInternalInstance$")
  ) ?? null

const findContainerKey = (element: Element): string | null =>
  Object.keys(element).find((key) => key.startsWith("__reactContainer$")) ??
  null

const getFiberFromElement = (element: Element): FiberLike | null => {
  const fiberKey = findFiberKey(element)
  if (fiberKey) {
    return (
      (element as unknown as Record<string, FiberLike | undefined>)[fiberKey] ??
      null
    )
  }

  const containerKey = findContainerKey(element)
  if (containerKey) {
    return (
      (element as unknown as Record<string, FiberLike | undefined>)[
        containerKey
      ] ?? null
    )
  }

  return null
}

class PortalTracker {
  private readonly watchers = new Set<PortalWatcher>()
  private readonly ownerWatchersByPortalRoot = new Map<
    Element,
    Set<PortalWatcher>
  >()
  private observer: MutationObserver | null = null

  register(watcher: PortalWatcher): () => void {
    this.watchers.add(watcher)

    if (this.watchers.size === 1) {
      this.startObserving()
    }

    if (typeof document !== "undefined" && document.body) {
      for (const child of Array.from(document.body.children)) {
        this.checkElement(child)
      }
    }

    return () => this.unregister(watcher)
  }

  private unregister(watcher: PortalWatcher): void {
    this.watchers.delete(watcher)

    for (const [portalRoot, owners] of this.ownerWatchersByPortalRoot) {
      owners.delete(watcher)
      if (owners.size === 0) {
        this.ownerWatchersByPortalRoot.delete(portalRoot)
      }
    }

    if (this.watchers.size === 0) {
      this.stopObserving()
    }
  }

  private startObserving(): void {
    if (
      this.observer ||
      typeof document === "undefined" ||
      !document.body ||
      typeof MutationObserver === "undefined"
    ) {
      return
    }

    this.observer = new MutationObserver(this.handleMutations)
    this.observer.observe(document.body, { childList: true })
  }

  private stopObserving(): void {
    this.observer?.disconnect()
    this.observer = null
  }

  private handleMutations = (mutations: MutationRecord[]): void => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof Element) {
          queueMicrotask(() => this.checkElement(node))
        }
      }

      for (const node of mutation.removedNodes) {
        if (!(node instanceof Element)) continue

        const owners = this.ownerWatchersByPortalRoot.get(node)
        if (!owners) continue

        for (const owner of owners) {
          owner.onPortalRemoved(node)
        }
        this.ownerWatchersByPortalRoot.delete(node)
      }
    }
  }

  private checkElement(element: Element): void {
    const ancestorDomNodes = this.getDomAncestorsViaFiber(element)
    if (ancestorDomNodes.length === 0) return

    let owners = this.ownerWatchersByPortalRoot.get(element)

    for (const watcher of this.watchers) {
      const belongsToWatcher = ancestorDomNodes.some(
        (node) => watcher.element.contains(node) || watcher.element === node
      )
      if (!belongsToWatcher) continue

      if (!owners) {
        owners = new Set<PortalWatcher>()
        this.ownerWatchersByPortalRoot.set(element, owners)
      }
      if (owners.has(watcher)) continue

      owners.add(watcher)
      watcher.onPortalFound(element)
    }
  }

  private getDomAncestorsViaFiber(element: Element): Element[] {
    const fiber = getFiberFromElement(element)
    if (!fiber) return []

    const domNodes: Element[] = []
    let current: FiberLike | null = fiber.return
    while (current) {
      if (current.stateNode instanceof Element) {
        domNodes.push(current.stateNode)
      }
      current = current.return
    }
    return domNodes
  }
}

let portalTracker: PortalTracker | null = null

const getPortalTracker = (): PortalTracker => {
  if (!portalTracker) {
    portalTracker = new PortalTracker()
  }
  return portalTracker
}

const getStylablePortalElement = (
  portalRoot: Element
): HTMLElement | SVGElement | null => {
  if (portalRoot instanceof HTMLElement || portalRoot instanceof SVGElement) {
    return portalRoot
  }
  return null
}

const ensurePortalInlineStyle = (portalRoot: Element): PortalInlineStyle => {
  const existing = portalInlineStyleByElement.get(portalRoot)
  if (existing) return existing

  const stylableElement = getStylablePortalElement(portalRoot)
  const baseline = {
    visibility: stylableElement?.style.getPropertyValue("visibility") ?? "",
    pointerEvents:
      stylableElement?.style.getPropertyValue("pointer-events") ?? "",
    contentVisibility:
      stylableElement?.style.getPropertyValue("content-visibility") ?? "",
    transition: stylableElement?.style.getPropertyValue("transition") ?? "",
    animation: stylableElement?.style.getPropertyValue("animation") ?? "",
  }
  portalInlineStyleByElement.set(portalRoot, baseline)
  return baseline
}

const restoreInlineStyleValue = (
  style: CSSStyleDeclaration,
  propertyName: string,
  value: string
): void => {
  if (value) {
    style.setProperty(propertyName, value)
    return
  }
  style.removeProperty(propertyName)
}

const restorePortalInlineStyle = (portalRoot: Element): void => {
  const stylableElement = getStylablePortalElement(portalRoot)
  const baseline = portalInlineStyleByElement.get(portalRoot)
  if (!stylableElement || !baseline) return

  restoreInlineStyleValue(
    stylableElement.style,
    "visibility",
    baseline.visibility
  )
  restoreInlineStyleValue(
    stylableElement.style,
    "pointer-events",
    baseline.pointerEvents
  )
  restoreInlineStyleValue(
    stylableElement.style,
    "content-visibility",
    baseline.contentVisibility
  )
  restoreInlineStyleValue(
    stylableElement.style,
    "transition",
    baseline.transition
  )
  restoreInlineStyleValue(
    stylableElement.style,
    "animation",
    baseline.animation
  )
}

const syncPortalVisibility = (portalRoot: Element): void => {
  const owners = portalOwnerRenderIdsByElement.get(portalRoot)
  if (!owners || owners.size === 0) {
    restorePortalInlineStyle(portalRoot)
    portalInlineStyleByElement.delete(portalRoot)
    return
  }

  const stylableElement = getStylablePortalElement(portalRoot)
  if (!stylableElement) return

  const shouldBeVisible = [...owners].some(
    (renderId) => componentStatusByRenderId.get(renderId) === "active"
  )
  ensurePortalInlineStyle(portalRoot)

  if (shouldBeVisible) {
    restorePortalInlineStyle(portalRoot)
    return
  }

  stylableElement.style.setProperty("visibility", "hidden", "important")
  stylableElement.style.setProperty("pointer-events", "none", "important")
  stylableElement.style.setProperty("content-visibility", "hidden", "important")
  stylableElement.style.setProperty("transition", "none", "important")
  stylableElement.style.setProperty("animation", "none", "important")
}

const trackComponentPortal = (renderId: string, portalRoot: Element): void => {
  const portals = portalElementsByRenderId.get(renderId) ?? new Set<Element>()
  portals.add(portalRoot)
  portalElementsByRenderId.set(renderId, portals)

  const owners =
    portalOwnerRenderIdsByElement.get(portalRoot) ?? new Set<string>()
  owners.add(renderId)
  portalOwnerRenderIdsByElement.set(portalRoot, owners)
  syncPortalVisibility(portalRoot)
}

const untrackComponentPortal = (
  renderId: string,
  portalRoot: Element
): void => {
  const portals = portalElementsByRenderId.get(renderId)
  if (!portals) return

  portals.delete(portalRoot)
  if (portals.size === 0) {
    portalElementsByRenderId.delete(renderId)
  }

  const owners = portalOwnerRenderIdsByElement.get(portalRoot)
  if (owners) {
    owners.delete(renderId)
    if (owners.size === 0) {
      portalOwnerRenderIdsByElement.delete(portalRoot)
    }
  }
  syncPortalVisibility(portalRoot)
}

const releaseComponentPortals = (renderId: string): void => {
  const portals = portalElementsByRenderId.get(renderId)
  if (!portals) return

  for (const portalRoot of [...portals]) {
    untrackComponentPortal(renderId, portalRoot)
  }
}

const syncComponentPortals = (renderId: string): void => {
  const portals = portalElementsByRenderId.get(renderId)
  if (!portals) return

  for (const portalRoot of portals) {
    syncPortalVisibility(portalRoot)
  }
}

// ---------------------------------------------------------------------------
// React Rendering
// ---------------------------------------------------------------------------

const toCssLength = (value: SlotDimension): string =>
  typeof value === "number" ? value + "px" : value

const getSlotFrameStyle = (entry: MountedComponent): React.CSSProperties => {
  if (entry.intrinsicSize || !entry.size) {
    return {
      position: "absolute",
      inset: 0,
      width: "max-content",
      height: "max-content",
      overflow: "visible",
    }
  }

  return {
    position: "absolute",
    inset: 0,
    width: toCssLength(entry.size.width),
    height: toCssLength(entry.size.height),
    overflow: "hidden",
  }
}

const getSlotContentStyle = (entry: MountedComponent): React.CSSProperties =>
  entry.intrinsicSize || !entry.size
    ? { width: "max-content", height: "max-content" }
    : { width: "100%", height: "100%" }

function ComponentReadySentinel({
  renderId,
  renderAttemptId,
  onReady,
}: {
  renderId: string
  renderAttemptId: number
  onReady: (renderId: string, renderAttemptId: number) => void
}): null {
  useLayoutEffect(() => {
    onReady(renderId, renderAttemptId)
  }, [onReady, renderId, renderAttemptId])
  return null
}

// Recovery backoff for a slot whose component fails on render/commit. A latched
// slot is a genuinely-absent projection (blank), so retrying to re-establish it
// is the safe, idempotent class of recovery; the timer only runs while a slot is
// actually erroring, so healthy slots are never re-rendered by it. Each retry
// remounts the boundary subtree, which re-runs the (Fast-Refresh-patched, or
// otherwise re-evaluated) component; once the source is fixed the first clean
// commit clears the error via ComponentReadySentinel.
const RENDER_ERROR_RETRY_INITIAL_MS = 300
const RENDER_ERROR_RETRY_MAX_MS = 5_000

// Memoized so a commit for one slot does not re-render every other slot's
// (arbitrary, user-authored) component. State transitions preserve object
// identity for unchanged slots (mountComponent / unmountComponent filter by
// renderId), active is a boolean, and onReady is a stable useCallback, so the
// default shallow compare re-renders only the slot whose component or active
// status actually changed.
const RenderSlot = React.memo(function RenderSlot({
  component,
  active,
  onReady,
}: {
  component: MountedComponent
  active: boolean
  onReady: (renderId: string, renderAttemptId: number) => void
}): React.ReactElement {
  const slotElementRef = useRef<HTMLDivElement | null>(null)
  // retryGeneration remounts the error boundary subtree to re-attempt a slot
  // that failed on render/commit. A healthy slot leaves it at 0 forever, so
  // neither a resize nor a prop update remounts the user component (which would
  // lose its state). Size flows into the slot wrappers via getSlotFrameStyle /
  // getSlotContentStyle and props flow through the spread below.
  const [retryGeneration, setRetryGeneration] = useState(0)
  const recoveryRef = useRef<{
    delayMs: number
    timer: ReturnType<typeof setTimeout> | null
  }>({ delayMs: RENDER_ERROR_RETRY_INITIAL_MS, timer: null })

  const Component = useMemo(
    () => lazy(() => loadComponent(component)),
    [
      component.component.importPath,
      component.component.importName,
      component.moduleGeneration,
    ]
  )

  const clearRecoveryTimer = useCallback((): void => {
    const recovery = recoveryRef.current
    if (recovery.timer != null) {
      clearTimeout(recovery.timer)
      recovery.timer = null
    }
  }, [])

  const handleRenderError = useCallback((): void => {
    // A thrown render is owned by the retry loop here, NOT by failing the
    // readiness claim. componentDidCatch has already surfaced the real
    // (enriched) error via reportComponentProblem, so the error pill shows
    // immediately. We must NOT reject the pending claim: a first-render throw
    // is frequently a transient mid-edit state (a half-written child, a
    // dependency that lands a tick later), and rejecting deletes the pending
    // claim outright -- so when the retry below remounts and the slot finally
    // commits cleanly, resolve finds no claim to ack and the storyboard hangs
    // un-ready forever. Leaving the claim pending lets a recovered commit
    // resolve it, while a genuinely-broken slot still falls through to the 30s
    // claim timeout (its real error is already on screen via the pill).
    const recovery = recoveryRef.current
    if (recovery.timer != null) {
      return
    }
    const delay = recovery.delayMs
    recovery.delayMs = Math.min(delay * 2, RENDER_ERROR_RETRY_MAX_MS)
    recovery.timer = setTimeout(() => {
      recovery.timer = null
      setRetryGeneration((generation) => generation + 1)
    }, delay)
  }, [])

  const handleReady = useCallback(
    (readyRenderId: string, readyRenderAttemptId: number): void => {
      // A clean commit means the slot recovered: stop retrying and reset the
      // backoff so a future failure starts fast again.
      clearRecoveryTimer()
      recoveryRef.current.delayMs = RENDER_ERROR_RETRY_INITIAL_MS
      onReady(readyRenderId, readyRenderAttemptId)
    },
    [clearRecoveryTimer, onReady]
  )

  useEffect(() => clearRecoveryTimer, [clearRecoveryTimer])

  // Commit-phase recovery hook: lets the vite:afterUpdate handler retry this
  // slot immediately when its boundary is latched, instead of waiting out the
  // backoff timer. Only ever invoked for slots whose problem slot currently
  // holds a render-error-boundary problem.
  useEffect(() => {
    const renderId = component.renderId
    const forceRetry = (): void => {
      clearRecoveryTimer()
      recoveryRef.current.delayMs = RENDER_ERROR_RETRY_INITIAL_MS
      setRetryGeneration((generation) => generation + 1)
    }
    slotRecoveryRetryCallbacks.set(renderId, forceRetry)
    return () => {
      if (slotRecoveryRetryCallbacks.get(renderId) === forceRetry) {
        slotRecoveryRetryCallbacks.delete(renderId)
      }
    }
  }, [component.renderId, clearRecoveryTimer])

  useEffect(() => {
    const slotElement = slotElementRef.current
    if (!slotElement) return

    const unregisterPortalWatcher = getPortalTracker().register({
      element: slotElement,
      onPortalFound: (portalRoot) => {
        trackComponentPortal(component.renderId, portalRoot)
      },
      onPortalRemoved: (portalRoot) => {
        untrackComponentPortal(component.renderId, portalRoot)
      },
    })

    return () => {
      unregisterPortalWatcher()
      releaseComponentPortals(component.renderId)
    }
  }, [component.renderId])

  useEffect(() => {
    syncComponentPortals(component.renderId)
  }, [active, component.renderId])

  return (
    <div
      ref={slotElementRef}
      data-render-id={component.renderId}
      data-render-status={active ? "active" : "cached"}
      style={{
        ...getSlotFrameStyle(component),
        visibility: active ? "visible" : "hidden",
        pointerEvents: active ? "auto" : "none",
      }}
      data-tempo-hide-fiber={true}
    >
      <div
        data-render-content={component.renderId}
        style={getSlotContentStyle(component)}
        data-tempo-hide-fiber={true}
      >
        <RenderErrorBoundary
          key={
            String(component.moduleGeneration) + ":" + String(retryGeneration)
          }
          renderId={component.renderId}
          onRenderError={handleRenderError}
          data-tempo-hide-fiber={true}
        >
          <Suspense fallback={null} data-tempo-hide-fiber={true}>
            <Component
              {...(component.component.props ?? {})}
              data-tempo-hide-fiber={true}
            />
            <ComponentReadySentinel
              renderId={component.renderId}
              renderAttemptId={component.renderAttemptId}
              onReady={handleReady}
              data-tempo-hide-fiber={true}
            />
          </Suspense>
        </RenderErrorBoundary>
      </div>
    </div>
  )
})

// ---------------------------------------------------------------------------
// Render Readiness
// ---------------------------------------------------------------------------
//
// A render command is not acknowledged until the lazy component export exists,
// React commits the Suspense subtree, and the browser has had one paint turn.

const componentReadyTimeoutMs = 30_000

const waitForComponentPaint = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))

function useComponentReadiness(): {
  begin: (
    command: ComponentClaimCommand,
    response: CommandResponse
  ) => MountedComponent
  resolve: (renderId: string, renderAttemptId: number) => void
  reject: (renderId: string, error: string) => boolean
} {
  const pendingComponentClaimsRef = useRef(
    new Map<
      string,
      {
        responses: CommandResponse[]
        renderAttemptId: number
        abortController: AbortController
        loadKey: string
        timeoutId: ReturnType<typeof setTimeout>
      }
    >()
  )
  const nextRenderAttemptIdRef = useRef(1)

  const reject = useCallback((renderId: string, error: string): boolean => {
    const pending = pendingComponentClaimsRef.current.get(renderId)
    if (!pending) return false
    clearTimeout(pending.timeoutId)
    pending.abortController.abort()
    pendingComponentClaimsRef.current.delete(renderId)
    for (const response of pending.responses) {
      response.error(error)
    }
    return true
  }, [])

  const begin = useCallback(
    (
      command: ComponentClaimCommand,
      response: CommandResponse
    ): MountedComponent => {
      const loadKey =
        command.component.importPath + "::" + command.component.importName
      const previousPending = pendingComponentClaimsRef.current.get(
        command.renderId
      )
      if (previousPending) {
        clearTimeout(previousPending.timeoutId)
      }

      // A new command for the same load identity (a resize or prop update while
      // the export is still loading) must NOT cancel the in-flight load: the
      // lazy element is keyed on identity and is not recreated, so aborting here
      // would reject the only load it has. Reuse the existing AbortController
      // and let the load finish. Only a genuine identity change aborts and
      // starts a fresh load (which also re-keys the lazy via importPath +
      // importName).
      const sameLoad =
        previousPending != null && previousPending.loadKey === loadKey
      if (previousPending && !sameLoad) {
        previousPending.abortController.abort()
      }
      const abortController =
        sameLoad && previousPending
          ? previousPending.abortController
          : new AbortController()
      const responses = previousPending
        ? [...previousPending.responses, response]
        : [response]

      const entry: MountedComponent = {
        ...command,
        moduleGeneration: getCanvasModuleGeneration(command.component),
        renderAttemptId: nextRenderAttemptIdRef.current++,
        abortSignal: abortController.signal,
      }
      const timeoutId = setTimeout(() => {
        pendingComponentClaimsRef.current.delete(entry.renderId)
        abortController.abort()
        for (const pendingResponse of responses) {
          pendingResponse.error(
            "Render timed out after " +
              componentReadyTimeoutMs +
              'ms for renderId "' +
              entry.renderId +
              '"'
          )
        }
      }, componentReadyTimeoutMs)
      pendingComponentClaimsRef.current.set(entry.renderId, {
        responses,
        renderAttemptId: entry.renderAttemptId,
        abortController,
        loadKey,
        timeoutId,
      })
      return entry
    },
    []
  )

  const resolve = useCallback(
    (renderId: string, renderAttemptId: number): void => {
      recordRenderCommit(renderId)
      // Clean-commit clear (always): ComponentReadySentinel only mounts when
      // the RenderErrorBoundary's children rendered without throwing, so its
      // commit is React's authoritative "this slot recovered" signal. Clear
      // the slot's error on EVERY clean commit, independent of any in-flight
      // render command -- otherwise a Fast-Refresh recovery (component
      // crashed, user fixes it, no pending claim because the original render
      // resolved long ago) leaves a stale error pill forever.
      clearComponentProblem(renderId)

      const pending = pendingComponentClaimsRef.current.get(renderId)
      if (!pending) return
      if (pending.renderAttemptId !== renderAttemptId) return
      clearTimeout(pending.timeoutId)
      pendingComponentClaimsRef.current.delete(renderId)
      // Host-scoped startup/page errors stay gated on an in-flight render: a
      // freshly requested render committing is decent evidence the host booted.
      // A standalone console-vite-error (e.g. a failed dynamic import outside an
      // HMR cycle) clears here too: a clean commit is the level-triggered signal
      // it recovered. vite-hmr-error is deliberately NOT in this list -- it is
      // owned by the HMR failure tracker (viteHmrFailedModules) and a clean
      // commit of some other slot is NOT evidence the broken module reloaded;
      // only a clean HMR cycle for that path reconciles it away. (vite-overlay
      // is likewise owned by the overlay reconcile, not this clear.)
      clearHostProblem([
        "page-error",
        "unhandled-rejection",
        "runtime-bootstrap",
        "console-vite-error",
      ])
      waitForComponentPaint().then(
        () => {
          for (const response of pending.responses) {
            response.ack()
          }
        },
        (error) => {
          for (const response of pending.responses) {
            response.error(error)
          }
        }
      )
    },
    []
  )

  useEffect(
    () => () => {
      for (const pending of pendingComponentClaimsRef.current.values()) {
        clearTimeout(pending.timeoutId)
        pending.abortController.abort()
        for (const response of pending.responses) {
          response.error("Render host unmounted before render was ready")
        }
      }
      pendingComponentClaimsRef.current.clear()
    },
    []
  )

  return { begin, resolve, reject }
}

// ---------------------------------------------------------------------------
// Message Bridge
// ---------------------------------------------------------------------------

const renderPoolBridgeCommandEvent = "__render-pool:command"
const moduleRefreshMessageType = "render-pool:module-refresh"

const postModuleRefresh = (renderIds: readonly string[]): void => {
  if (renderIds.length === 0) return
  window.postMessage(
    {
      type: moduleRefreshMessageType,
      renderIds: [...new Set(renderIds)],
    },
    "*"
  )
}

function useRenderPoolMessages(handlers: {
  onClaimComponent: (
    entry: ComponentClaimCommand,
    response: CommandResponse
  ) => void
  onReleaseComponent: (renderId: string) => void
  getState: () => unknown
}): void {
  const handlersRef = useRef(handlers)

  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  useEffect(() => {
    const isRecord = (value: unknown): value is Record<string, unknown> =>
      typeof value === "object" && value !== null && !Array.isArray(value)
    const problemWatchStops = new Map<string, () => void>()

    const readString = (value: unknown, fieldName: string): string => {
      if (typeof value !== "string" || value.length === 0) {
        throw new Error(fieldName + " must be a non-empty string")
      }
      return value
    }

    const readDimension = (value: unknown, fieldName: string): number => {
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        throw new Error(fieldName + " must be a positive finite number")
      }
      return value
    }

    const postToSource = (
      event: MessageEvent<unknown>,
      message: Record<string, unknown>
    ): void => {
      if (
        event.source &&
        typeof (event.source as Window).postMessage === "function"
      ) {
        ;(event.source as Window).postMessage(message, "*")
        return
      }
      window.postMessage(message, "*")
    }

    const onMessage = (event: MessageEvent<unknown>): void => {
      const message = event.data
      if (!isRecord(message) || typeof message.type !== "string") return

      const requestId =
        typeof message.requestId === "string" ||
        typeof message.requestId === "number"
          ? message.requestId
          : undefined

      const postAck = (): void => {
        postToSource(event, {
          type: "render-pool:ack",
          command: message.type,
          requestId,
        })
      }
      const postError = (error: unknown): void => {
        postToSource(event, {
          type: "render-pool:error",
          command: message.type,
          requestId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
      const postProblemSnapshot = (
        snapshot: ProblemSnapshot,
        watchId?: string
      ): void => {
        postToSource(event, {
          type: "render-pool:problem-snapshot",
          requestId,
          ...(watchId ? { watchId } : {}),
          payload: snapshot,
        })
      }

      try {
        if (message.type === "render-pool:render") {
          if (!isRecord(message.payload)) {
            throw new Error("render-pool:render payload must be an object")
          }

          const props = isRecord(message.payload.props)
            ? message.payload.props
            : undefined
          const hasWidth = message.payload.width != null
          const hasHeight = message.payload.height != null
          let size: Dimensions | undefined

          if (hasWidth || hasHeight) {
            if (!hasWidth || !hasHeight) {
              throw new Error("width and height must be provided together")
            }
            size = {
              width: readDimension(message.payload.width, "width"),
              height: readDimension(message.payload.height, "height"),
            }
          }

          const entry: ComponentClaimCommand = {
            renderId: readString(message.payload.renderId, "renderId"),
            component: {
              importPath: readString(message.payload.importPath, "importPath"),
              importName: readString(message.payload.importName, "importName"),
              ...(props ? { props } : {}),
            },
            ...(size ? { size } : {}),
            ...(message.payload.intrinsicSize === true
              ? { intrinsicSize: true }
              : {}),
          }
          handlersRef.current.onClaimComponent(entry, {
            ack: postAck,
            error: postError,
          })
          return
        }

        if (message.type === "render-pool:unrender") {
          if (!isRecord(message.payload)) {
            throw new Error("render-pool:unrender payload must be an object")
          }
          const renderId = readString(message.payload.renderId, "renderId")
          handlersRef.current.onReleaseComponent(renderId)
          postAck()
          return
        }

        if (message.type === "render-pool:list") {
          postToSource(event, {
            type: "render-pool:state",
            requestId,
            payload: handlersRef.current.getState(),
          })
          return
        }

        if (message.type === "render-pool:query-problems") {
          postProblemSnapshot(getProblemSnapshot())
          return
        }

        if (message.type === "render-pool:query-health") {
          const renderId =
            isRecord(message.payload) &&
            typeof message.payload.renderId === "string"
              ? message.payload.renderId
              : ""
          postToSource(event, {
            type: "render-pool:health-snapshot",
            requestId,
            snapshot: buildHealthSnapshot(renderId),
          })
          return
        }

        if (message.type === "render-pool:watch-problems") {
          if (!isRecord(message.payload)) {
            throw new Error(
              "render-pool:watch-problems payload must be an object"
            )
          }
          const watchId = readString(message.payload.watchId, "watchId")
          problemWatchStops.get(watchId)?.()
          postAck()
          problemWatchStops.set(
            watchId,
            watchProblemSnapshot((snapshot) => {
              postProblemSnapshot(snapshot, watchId)
            })
          )
          return
        }

        if (message.type === "render-pool:unwatch-problems") {
          if (!isRecord(message.payload)) {
            throw new Error(
              "render-pool:unwatch-problems payload must be an object"
            )
          }
          const watchId = readString(message.payload.watchId, "watchId")
          problemWatchStops.get(watchId)?.()
          problemWatchStops.delete(watchId)
          postAck()
          return
        }
      } catch (error) {
        postError(error)
      }
    }

    window.addEventListener("message", onMessage)
    const onBridgeCommand = (event: Event): void => {
      const message = event instanceof CustomEvent ? event.detail : undefined
      onMessage({ data: message, source: null } as MessageEvent<unknown>)
    }
    window.addEventListener(renderPoolBridgeCommandEvent, onBridgeCommand)

    return () => {
      window.removeEventListener("message", onMessage)
      window.removeEventListener(renderPoolBridgeCommandEvent, onBridgeCommand)
      for (const stop of problemWatchStops.values()) {
        stop()
      }
      problemWatchStops.clear()
    }
  }, [])
}

// ---------------------------------------------------------------------------
// Direct URL Bootstrap
// ---------------------------------------------------------------------------
//
// Useful for opening the host iframe directly during capture/debug flows. It
// creates the same render command that the parent normally sends by message.

// A direct-URL dimension is a positive number (pixels) or a number suffixed
// with px, vw, or vh. Viewport units pin the slot to the host's live viewport
// so an embedding iframe's resize reflows the content through pure CSS — the
// canvas interact iframe passes width=100vw&height=100vh this way to keep the
// content tracking the storyboard's box while the user drag-resizes it.
const directUrlDimensionUnits = ["px", "vw", "vh"]

const readDirectUrlDimension = (raw: string, label: string): SlotDimension => {
  const unit = directUrlDimensionUnits.find((candidate) =>
    raw.endsWith(candidate)
  )
  const numberPart = unit ? raw.slice(0, -unit.length) : raw
  const value = Number(numberPart)
  if (!numberPart || !Number.isFinite(value) || value <= 0) {
    throw new Error(
      "Direct URL " +
        label +
        " must be a positive finite number, optionally with a px, vw, or vh unit"
    )
  }
  // Pixel values stay numeric so they behave exactly like parent-sent sizes.
  return !unit || unit === "px" ? value : value + unit
}

const readDirectUrlSize = (
  params: URLSearchParams
): SlotDimensions | undefined => {
  const widthParam = params.get("width")?.trim()
  const heightParam = params.get("height")?.trim()
  if (!widthParam && !heightParam) return undefined
  if (!widthParam || !heightParam) {
    throw new Error("Direct URL width and height must be provided together")
  }

  return {
    width: readDirectUrlDimension(widthParam, "width"),
    height: readDirectUrlDimension(heightParam, "height"),
  }
}

const createDirectComponentClaim = (
  component: ComponentDefinition,
  size: SlotDimensions | undefined
): ComponentClaimCommand => ({
  renderId: "url",
  component,
  ...(size ? { size } : {}),
})

const readDirectComponentClaimFromUrl = (): ComponentClaimCommand | null => {
  if (typeof window === "undefined") return null

  const params = new URLSearchParams(window.location.search)
  const importPath =
    params.get("importPath")?.trim() ?? params.get("pageFile")?.trim() ?? ""
  const importName =
    params.get("importName")?.trim() ?? params.get("exportName")?.trim() ?? ""
  const size = readDirectUrlSize(params)

  if (importPath && importName) {
    return createDirectComponentClaim({ importPath, importName }, size)
  }

  const registryPath = params.get("path")?.trim() ?? ""
  if (!registryPath) return null

  const namedExportMatch = registryPath.match(/^(.*\.[^/?#]+)\/([^/?#]+)$/)
  if (namedExportMatch) {
    return createDirectComponentClaim(
      { importPath: namedExportMatch[1], importName: namedExportMatch[2] },
      size
    )
  }

  return createDirectComponentClaim(
    { importPath: registryPath, importName: "default" },
    size
  )
}

const renderContentSlotExists = (renderId: string): boolean =>
  document.querySelector(buildRenderContentSelector(renderId)) != null

const sizeMatches = (
  current: SlotDimensions | undefined,
  next: SlotDimensions | undefined
): boolean => current?.width === next?.width && current?.height === next?.height

const componentPropsMatch = (
  current: Record<string, unknown> | undefined,
  next: Record<string, unknown> | undefined
): boolean => JSON.stringify(current ?? {}) === JSON.stringify(next ?? {})

const mountedComponentMatchesCommand = (
  current: MountedComponent,
  next: ComponentClaimCommand
): boolean =>
  current.component.importPath === next.component.importPath &&
  current.component.importName === next.component.importName &&
  current.moduleGeneration === getCanvasModuleGeneration(next.component) &&
  componentPropsMatch(current.component.props, next.component.props) &&
  sizeMatches(current.size, next.size) &&
  current.intrinsicSize === next.intrinsicSize

// ---------------------------------------------------------------------------
// Component Renderer
// ---------------------------------------------------------------------------

export default function ComponentRenderer(): React.ReactElement {
  useHostProblemCapture()
  useViteProblemCapture()

  const [componentState, setComponentState] = useState<RenderState>({
    mountedComponents: [],
    claimedComponentIds: [],
    cachedComponents: [],
  })
  const componentStateRef = useRef(componentState)
  const {
    begin: beginComponentReadiness,
    reject: rejectComponentReadiness,
    resolve: resolveComponentReadiness,
  } = useComponentReadiness()

  const commitComponentState = useCallback((nextState: RenderState): void => {
    const claimedComponentIds = new Set(nextState.claimedComponentIds)

    // Rebuild the status map and record which slots actually changed status, so
    // portal visibility is re-synced only for those slots rather than for every
    // mounted slot on every commit. Status must be written before syncing --
    // syncPortalVisibility reads componentStatusByRenderId.
    const nextStatusByRenderId = new Map<string, "active" | "cached">()
    const changedRenderIds: string[] = []
    for (const mountedComponent of nextState.mountedComponents) {
      const status = claimedComponentIds.has(mountedComponent.renderId)
        ? "active"
        : "cached"
      nextStatusByRenderId.set(mountedComponent.renderId, status)
      if (componentStatusByRenderId.get(mountedComponent.renderId) !== status) {
        changedRenderIds.push(mountedComponent.renderId)
      }
    }
    componentStatusByRenderId.clear()
    for (const [renderId, status] of nextStatusByRenderId) {
      componentStatusByRenderId.set(renderId, status)
    }

    componentStateRef.current = nextState
    setComponentState(nextState)
    for (const renderId of changedRenderIds) {
      syncComponentPortals(renderId)
    }
  }, [])

  useEffect(
    () =>
      subscribeCanvasModuleChanges((changes) => {
        const current = componentStateRef.current
        let didChange = false
        const refreshedRenderIds: string[] = []
        const mountedComponents = current.mountedComponents.map((component) => {
          const change = changes.find(
            (candidate) =>
              candidate.importPath === component.component.importPath &&
              (!candidate.changedExports ||
                candidate.changedExports.includes(
                  component.component.importName
                ))
          )
          if (!change) {
            return component
          }
          const moduleGeneration = getCanvasModuleGeneration(
            component.component
          )
          if (component.moduleGeneration === moduleGeneration) {
            return component
          }
          didChange = true
          refreshedRenderIds.push(component.renderId)
          return { ...component, moduleGeneration }
        })
        if (!didChange) return
        commitComponentState({ ...current, mountedComponents })
        postModuleRefresh(refreshedRenderIds)
      }),
    [commitComponentState]
  )

  const mountComponent = useCallback(
    (current: RenderState, component: MountedComponent): RenderState => ({
      mountedComponents: [
        ...current.mountedComponents.filter(
          (existing) => existing.renderId !== component.renderId
        ),
        component,
      ],
      claimedComponentIds: current.claimedComponentIds,
      cachedComponents: current.cachedComponents.filter(
        (existing) => existing.renderId !== component.renderId
      ),
    }),
    []
  )

  const unmountComponent = useCallback(
    (current: RenderState, renderId: string): RenderState => {
      releaseComponentPortals(renderId)
      deleteComponentProblemSlot(renderId)
      deleteRenderCommitSnapshot(renderId)
      return {
        mountedComponents: current.mountedComponents.filter(
          (mountedComponent) => mountedComponent.renderId !== renderId
        ),
        claimedComponentIds: current.claimedComponentIds.filter(
          (id) => id !== renderId
        ),
        cachedComponents: current.cachedComponents.filter(
          (cachedComponent) => cachedComponent.renderId !== renderId
        ),
      }
    },
    []
  )

  const unmountLeastRecentlyCachedComponents = useCallback(
    (current: RenderState): RenderState => {
      const overage =
        current.cachedComponents.length - maxCachedComponentsToKeepMounted
      if (overage <= 0) return current

      let nextState = current
      const componentsToUnmount = [...current.cachedComponents]
        .sort((a, b) => a.cachedAt - b.cachedAt)
        .slice(0, overage)
      for (const cachedComponent of componentsToUnmount) {
        nextState = unmountComponent(nextState, cachedComponent.renderId)
      }
      return nextState
    },
    [unmountComponent]
  )

  const releaseComponent = useCallback(
    (current: RenderState, renderId: string): RenderState =>
      unmountLeastRecentlyCachedComponents({
        mountedComponents: current.mountedComponents,
        claimedComponentIds: current.claimedComponentIds.filter(
          (id) => id !== renderId
        ),
        cachedComponents: [
          ...current.cachedComponents.filter(
            (cachedComponent) => cachedComponent.renderId !== renderId
          ),
          { renderId, cachedAt: Date.now() },
        ],
      }),
    [unmountLeastRecentlyCachedComponents]
  )

  const claimComponent = useCallback(
    (command: ComponentClaimCommand, response: CommandResponse): void => {
      ensureComponentProblemSlot(command.renderId)
      const current = componentStateRef.current
      const currentComponent = current.mountedComponents.find(
        (mountedComponent) => mountedComponent.renderId === command.renderId
      )
      if (
        currentComponent &&
        current.claimedComponentIds.includes(command.renderId) &&
        mountedComponentMatchesCommand(currentComponent, command) &&
        renderContentSlotExists(command.renderId)
      ) {
        response.ack()
        return
      }

      const component = beginComponentReadiness(command, response)
      const mountedState = mountComponent(current, component)
      commitComponentState({
        ...mountedState,
        claimedComponentIds: [
          ...mountedState.claimedComponentIds.filter(
            (id) => id !== component.renderId
          ),
          component.renderId,
        ],
      })
    },
    [beginComponentReadiness, commitComponentState, mountComponent]
  )

  useEffect(() => {
    const command = readDirectComponentClaimFromUrl()
    if (!command) return

    claimComponent(command, {
      ack: () => undefined,
      error: (error) => {
        console.error("Direct URL render failed", error)
      },
    })
  }, [claimComponent])

  // Stable handlers object so useRenderPoolMessages' ref-sync effect does not
  // re-run on every render. All dependencies are stable (claimComponent and the
  // state transitions are useCallback([...]) with stable deps), so this object
  // is created once.
  const messageHandlers = useMemo(
    () => ({
      onClaimComponent: claimComponent,
      onReleaseComponent: (renderId: string): void => {
        const wasPending = rejectComponentReadiness(
          renderId,
          "Render was removed before it became ready"
        )
        const current = componentStateRef.current
        const mountedComponent = current.mountedComponents.find(
          (component) => component.renderId === renderId
        )
        if (!mountedComponent) return

        if (!current.claimedComponentIds.includes(renderId)) return

        if (wasPending) {
          commitComponentState(unmountComponent(current, renderId))
          return
        }

        commitComponentState(releaseComponent(current, renderId))
      },
      getState: (): unknown => {
        const { claimedComponentIds, mountedComponents } =
          componentStateRef.current
        return {
          renders: mountedComponents.map((component) => ({
            renderId: component.renderId,
            importPath: component.component.importPath,
            importName: component.component.importName,
            props: component.component.props,
            size: component.size,
            intrinsicSize: component.intrinsicSize,
            status: claimedComponentIds.includes(component.renderId)
              ? "active"
              : "cached",
          })),
          maxCached: maxCachedComponentsToKeepMounted,
          problems: getProblemSnapshot(),
        }
      },
    }),
    [
      claimComponent,
      rejectComponentReadiness,
      commitComponentState,
      unmountComponent,
      releaseComponent,
    ]
  )

  useRenderPoolMessages(messageHandlers)

  return (
    <div
      data-render-host
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: "transparent",
      }}
      data-tempo-hide-fiber={true}
    >
      {componentState.mountedComponents.map((component) => (
        <RenderSlot
          key={component.renderId}
          component={component}
          active={componentState.claimedComponentIds.includes(
            component.renderId
          )}
          onReady={resolveComponentReadiness}
          data-tempo-hide-fiber={true}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Document Baseline
// ---------------------------------------------------------------------------
//
// The iframe should contribute only the rendered component pixels. The canvas
// around it owns selection, chrome, background, and screenshots.

if (typeof document !== "undefined") {
  document.documentElement.style.background = "transparent"
  document.body.style.background = "transparent"
  document.body.style.margin = "0"
}
