export const CHAT_POSTGRES_USER_SETTINGS_MIGRATION_ID =
  "20260718_pi_user_settings"

/**
 * Per-user Pi project settings overlay for Vercel (skills, packages, models, …).
 * Local/dev keeps using `.pi/settings.json` on disk; Neon is the durable store
 * when the serverless filesystem is read-only or ephemeral.
 */
export const CHAT_POSTGRES_USER_SETTINGS_SQL = `
CREATE TABLE IF NOT EXISTS pi_user_settings (
  user_id TEXT PRIMARY KEY,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS pi_user_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pi_user_settings'
      AND policyname = 'pi_user_settings_isolation'
  ) THEN
    CREATE POLICY pi_user_settings_isolation ON pi_user_settings
      FOR ALL
      USING (user_id = (SELECT current_setting('app.current_user_id', true)))
      WITH CHECK (user_id = (SELECT current_setting('app.current_user_id', true)));
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fleet_pi_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pi_user_settings TO fleet_pi_app;
  END IF;
END $$;
`
