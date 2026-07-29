# Fleet Pi — Coding Conventions

## Code Organization

- **No app-local components**: All UI must be in @workspace/hax-design (packages/hax-design/src/components/) 
- **Route composition**: Route files only compose hax-design exports
- **Protocol barrel**: Use @workspace/pi-protocol exports for wire types
- **Relative imports inside packages**: Never mix @workspace/ inside package internals
- **Server vs client safety**: Keep auth checks client-safe (auth-mode.ts) separate from server-gated logic (chat-auth-surface, withAuthenticatedChatRequest)

## Component Patterns

- **shadcn-first**: Add UI components with `pnpm dlx shadcn@latest add <name> -c packages/hax-design`
- **OpenUI renderer**: Registry code under packages/hax-design/src/components/openui/
- **Tone tokens**: Prefer semantic tokens over hardcoded colors (@workspace/hax-design/tokens.ts)
- **ItemRow preference**: Use primitives from packages/hax-design/primitives/ over nested cards
- **No inline styles**: Use Tailwind utilities, cva variants, or co-located CSS

## Styling Conventions

- **Pill-shaped controls**: Header chrome uses rounded-full; InputBar uses pill selectors
- **Floating header**: Keep floating pill-style headers; avoid unified full-width top bars
- **Panel widths**: 70% viewport default, clamped minimum/maximum via layout constants
- **Reduced motion**: Always prefer prefers-reduced-motion media queries for animations
- **Palette restriction**: UI colors must come from declared palette classes only

## Testing Practices

- **Unit tests**: Vitest with mocked dependencies (__tests__/lib/, __tests__/components/)
- **E2E tests**: Playwright with screenshots at testInfo.outputPath()
- **CI workflow**: .github/workflows/e2e.yml runs smoke specs on PRs
- **Smart pre-commit**: Only run affected test suites based on staged files
- **Deterministic E2E**: Avoid machine-specific paths; use deterministic temp dirs

## Documentation Standards

- **AGENTS.MD**: Primary instruction surface (not CLAUDE.md)
- **docs/** for human-facing docs, .qoder/repowiki/ for auto-generated wiki
- **Runbooks**: docs/runbooks/*.md for operational procedures
- **ADRs**: docs/adr/*.md for architectural decision records
- **generate:docs**: Run `pnpm generate:docs` after schema/config changes
- **validate-agents-md**: Ensure AGENTS.MD examples match implementation

## Error Handling

- **Structured logging**: Module-scoped prefixes in error messages
- **PII sanitization**: Sanitize before logging/mirroring (@workspace/pi-protocol/sanitizer.ts)
- **Circuit breakers**: Wrap external calls with opossum patterns
- **Mirror failures non-blocking**: Pi JSONL remains source of truth; mirror errors logged but don't break streams
- **Fail-closed mirror ownership**: On Vercel+Neon Auth, verify fleet_pi_check_session_owner fails closed on transient errors
