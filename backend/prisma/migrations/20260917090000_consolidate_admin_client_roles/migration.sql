-- Staff accounts are retired without deleting their historical audit and assignment records.
-- Incrementing the session version invalidates any existing staff sessions.
UPDATE "users"
SET "active" = 0,
    "session_version" = "session_version" + 1
WHERE "role" = 'STAFF'
  AND "active" = 1;
