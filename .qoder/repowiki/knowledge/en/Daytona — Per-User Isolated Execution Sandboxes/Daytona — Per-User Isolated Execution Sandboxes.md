---
kind: external_dependency
name: Daytona — Per-User Isolated Execution Sandboxes
slug: daytona
category: external_dependency
category_hints:
  - vendor_identity
  - client_constraint
scope:
  - "**"
---

### Daytona

- Provides per-user isolated execution environments with durable volumes and credential isolation for agent workspace operations
- Requires BYOK `daytona` key per user in `pi_user_providers` on Vercel deployments — org-level keys are not used for end-user sandbox access
- Configurable via `DAYTONA_API_KEY`, optional `DAYTONA_API_URL` and `DAYTONA_TARGET`; webhook signature verification via `DAYTONA_WEBHOOK_SECRET`
- Repository URL seeding (`FLEET_PI_REPOSITORY_URL`) used to sparse-seed agent-workspace into empty Daytona volumes
- Client constraint: requires external service dependency that prevents running full E2E suite in CI without proper mocking
