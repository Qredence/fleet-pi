import { describe, expect, it } from "vitest"
import {
  CHAT_POSTGRES_PROVIDER_AUTH_MIGRATION_ID,
  CHAT_POSTGRES_PROVIDER_AUTH_SQL,
} from "../chat-postgres-provider-auth"
import { CHAT_POSTGRES_SCHEMA_SQL } from "../chat-postgres-schema"

describe("chat-postgres-provider-auth", () => {
  it("adds auth_type and encrypted_payload for existing BYOK tables", () => {
    expect(CHAT_POSTGRES_PROVIDER_AUTH_MIGRATION_ID).toBe(
      "20260711_pi_user_providers_auth_type"
    )
    expect(CHAT_POSTGRES_PROVIDER_AUTH_SQL).toContain(
      "ADD COLUMN IF NOT EXISTS auth_type"
    )
    expect(CHAT_POSTGRES_PROVIDER_AUTH_SQL).toContain(
      "ADD COLUMN IF NOT EXISTS encrypted_payload"
    )
    expect(CHAT_POSTGRES_PROVIDER_AUTH_SQL).toContain(
      "pi_user_providers_auth_type_check"
    )
  })

  it("includes the same columns on greenfield CREATE TABLE", () => {
    const createIndex = CHAT_POSTGRES_SCHEMA_SQL.indexOf(
      "CREATE TABLE IF NOT EXISTS pi_user_providers ("
    )
    const slice = CHAT_POSTGRES_SCHEMA_SQL.slice(createIndex, createIndex + 400)
    expect(slice).toContain("auth_type TEXT NOT NULL DEFAULT 'apiKey'")
    expect(slice).toContain("encrypted_payload TEXT NULL")
    expect(slice).toContain("pi_user_providers_auth_type_check")
  })
})
