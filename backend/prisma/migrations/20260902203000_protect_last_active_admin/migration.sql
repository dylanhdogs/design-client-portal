CREATE TRIGGER "protect_last_active_admin"
BEFORE UPDATE OF "active" ON "users"
FOR EACH ROW
WHEN OLD."role" = 'ADMIN'
  AND OLD."active" = 1
  AND NEW."active" = 0
  AND (SELECT COUNT(*) FROM "users" WHERE "role" = 'ADMIN' AND "active" = 1) <= 1
BEGIN
  SELECT RAISE(ABORT, 'last_active_administrator');
END;

CREATE TRIGGER "protect_last_active_admin_role"
BEFORE UPDATE OF "role" ON "users"
FOR EACH ROW
WHEN OLD."role" = 'ADMIN'
  AND OLD."active" = 1
  AND NEW."role" <> 'ADMIN'
  AND (SELECT COUNT(*) FROM "users" WHERE "role" = 'ADMIN' AND "active" = 1) <= 1
BEGIN
  SELECT RAISE(ABORT, 'last_active_administrator');
END;

CREATE TRIGGER "protect_last_active_admin_delete"
BEFORE DELETE ON "users"
FOR EACH ROW
WHEN OLD."role" = 'ADMIN'
  AND OLD."active" = 1
  AND (SELECT COUNT(*) FROM "users" WHERE "role" = 'ADMIN' AND "active" = 1) <= 1
BEGIN
  SELECT RAISE(ABORT, 'last_active_administrator');
END;
