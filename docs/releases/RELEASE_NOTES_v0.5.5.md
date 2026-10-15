## What's Changed

Fleet Pi v0.5.5 upgrades to Pi 0.80.10, cuts over to Neon Managed Auth, adds per-user Daytona BYOK sandboxes, and hardens Vercel multi-tenant security.

### Highlights

- **Pi 0.80.10 upgrade** — Neon Managed Auth, chat Function runtime, and Neon deploy workflow (#67). The runtime supports the full Neon Managed Auth server/Function pattern with JWKS Bearer JWT, per-user `pi_*` tenancy RLS, and Data API isolation.
- **Daytona BYOK sandboxes** — `resolveUserSandboxContext` provisions per-user sandboxes with durable volumes (`fleet-pi-ws-{userId}`) and optional Secrets API integration. Org keys never back end-user sandboxes on Vercel.
- **Vercel multi-tenant hardening** — LLM provider env keys are scrubbed from the process so only the signed-in user's BYOK credentials are used. Neon-managed identity, fail-closed mirror ownership, and `FORCE ROW LEVEL SECURITY` on `pi_*` tables.
- **Explicit model selection** — `enabledModels: []` is the deny-all default; users must explicitly add models via Settings > LLM Models. No more hard-coded Gemini fallback.
- **Inline provider panel** — Add provider is now an inline drill-down (picker → configure) inside Settings, not a nested Dialog. BYOK-only providers list.

### Breaking changes for forks

- `enabledModels: []` now means deny-all. Previously, omitting it meant allow-all. If you relied on the implicit allow-all, set `"enabledModels": undefined` (or remove the key) in `.pi/settings.json`.
- Neon Managed Auth replaces Better Auth as the primary identity layer. Re-authentication is required; run `pnpm remap-auth-user-ids -- --file=remap.csv` for best-effort email remap.
- `FLEET_PI_CHAT_RUNTIME_URL` and `NEON_AUTH_BASE_URL` env vars now control the Neon Function runtime and Managed Auth respectively. See `.env.example`.
- Chat runtime `FLEET_PI_CHAT_DATABASE_URL` must be a non-owner `fleet_pi_app` connection string when RLS is enabled.

### Commit summary

- feat: Pi 0.80.10, Neon Managed Auth, and chat Function runtime (#67) (e6a7f0d)
- fix(web): pin tslib@2 for externalized Daytona on Vercel (#68) (659c16c)
- fix(web): keep AsyncLocalStorage out of client auth bundle (2129002)
- fix(web): fetch Neon Auth JWT from /token instead of getJWTToken proxy (1e6f980)
- fix(web): fall back to org LLM env keys on Vercel when BYOK is empty (c4ea145)
- fix(web): keep first Vercel LLM env snapshot across dual service create (0ccce98)
- fix(ui): restore BYOK-only Providers list and nested Add dialog clicks (f280eb5)
- fix(ui): make Add provider an inline Settings panel (935db52)
- fix(web): accept Neon JWT on providers save and parse API errors (0a5f262)
- fix(settings): persist LLM model prefs through Neon hydrate on Vercel (f1a06c6)
- fix(auth): fail closed on Neon JWTs and mirror ownership (819f38e)
- feat(neon): deploy and verify Auth, buckets, and chat Function (ad44f80)
- fix(auth): tolerate null Neon Auth get-session payload (4644a96)
- fix(auth): derive Neon JWT issuer and clear broken auth RLS (938049f)
- fix(security): Harden workspace and network boundaries (65f0fce)
- fix(ci): Make documented Neon commands available (d84d458)
- chore: ignore local codex-security artifacts (e9842a9)
- fix(security): enable auth RLS and InitPlan-safe pi policies (80d901e)
- fix(security): drop legacy public auth tables under Managed Auth (aec9de6)
- codex: fix CI failure on PR #69 (ffab962)
- ci: add Neon preview branch workflow for pull requests (fdbe516)
- fix(auth): Align Neon Data API RLS with Managed Auth (e6fe3d9)
- Harden workspace paths and bound URL dispatcher cache (8dfe1b1)
- fix(security): Canonicalize workspace roots (f6efa45)
- fix(ci): Regenerate dependency lockfile (b19c348)
- codex: fix CI failure on PR #69 (801f18f)
- Merge pull request #69 from Qredence/codex/fix-security-hardening (544c503)
- chore: keep Pi settings as overrides-only (4a7434d)
- fix(auth): Harden Neon Managed Auth isolation for closed beta (a0bed6f)
- Merge origin/main into improve/config-handling-llm-providers-daytona (5c3989b)
- fix(auth): Align Neon Managed Auth with server/Function path (37cd5e1)
- codex: fix CI failure on PR #70 (c49deac, 4ca23d5, dfbe249)
- Merge pull request #70 from Qredence/improve/config-handling-llm-providers-daytona (2dabd42)
- fix(auth): Stabilize Neon JWT minting and org Daytona fallback (47eea64)
- fix(security): Require BYOK for Daytona and LLM providers on Vercel (355da70)
- docs(daytona): Document CLI tool conflicts with Fleet sandbox adapter (3c522b5)
- fix(bugs): Hoist useMemo hooks before early return in QuestionTool (a7f9f4a)
- fix(bugs): Purify state updater in usePiChat hook (0351bc2)
- fix(security): remove Daytona API key from localStorage and header flow (8731d5a)
- fix(a11y): make Send/Stop and Copy buttons accessible (9e26cdf)
- fix(bugs): restore synchronous messagesRef write and remove dead onRefresh prop (e9f0758)
- fix(maintainability): extract getArtifactsScopePath into dedicated utility file (98d11f5)
- codex: fix CI failure on PR #72 (79fea17)
- fix(settings): remove hardcoded defaultModel from .pi/settings.json (eccba12)
- Improve React audit - security, bugs, accessibility fixes (bd5984d)
- feat(models): require explicit model selection via Settings (f59de31)
- refactor(QuestionPrompt): simplify class names by removing unnecessary brackets (7113f9c)
- Add DB optimization migration: drop unused indexes, add schema constraints (eca295b)
- Rewrite README: self-improving agent workspace positioning (f405754)

**Full Changelog**: https://github.com/Qredence/fleet-pi/compare/v0.5.2...v0.5.5
