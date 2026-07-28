---
kind: external_dependency
name: Neon Postgres — Database & Managed Auth Provider
slug: neon-postgres
category: external_dependency
category_hints:
  - vendor_identity
  - auth_protocol
scope:
  - "**"
---

### Neon Postgres

- Primary database for session mirroring, settings persistence, and authentication; configured via `FLEET_PI_AUTH_DATABASE_URL` and `FLEET_PI_CHAT_DATABASE_URL`
- Managed Auth integration: when `NEON_AUTH_BASE_URL` is set, the app proxies auth to Neon Managed Auth instead of local Better Auth, using JWKS-verified JWTs with issuer/audience validation
- Branch preview databases with TTL (7d) and protected main branch; data API disabled in favor of server/Function path with `fleet_pi_app` role
- Migration scripts require separate owner connection strings (`*_MIGRATION_DATABASE_URL`) with DDL privileges
- Verify exact environment variable names and JWT validation against official Neon docs
