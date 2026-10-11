# Rotating the `fleet_pi_app` database role

Zero-downtime rotation of the Neon runtime role (`fleet_pi_app`) and the app
database URLs on the Cloudflare Worker (`fleet-pi-web`). Use it to change the
role's password, or to replace a role created with the wrong attributes (for
example one that has `BYPASSRLS` or is a member of `neon_superuser`).

The rule: **the old role stays usable until the Worker serving 100% of
traffic connects with the new one.** Never drop, disable or reset the old
role first (see [Incident 2026-10-11](#incident-2026-10-11)).

Conventions in this page:

- `$OWNER_URL` is the owner (`neondb_owner`) connection string of the target
  branch, kept in your shell or a mode-600 file. Never paste it into a ticket,
  a PR or chat.
- Placeholders such as `<project-id>` and `<version-id>` are not real values.
- No command here prints a password or a connection string. Keep it that way
  when you adapt them.

## Why there are two hops

Every chat migration and the `fleet_pi_app` grants reconcile
(`apps/web/src/lib/db/chat-postgres-app-role-grants.ts`,
`auth-postgres-post-migrate.ts`) grant privileges **to the literal role name
`fleet_pi_app`**, guarded by `IF EXISTS (… rolname = 'fleet_pi_app')`.
`pnpm chat:migrate` therefore cannot grant anything to a differently named
role.

A Postgres role has one password, and Neon's "reset password" invalidates the
old one immediately, so there is no "two passwords on one role" overlap. And
`ALTER ROLE … RENAME` changes the user name in the connection string, so
renaming the new role to `fleet_pi_app` would break the URL the Worker is
using.

So the procedure that works with today's code uses two hops:

1. **Hop 1:** create `fleet_pi_app_next`, copy the old role's grants onto it,
   move the Worker to it, then drop the old `fleet_pi_app`.
2. **Hop 2:** create a fresh plain `fleet_pi_app`, run `chat:migrate` (grants
   now land on it), move the Worker back to it, then drop
   `fleet_pi_app_next`.

Between the hops, `chat:migrate` skips the `fleet_pi_app` grants because the
role doesn't exist. Do not ship migrations while you are between hops.

> Follow-up that would make this one hop: have the grant SQL target a
> configurable role name (for example `FLEET_PI_APP_ROLE`, default
> `fleet_pi_app`). Until then, use the two-hop procedure.

Each hop below follows the same eight steps. They are written for hop 1, with
`fleet_pi_app_next` as the new role. For hop 2, swap the names.

## 1. Snapshot main

Before anything else, take a snapshot (or a restore point) of the production
branch, in the Neon console or with the Neon MCP `create_snapshot` tool, and
note its id. Don't branch from main and work there: role changes must happen
on the branch the Worker uses.

## 2. Create the new plain role

Create it **with SQL as the owner**, not from the Neon console or API. Roles
created through the console or API are added to `neon_superuser` and get
`BYPASSRLS`, which defeats the forced RLS on `pi_*`.

```bash
umask 077
NEW_ROLE=fleet_pi_app_next
NEW_PW="$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 40)"

# Create the role NOLOGIN first, so it cannot be used before it has grants.
psql "$OWNER_URL" -v ON_ERROR_STOP=1 -q <<SQL
CREATE ROLE ${NEW_ROLE} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
SQL

# The password goes through stdin, never on the command line.
psql "$OWNER_URL" -v ON_ERROR_STOP=1 -q -v pw="$NEW_PW" <<'SQL'
SELECT format('ALTER ROLE fleet_pi_app_next PASSWORD %L', :'pw') \gexec
SQL
```

Check the attributes. All of these must be false or empty:

```sql
SELECT rolname, rolsuper, rolbypassrls, rolcanlogin,
       (SELECT array_agg(g.rolname) FROM pg_auth_members m
          JOIN pg_roles g ON g.oid = m.roleid WHERE m.member = r.oid) AS member_of
FROM pg_roles r WHERE rolname = 'fleet_pi_app_next';
```

## 3. Apply the grants

- **Hop 2 (new role named `fleet_pi_app`):** run `pnpm chat:migrate` and, if
  the auth tables are in use, `pnpm auth:migrate`. Both re-assert the
  canonical grant set, including EXECUTE on `fleet_pi_check_session_owner`,
  `fleet_pi_lookup_session_id_by_file`, `fleet_pi_current_user_id` and
  `fleet_pi_current_user_uuid`.
- **Hop 1 (`fleet_pi_app_next`):** the migrations can't target it, so copy
  the old role's grants. Grant them explicitly, not through membership in
  `fleet_pi_app`, because the old role is about to be dropped:

  ```sql
  -- Run as owner. Copies table, sequence, schema and function privileges.
  DO $$
  DECLARE g record;
  BEGIN
    FOR g IN
      SELECT table_schema, table_name, string_agg(privilege_type, ', ') AS privs
      FROM information_schema.role_table_grants
      WHERE grantee = 'fleet_pi_app'
      GROUP BY 1, 2
    LOOP
      EXECUTE format('GRANT %s ON TABLE %I.%I TO fleet_pi_app_next',
                     g.privs, g.table_schema, g.table_name);
    END LOOP;
    FOR g IN
      SELECT p.oid::regprocedure AS fn
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND has_function_privilege('fleet_pi_app', p.oid, 'EXECUTE')
        AND NOT has_function_privilege('public', p.oid, 'EXECUTE')
    LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO fleet_pi_app_next', g.fn);
    END LOOP;
  END $$;
  GRANT USAGE ON SCHEMA public TO fleet_pi_app_next;
  -- If the auth schema grants apply (Better Auth tables / neon_auth), repeat
  -- the table loop for those schemas.
  ```

Then compare the two roles' grant sets. The diff must be empty:

```sql
SELECT table_schema, table_name, privilege_type FROM information_schema.role_table_grants WHERE grantee = 'fleet_pi_app'
EXCEPT
SELECT table_schema, table_name, privilege_type FROM information_schema.role_table_grants WHERE grantee = 'fleet_pi_app_next';
```

Only now enable login: `ALTER ROLE fleet_pi_app_next LOGIN;`

## 4. Write the new pooled URL to the SSD

Build the pooled URL (the `-pooler` host, `sslmode=require`) from the branch's
pooled host and the new credentials, and write it straight to a mode-600 file.
Don't echo it:

```bash
umask 077
SECRETS_DIR=/Volumes/SSD-T7/qredence-environnement/.cache/secrets
mkdir -p "$SECRETS_DIR"
POOLER_HOST="<endpoint>-pooler.<region>.aws.neon.tech"   # from the Neon console
printf 'postgresql://%s:%s@%s/neondb?sslmode=require\n' \
  "$NEW_ROLE" "$NEW_PW" "$POOLER_HOST" > "$SECRETS_DIR/fleet_pi_app_next.url"
chmod 600 "$SECRETS_DIR/fleet_pi_app_next.url"
unset NEW_PW
```

Check that the new role can connect and is RLS-bound, without printing the
URL:

```bash
psql "$(cat "$SECRETS_DIR/fleet_pi_app_next.url")" -Atq \
  -c "SELECT current_user, (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user)"
# expected: fleet_pi_app_next|f
```

## 5. Upload a Worker preview version and smoke-test it

Record the version currently serving traffic. It is your rollback target:

```bash
cd apps/web
pnpm exec wrangler deployments status        # note the current <prev-version-id>
```

Create a new version with the new secrets, but **don't deploy it**.
`wrangler versions secret put` creates a version without shifting traffic,
and the value is read from stdin:

```bash
pnpm exec wrangler versions secret put DATABASE_URL \
  < "$SECRETS_DIR/fleet_pi_app_next.url"
pnpm exec wrangler versions secret put FLEET_PI_CHAT_DATABASE_URL \
  < "$SECRETS_DIR/fleet_pi_app_next.url"
pnpm exec wrangler versions list              # note the new <new-version-id>
```

Smoke-test the new version on its preview URL
(`https://<new-version-prefix>-fleet-pi-web.<subdomain>.workers.dev`):

- sign in through Neon Managed Auth;
- send a chat message and get a streamed reply;
- open the session list and confirm the new session is listed;
- check `/api/health`.

Two-user isolation check, still against the preview version:

- with users A and B, each creates a session;
- A's session list must not contain B's session, and the other way round;
- opening B's session id as A must give a not-found or foreign response,
  never B's messages;
- optionally, as owner, confirm that the rows' `user_id` values match the two
  Neon Auth user ids.

If any check fails, stop here. Traffic is still on `<prev-version-id>` with
the old role, so nothing is broken. Investigate, or delete the new role.

## 6. Promote

```bash
pnpm exec wrangler versions deploy <new-version-id>@100% --yes
pnpm exec wrangler deployments status         # confirm 100% on <new-version-id>
```

Keep `<prev-version-id>` written down. Until step 7 it is a valid rollback:

```bash
pnpm exec wrangler rollback <prev-version-id>
```

Watch errors for a few minutes (Workers logs, `/api/health`, a real chat
turn), and check `pg_stat_activity` as owner to confirm connections now come
from the new role:

```sql
SELECT usename, count(*) FROM pg_stat_activity
WHERE datname = 'neondb' GROUP BY 1;
```

## 7. Only then drop or disable the old role

When no traffic uses the old role any more (no rows for it in
`pg_stat_activity`, and the deployment is at 100% on the new version):

```sql
-- Softest option first: block new logins, keep the role for a quick undo.
ALTER ROLE fleet_pi_app NOLOGIN;
-- Later, once you are confident:
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM fleet_pi_app;
DROP OWNED BY fleet_pi_app;      -- drops its privileges; it owns no objects
DROP ROLE fleet_pi_app;
```

If the old role was created from the Neon console, drop it from the console
or API instead (Neon tracks those roles).

## 8. Confirm

- `wrangler deployments status` shows the new version at 100%.
- As owner: `SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname LIKE 'fleet_pi_app%';`
  lists only the expected role(s), with `rolbypassrls = f`.
- Chat, the session list and sign-in work in production.
- Delete the old URL file from the SSD, and update any local `.env.local`
  that pointed at the old role.

After hop 1, repeat steps 1–8 for hop 2 (new role `fleet_pi_app`, grants via
`chat:migrate`, Worker back to the `fleet_pi_app` URL, then drop
`fleet_pi_app_next`).

## Rollback notes

- Before step 7, roll back with `wrangler rollback <prev-version-id>`. The
  previous version still has the old URL, and the old role still exists.
- **After step 7, older Worker versions can't connect.** Their secrets point
  at a role that no longer exists (or can no longer log in). Rolling back to
  any version older than the promotion then breaks chat. To undo after step 7:
  re-enable the old role (`ALTER ROLE fleet_pi_app LOGIN;`, if it was only
  disabled), or put the current URL on a new version with
  `wrangler versions secret put` and deploy that.
- `wrangler rollback` restores code **and** secrets as of that version. Check
  which role a version uses before rolling back across a rotation.
- If a migration ran between the hops, run `pnpm chat:migrate` again after
  hop 2 so the final `fleet_pi_app` has every grant.

## Incident 2026-10-11

Chat was down from about 10:06 to 10:21 CEST on 2026-10-11. The production
`fleet_pi_app` role was dropped and recreated **before** the Worker's
`DATABASE_URL` / `FLEET_PI_CHAT_DATABASE_URL` were switched to the new
credentials. Every request using the live version failed to authenticate
against Postgres until a new version with the new URL was deployed.

Lesson: create the new role alongside the old one, verify a preview version,
promote, and only then remove the old role (steps 2 → 5 → 6 → 7 above).

## Related

- [Deployment release gate](deployment-release-gate.md)
- [Deployment (wiki)](../wiki/deployment.md)
- [ADR 0003: owner-only session mirror](../adr/0003-owner-only-session-mirror.md)
