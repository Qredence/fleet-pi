Three cooperating files form a thin layer over the `better-auth` library:

- `legacy-better-auth-server.ts` is the core factory: it resolves the database (Neon `@neondatabase/serverless` Pool when `FLEET_PI_AUTH_DATABASE_URL` is set, otherwise an in-process `better-sqlite3` file at `.fleet/auth.sqlite`), migrates the schema inline via `migrateAuthSchema`, computes `baseURL` and `trustedOrigins` using shared deployment helpers (`resolvePreviewAuthOrigin`, `resolveVercelAllowedHosts`, `resolveTrustedOriginsForDeployment`), enables email/password and optional Google social login, and exports `createLegacyBetterAuth(plugins)` plus a default singleton `legacyBetterAuth`.
- `legacy-better-auth-tanstack-plugins.ts` isolates the TanStack Start cookie plugin (`tanstackStartCookies()`) so that Neon Function bundles do not pull `@tanstack/start-server-core` into every consumer.
- `legacy-better-auth-tanstack.ts` composes the two by calling `createLegacyBetterAuth(getLegacyBetterAuthTanstackPlugins())` to produce `legacyBetterAuthWithTanstack`, used only on Vercel/TanStack routes.

Dependency direction is one-way: the TanStack files depend on the server factory; the server factory depends only on environment detection and auth-host-policy utilities, never on TanStack.
