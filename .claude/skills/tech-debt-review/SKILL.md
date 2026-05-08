---
name: tech-debt-review
description: Scan for TODO/FIXME/HACK/BUG markers across apps/web/src and packages/ui/src, then triage by impact
---

1. Run `pnpm tech-debt` from the repo root (writes `tech-debt-report.json`; exits 1 when markers found — that's expected)
2. Read `tech-debt-report.json`
3. Group findings by marker severity: FIXME > BUG > HACK > TODO > XXX
4. For each FIXME and BUG item, estimate fix cost (small/medium/large) and suggest a priority
5. Output a ranked triage table with columns: Marker | File | Line | Estimated effort | Suggested priority
