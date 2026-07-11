export const CHAT_POSTGRES_PROVIDER_AUTH_MIGRATION_ID =
  "20260711_pi_user_providers_auth_type"

/**
 * Extends BYOK rows so API keys and OAuth payloads can coexist.
 * Existing rows backfill to auth_type = 'apiKey' via the column default.
 */
export const CHAT_POSTGRES_PROVIDER_AUTH_SQL = `
ALTER TABLE pi_user_providers
  ADD COLUMN IF NOT EXISTS auth_type TEXT NOT NULL DEFAULT 'apiKey';

ALTER TABLE pi_user_providers
  ADD COLUMN IF NOT EXISTS encrypted_payload TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pi_user_providers_auth_type_check'
      AND conrelid = 'pi_user_providers'::regclass
  ) THEN
    ALTER TABLE pi_user_providers
      ADD CONSTRAINT pi_user_providers_auth_type_check
      CHECK (auth_type IN ('apiKey', 'oauth'));
  END IF;
END $$;
`
