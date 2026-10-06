-- Enforce the existing one-client-login rule at the database layer. This is
-- deliberately first so duplicate legacy links stop the migration before any
-- table is rebuilt; the deployment preflight reports those rows first.
CREATE UNIQUE INDEX "users_client_id_key" ON "users"("client_id");

-- Preserve legacy invitations and allow new administrator invitations without a client link.
CREATE TABLE "new_invitations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "client_id" TEXT,
    "role" TEXT NOT NULL DEFAULT 'CLIENT',
    "invited_by_id" TEXT,
    "token" TEXT,
    "token_hash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expires_at" DATETIME NOT NULL,
    "accepted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invitations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_invitations" (
    "id", "email", "client_id", "role", "invited_by_id", "token", "token_hash",
    "status", "expires_at", "accepted_at", "created_at"
)
SELECT "id", "email", "client_id", 'CLIENT', NULL, "token", NULL,
       "status", "expires_at", "accepted_at", "created_at"
FROM "invitations";

DROP TABLE "invitations";
ALTER TABLE "new_invitations" RENAME TO "invitations";
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");
CREATE INDEX "invitations_client_id_idx" ON "invitations"("client_id");
CREATE INDEX "invitations_token_idx" ON "invitations"("token");

-- Add current phase completer attribution. Existing completed phases remain actor-unknown.
ALTER TABLE "project_phases" ADD COLUMN "completed_by_id" TEXT REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "project_phases_completed_by_id_idx" ON "project_phases"("completed_by_id");

-- Add a safe user relation to existing checklist completion attribution while
-- preserving every field and its existing phase relationship.
CREATE TABLE "new_checklist_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phase_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "client_action_required" BOOLEAN NOT NULL DEFAULT false,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" DATETIME,
    "completed_by" TEXT,
    "verification_status" TEXT NOT NULL DEFAULT 'NOT_SUBMITTED',
    "submitted_at" DATETIME,
    "submitted_by" TEXT,
    "verified_at" DATETIME,
    "verified_by" TEXT,
    "rejection_reason" TEXT,
    "order" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "checklist_items_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "project_phases" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "checklist_items_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_checklist_items" (
    "id", "phase_id", "description", "client_action_required", "is_completed", "completed_at", "completed_by",
    "verification_status", "submitted_at", "submitted_by", "verified_at", "verified_by", "rejection_reason", "order", "created_at"
)
SELECT "id", "phase_id", "description", "client_action_required", "is_completed", "completed_at", "completed_by",
       "verification_status", "submitted_at", "submitted_by", "verified_at", "verified_by", "rejection_reason", "order", "created_at"
FROM "checklist_items";

DROP TABLE "checklist_items";
ALTER TABLE "new_checklist_items" RENAME TO "checklist_items";
CREATE INDEX "checklist_items_phase_id_idx" ON "checklist_items"("phase_id");

-- Keep audit rows if an account is deactivated or removed from ordinary UI workflows.
CREATE TABLE "new_activity_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "details" TEXT,
    "request_id" TEXT,
    "actor_name" TEXT,
    "actor_role" TEXT,
    "inquiry_id" TEXT,
    "project_id" TEXT,
    "before_state" TEXT,
    "after_state" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_activity_logs" (
    "id", "user_id", "action", "entity_type", "entity_id", "details", "request_id",
    "actor_name", "actor_role", "inquiry_id", "project_id", "before_state", "after_state", "created_at"
)
SELECT a."id", a."user_id", a."action", a."entity_type", a."entity_id", a."details", a."request_id",
       u."name", u."role",
       CASE WHEN a."entity_type" = 'Inquiry' THEN a."entity_id" ELSE NULL END,
       NULL, a."before_state", a."after_state", a."created_at"
FROM "activity_logs" a
LEFT JOIN "users" u ON u."id" = a."user_id";

DROP TABLE "activity_logs";
ALTER TABLE "new_activity_logs" RENAME TO "activity_logs";
CREATE INDEX "activity_logs_user_id_idx" ON "activity_logs"("user_id");
CREATE INDEX "activity_logs_entity_type_entity_id_idx" ON "activity_logs"("entity_type", "entity_id");
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at");
CREATE INDEX "activity_logs_inquiry_id_created_at_idx" ON "activity_logs"("inquiry_id", "created_at");
CREATE INDEX "activity_logs_project_id_created_at_idx" ON "activity_logs"("project_id", "created_at");
CREATE INDEX "activity_logs_user_id_created_at_idx" ON "activity_logs"("user_id", "created_at");
