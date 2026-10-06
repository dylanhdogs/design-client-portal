-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "notification_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "destination" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" DATETIME,
    "last_attempt_at" DATETIME,
    "sent_at" DATETIME,
    "last_error" TEXT,
    "provider_message_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "notification_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "automation_suggestions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT,
    "project_id" TEXT,
    "inquiry_id" TEXT,
    "type" TEXT NOT NULL,
    "source_entity_type" TEXT NOT NULL,
    "source_entity_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "suggestion_json" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "generated_by" TEXT NOT NULL DEFAULT 'RULE_ENGINE',
    "reviewed_by" TEXT,
    "reviewed_at" DATETIME,
    "review_comment" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "automation_suggestions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "pool_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "automation_suggestions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "automation_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "triggered_by" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 1,
    "metrics_json" TEXT,
    "error_message" TEXT,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" DATETIME,
    CONSTRAINT "automation_runs_triggered_by_fkey" FOREIGN KEY ("triggered_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "notification_deliveries_status_next_attempt_at_idx" ON "notification_deliveries"("status", "next_attempt_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_notification_id_channel_key" ON "notification_deliveries"("notification_id", "channel");

-- CreateIndex
CREATE INDEX "automation_suggestions_project_id_status_idx" ON "automation_suggestions"("project_id", "status");

-- CreateIndex
CREATE INDEX "automation_suggestions_inquiry_id_status_idx" ON "automation_suggestions"("inquiry_id", "status");

-- CreateIndex
CREATE INDEX "automation_suggestions_organization_id_status_idx" ON "automation_suggestions"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "automation_suggestions_type_source_entity_type_source_entity_id_key" ON "automation_suggestions"("type", "source_entity_type", "source_entity_id");

-- CreateIndex
CREATE INDEX "automation_runs_status_started_at_idx" ON "automation_runs"("status", "started_at");

-- CreateIndex
CREATE INDEX "automation_runs_type_started_at_idx" ON "automation_runs"("type", "started_at");
