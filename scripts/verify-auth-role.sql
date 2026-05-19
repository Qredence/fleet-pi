-- Verification queries for fleet_pi_app role.
-- Connect as fleet_pi_app to run these.
--
-- psql "postgresql://fleet_pi_app:<password>@ep-shiny-bar-akrwoa2t-pooler.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require"

-- Should SUCCEED (DML):
SELECT count(*) FROM "user";
SELECT count(*) FROM "session";
SELECT count(*) FROM "account";
SELECT count(*) FROM "verification";

INSERT INTO "user" (id, name, email, "emailVerified", image, "createdAt", "updatedAt")
  VALUES ('test-verify-role', 'Verify', 'verify@test.local', false, null, now(), now());
DELETE FROM "user" WHERE id = 'test-verify-role';

-- Should FAIL (DDL — permission denied):
-- DROP TABLE "user";
-- CREATE TABLE test_evil (id text);
-- ALTER TABLE "user" ADD COLUMN x text;

-- Should FAIL (role escalation):
-- CREATE ROLE hacker LOGIN;
