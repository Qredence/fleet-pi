import { describe, expect, it } from "vitest"
import {
  CHAT_POSTGRES_USER_SETTINGS_MIGRATION_ID,
  CHAT_POSTGRES_USER_SETTINGS_SQL,
} from "../chat-postgres-user-settings"

describe("chat-postgres-user-settings", () => {
  it("defines the per-user Pi settings table with RLS", () => {
    expect(CHAT_POSTGRES_USER_SETTINGS_MIGRATION_ID).toBe(
      "20260718_pi_user_settings"
    )
    expect(CHAT_POSTGRES_USER_SETTINGS_SQL).toContain(
      "CREATE TABLE IF NOT EXISTS pi_user_settings"
    )
    expect(CHAT_POSTGRES_USER_SETTINGS_SQL).toContain(
      "ENABLE ROW LEVEL SECURITY"
    )
    expect(CHAT_POSTGRES_USER_SETTINGS_SQL).toContain(
      "pi_user_settings_isolation"
    )
    expect(CHAT_POSTGRES_USER_SETTINGS_SQL).toContain(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pi_user_settings TO fleet_pi_app"
    )
  })
})
