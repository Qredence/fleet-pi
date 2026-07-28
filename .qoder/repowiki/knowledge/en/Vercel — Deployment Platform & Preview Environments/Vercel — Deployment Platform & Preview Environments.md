---
kind: external_dependency
name: Vercel — Deployment Platform & Preview Environments
slug: vercel
category: external_dependency
category_hints:
  - vendor_identity
  - migration_status
scope:
  - "**"
---

### Vercel

- Deployment platform for the web application with Nitro preset (`NITRO_PRESET=vercel`) and custom build/install commands
- Preview environments with trust-zone contract verification for different deployment targets (production vs preview)
- Environment variables include `VERCEL`, `VERCEL_ENV`, and placeholder secrets for CI validation
- Migration status: deployment readiness verification includes migration probes requiring separate database URLs from secrets
