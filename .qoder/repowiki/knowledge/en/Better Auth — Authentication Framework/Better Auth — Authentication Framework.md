---
kind: external_dependency
name: Better Auth — Authentication Framework
slug: better-auth
category: external_dependency
category_hints:
  - vendor_identity
  - auth_protocol
scope:
  - "**"
---

### Better Auth

- Local authentication framework used as fallback when Neon Managed Auth is not configured
- Supports email/password, Google OAuth, and anonymous authentication modes
- Cookie-based authentication with JWT tokens; secret management via `BETTER_AUTH_SECRET` or `NEON_AUTH_COOKIE_SECRET`
- Base URL configuration via `BETTER_AUTH_URL` for OAuth callback URLs
- Under Neon Managed Auth, still required for BYOK provider encryption (AES-GCM)
