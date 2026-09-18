-- Existing sessions intentionally become invalid because older tokens do not contain session_version.
ALTER TABLE "users" ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;
