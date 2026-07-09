import posthog from "posthog-js"

/**
 * Client-side product analytics for the Fleet Pi chat app.
 *
 * The chat funnel (`chat_session_started` → `conversation_saved`) is captured
 * with posthog-js from the browser. Everything here is a no-op unless
 * `VITE_PUBLIC_POSTHOG_KEY` is configured, so local runs and CI without a key
 * behave exactly as before.
 */

const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY as
  | string
  | undefined
const POSTHOG_HOST =
  (import.meta.env.VITE_PUBLIC_POSTHOG_HOST as string | undefined) ??
  "https://eu.i.posthog.com"

let initialized = false

function isBrowser() {
  return typeof window !== "undefined"
}

/** Whether analytics is configured and running in the browser. */
export function isAnalyticsEnabled() {
  return initialized
}

/**
 * Initialize posthog-js once, in the browser, when a key is configured.
 * Safe to call repeatedly — subsequent calls are ignored.
 */
export function initAnalytics() {
  if (initialized || !isBrowser() || !POSTHOG_KEY) return
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,
    capture_pageleave: true,
    person_profiles: "identified_only",
  })
  initialized = true
}

/** Associate subsequent events with a signed-in user. */
export function identifyAnalyticsUser(user: {
  id: string
  email?: string | null
  name?: string | null
}) {
  if (!initialized) return
  posthog.identify(user.id, {
    email: user.email ?? undefined,
    name: user.name ?? undefined,
  })
}

/** Clear the identity on sign-out so the next user starts fresh. */
export function resetAnalytics() {
  if (!initialized) return
  posthog.reset()
}

function capture(event: string, properties?: Record<string, unknown>) {
  if (!initialized) return
  posthog.capture(event, properties)
}

/**
 * A chat session began — fired when the first prompt of a fresh session is
 * sent. `prompt_length` is the character length of that opening prompt.
 */
export function captureChatSessionStarted(input: {
  promptLength: number
  sessionId?: string
}) {
  capture("chat_session_started", {
    prompt_length: input.promptLength,
    session_id: input.sessionId,
  })
}

/**
 * A conversation was saved — fired when an assistant turn completes and the
 * session is persisted. `message_count` is the total messages at save time.
 */
export function captureConversationSaved(input: {
  messageCount: number
  sessionId?: string
}) {
  capture("conversation_saved", {
    message_count: input.messageCount,
    session_id: input.sessionId,
  })
}
