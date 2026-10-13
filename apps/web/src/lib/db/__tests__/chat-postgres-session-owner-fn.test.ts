import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { CHAT_POSTGRES_SCHEMA_SQL } from "../chat-postgres-schema"
import {
  FLEET_PI_CHECK_SESSION_OWNER_SQL,
  chatRuntimeRoleBypassesRls,
  chatRuntimeRoleLabel,
} from "../chat-postgres-session-owner-fn"
import { CHAT_POSTGRES_SESSION_TOMBSTONES_SQL } from "../chat-postgres-session-tombstones"

describe("fleet_pi_check_session_owner", () => {
  it("keeps the tombstone branch in the definition chat:migrate reapplies", () => {
    expect(FLEET_PI_CHECK_SESSION_OWNER_SQL).toContain("'deleted'")
    expect(FLEET_PI_CHECK_SESSION_OWNER_SQL).toContain("pi_session_tombstones")
    expect(CHAT_POSTGRES_SESSION_TOMBSTONES_SQL).toContain(
      "CREATE OR REPLACE FUNCTION fleet_pi_check_session_owner"
    )
    expect(CHAT_POSTGRES_SCHEMA_SQL).not.toContain(
      "FUNCTION fleet_pi_check_session_owner"
    )
  })

  it("is applied on every chat:migrate, and Data API grants stay out of the runner", () => {
    const source = readFileSync(
      new URL("../chat-migrations.ts", import.meta.url),
      "utf8"
    )
    expect(source).toContain("CHAT_POSTGRES_SESSION_OWNER_FUNCTION_SQL")
    expect(source).toContain(
      "await client.query(CHAT_POSTGRES_SESSION_OWNER_FUNCTION_SQL)"
    )
    expect(source).toContain("do not apply `chat-postgres-data-api-auth`")
    expect(source).not.toContain('from "./chat-postgres-data-api-auth"')
  })

  it("treats a missing or bypass role as unsafe for the runtime connection", () => {
    expect(chatRuntimeRoleBypassesRls(undefined)).toBe(true)
    expect(
      chatRuntimeRoleBypassesRls({ rolbypassrls: true, rolsuper: false })
    ).toBe(true)
    expect(
      chatRuntimeRoleBypassesRls({ rolbypassrls: false, rolsuper: true })
    ).toBe(true)
    expect(
      chatRuntimeRoleBypassesRls({ rolbypassrls: false, rolsuper: false })
    ).toBe(false)
    expect(chatRuntimeRoleLabel(undefined)).toBe("unknown")
    expect(chatRuntimeRoleLabel({ rolname: "fleet_pi_app" })).toBe(
      "fleet_pi_app"
    )
  })
})
