---
kind: external_dependency
name: PostHog — Product Analytics & Telemetry
slug: posthog
category: external_dependency
category_hints:
  - vendor_identity
  - client_constraint
scope:
  - "**"
---

### PostHog

- Client-side analytics for chat funnel telemetry (chat_session_started, conversation_saved) and pageview capture
- Optional feature controlled by `VITE_PUBLIC_POSTHOG_KEY` and `VITE_PUBLIC_POSTHOG_HOST` environment variables
- Capture calls become no-ops when unset, allowing complete disablement of analytics
- Default host is `https://eu.i.posthog.com` for EU data residency
