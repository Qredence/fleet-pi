# PostHog Self-driving Setup Report

_Generated: 2026-07-25_

## Summary

PostHog Self-driving has been configured for the Qredence / Fleet Pi project. Session Replay, Error Tracking, Support, and Health Checks signal sources are enabled (most were already active from a prior setup run), and the scout troop of 9 active scouts — including 3 custom Fleet Pi scouts — is running within the 24-run/day budget. Findings will start appearing in your [Self-driving inbox](https://eu.posthog.com/project/15008/inbox) within ~30 minutes.

---

## AI Data Processing

**Status: Approved.** Organization-level AI data processing consent was verified before this run started.

---

## GitHub

**Status: Already connected.**

The PostHog GitHub App was already installed for the `Qredence` organization (integration ID `69928`, connected 2026-07-09). No action needed.

---

## Products Enabled

| Product                 | Status          | Notes                                                                                                  |
| ----------------------- | --------------- | ------------------------------------------------------------------------------------------------------ |
| Session Replay          | Already enabled | Recordings actively flowing (`posthog.init` has no `disable_session_recording` override)               |
| Error Tracking          | Already enabled | No `capture_exceptions: false` in `posthog.init`                                                       |
| Support (Conversations) | Enabled         | Tickets will arrive only once an inbound channel (email / inbox / Slack) is connected — see Follow-ups |

> **Web app note:** `apps/web/src/lib/analytics/posthog.ts` initializes `posthog-js` with no overrides that would cancel the server-side product enables. The init is clean.

> **Note:** The `products-enable` MCP tool was not available in this MCP version. Session Replay and Error Tracking were confirmed active via server-side probes (recordings and issues queries). Support was confirmed enabled via the existing `conversations/ticket` signal source row.

---

## Signal Sources

| Source product   | Source type                | Action                                                  | Notes                                                         |
| ---------------- | -------------------------- | ------------------------------------------------------- | ------------------------------------------------------------- |
| `signals_scout`  | `cross_source_issue`       | No row needed                                           | Scout gate is ON by default — no config row required          |
| `health_checks`  | `health_issue`             | **Created** (ID `019f9ac4-2d64-7551-b214-0af68cc59fdc`) | New this run                                                  |
| `error_tracking` | `issue_created`            | Already enabled                                         | —                                                             |
| `error_tracking` | `issue_reopened`           | Already enabled                                         | —                                                             |
| `error_tracking` | `issue_spiking`            | Already enabled                                         | —                                                             |
| `session_replay` | `session_analysis_cluster` | Already enabled                                         | —                                                             |
| `conversations`  | `ticket`                   | Already enabled                                         | Dormant until inbound channel is connected                    |
| `github`         | `issue`                    | Already enabled                                         | GitHub Issues warehouse source already connected              |
| `linear`         | `issue`                    | Already enabled (status: **failed**)                    | See Follow-ups — Linear warehouse source is in a failed state |
| `llm_analytics`  | `evaluation_report`        | Skipped (already exists)                                | Not a v1 user-facing responder; left as-is                    |

---

## Connected Tools

| Tool          | Status                                             | Notes                                                                                                                                                                                                                                                                          |
| ------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GitHub Issues | **Verified connected**                             | Warehouse source (ID `019f45c3-dcb0-0000-5235-1cc1b4d54e8a`, type `Github`) connected 2026-07-09, status `Completed`. 13 issues synced, syncing every 6 hours. Only the `issues` table is syncing — enable more tables (PRs, releases, etc.) in the data sources UI if needed. |
| Linear        | Already had responder, warehouse source **failed** | `linear/issue` responder is enabled; the Linear warehouse source has `status: failed`. See Follow-ups.                                                                                                                                                                         |

---

## Scout Troop

**Run budget:** 24 runs/day max · 9 used today · 15 remaining  
**Early access notice:** _"Scouts are in early access so daily runs are limited to 24 by default for now, please reach out to team-self-driving@posthog.com if you would like more runs."_

### Enabled (9 scouts)

| Scout                            | Type      | Reason kept                                                                                     |
| -------------------------------- | --------- | ----------------------------------------------------------------------------------------------- |
| `signals-scout-general`          | Canonical | Always on — cross-product correlations and uncovered surfaces                                   |
| `signals-scout-ai-observability` | Canonical | Primary product surface: Fleet Pi is an AI agent workspace (Gemini, OpenAI, Anthropic via BYOK) |
| `signals-scout-surveys`          | Canonical | LLM feedback survey active (2 surveys in project)                                               |
| `signals-scout-web-analytics`    | Canonical | qredence.ai sessions flowing — watches traffic and landing pages                                |
| `signals-scout-insight-alerts`   | Canonical | Already enabled (prior run) — watches fired insight alerts                                      |
| `signals-scout-skills-store`     | Canonical | Already enabled (prior run) — PostHog skills hygiene                                            |
| `signals-scout-chat-abandonment` | Custom    | Watches `chat_stopped` / `chat_message_sent` ratio for AI quality/latency regressions           |
| `signals-scout-chat-funnel`      | Custom    | Watches sign-in → chat session creation → first message for conversion regressions              |
| `signals-scout-rlm-run-health`   | Custom    | Watches fleet-rlm agent run pipeline: completion rate, failure modes, trajectory production     |

### Disabled

| Scout                              | Reason                                                                                       |
| ---------------------------------- | -------------------------------------------------------------------------------------------- |
| `signals-scout-error-tracking`     | Intentional — covered by native `error_tracking` sources (no duplicate needed)               |
| `signals-scout-session-replay`     | Intentional — covered by native `session_replay` source (no duplicate needed)                |
| `signals-scout-anomaly-detection`  | Not in top 2–3 specialists for this project                                                  |
| `signals-scout-apm`                | No OpenTelemetry/APM traces in use                                                           |
| `signals-scout-conversations`      | Support product enabled but no inbound channel yet                                           |
| `signals-scout-csp-violations`     | No CSP reporting configured in this repo                                                     |
| `signals-scout-customer-analytics` | No group/accounts analytics evidence                                                         |
| `signals-scout-data-pipelines`     | No CDP destinations or batch exports in use                                                  |
| `signals-scout-data-warehouse`     | Not picked this run; consider enabling to catch the Linear sync failure — see Follow-ups     |
| `signals-scout-experiments`        | No active A/B experiments evidenced                                                          |
| `signals-scout-feature-flags`      | No PostHog feature flag usage confirmed in repo                                              |
| `signals-scout-health-checks`      | Not picked this run; health issues surface via the new `health_checks` native source instead |
| `signals-scout-inbox-validation`   | Not appropriate for fresh setup (no shipped fixes yet)                                       |
| `signals-scout-ingestion-warnings` | Not in top specialists                                                                       |
| `signals-scout-logs`               | PostHog logs product not in use                                                              |
| `signals-scout-mcp-tool-calls`     | Not in top specialists                                                                       |
| `signals-scout-observability-gaps` | Not in top specialists                                                                       |
| `signals-scout-product-analytics`  | Not in top specialists for current usage profile                                             |
| `signals-scout-replay-vision`      | No Replay Vision scanners configured                                                         |
| `signals-scout-revenue-analytics`  | No payment SDK (Stripe etc.) in this repo                                                    |
| `signals-scout-tasks`              | Not in top specialists                                                                       |
| `signals-scout-web-vitals`         | Not in top specialists (web-analytics covers traffic; web-vitals adds per-page CWV detail)   |

> **Re-enable note:** To watch any of the surface-specific disabled scouts later, enable them in PostHog → Inbox → Scout settings. To switch a noisy scout to dry-run without disabling it, set `emit: false` on its config.

---

## Custom Scouts

**Outcome: No new custom scouts created this run.** The project already has 3 well-targeted custom scouts from a prior setup run (`chat-abandonment`, `chat-funnel`, `rlm-run-health`).

**Surfaces considered and ruled out:**

| Surface                                     | Filter that disqualified it                                                                                     |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Daytona sandbox provisioning health         | Not watchable — no concrete PostHog capture events confirmed for sandbox creation/failure                       |
| Data warehouse sync health (Linear failing) | Covered by the disabled built-in `signals-scout-data-warehouse` — better to enable that scout than duplicate it |
| BYOK provider credential health             | Covered: behavioral signal by `chat-abandonment`, exceptions by error tracking native source                    |
| Model selection onboarding funnel           | Not watchable — no `model_enabled` or `settings_saved` events confirmed in analytics code                       |

**Noise escape hatch:** To put any scout in dry-run (it runs and finds things but doesn't write to the inbox), set `emit: false` on its config in PostHog.

---

## Follow-ups

- [ ] **Connect a Support inbound channel** — Conversations is enabled but tickets only arrive once you connect email, inbox, or Slack in PostHog settings.
- [ ] **Fix the Linear warehouse source** — The `linear/issue` responder is enabled but the Linear warehouse source has `status: failed`. Reconnect or re-authorize it at [PostHog → Data sources](https://eu.posthog.com/project/15008/data-management/sources). The `linear/issue` signal responder will start delivering findings automatically once the sync recovers.
- [ ] **Enable `signals-scout-data-warehouse`** — This built-in scout watches external data source sync health (Linear, GitHub, etc.). Enabling it in PostHog → Inbox → Scout settings would have caught the Linear failure automatically.
- [ ] **Verify error tracking is capturing exceptions** — No error tracking issues were found in this project. Confirm that `posthog.init` in production has exception autocapture active (it's not disabled in code, but verify the Vercel environment has the PostHog key set so the SDK actually runs).
- [ ] **Connect a Conversations inbound channel** — Once connected, the `conversations/ticket` signal source will begin routing tickets to the inbox automatically.
- [ ] **Review `products-enable` availability** — The `products-enable` MCP tool was unavailable in this run. Products were confirmed active via probes, but a future setup run should verify the tool is available for authoritative enables.

---

## What Happens Next

- The scout coordinator picks up fresh configs within **~30 minutes**; the first scans fire on the next tick.
- Each scout run draws from the project's daily budget (24 runs/day by default during early access).
- Findings cluster into reports in the [Self-driving inbox](https://eu.posthog.com/project/15008/inbox).
- Immediately-actionable reports (regression + reproduce steps + fix pointer) can trigger coding tasks automatically.
- The 3 existing custom scouts (`chat-abandonment`, `chat-funnel`, `rlm-run-health`) and all built-in specialists are already due and will run on their next tick.
