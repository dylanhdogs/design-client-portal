-- CreateTable
CREATE TABLE "communication_threads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "client_id" TEXT NOT NULL,
    "created_by_id" TEXT,
    "title" TEXT NOT NULL,
    "deleted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "communication_threads_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "communication_threads_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create one thread for each existing message so old data remains visible.
INSERT INTO "communication_threads" ("id", "client_id", "created_by_id", "title", "created_at", "updated_at")
SELECT
    "id",
    "client_id",
    "user_id",
    COALESCE(NULLIF("subject", ''), 'Conversation'),
    COALESCE("created_at", CURRENT_TIMESTAMP),
    COALESCE("created_at", CURRENT_TIMESTAMP)
FROM "communications";

-- AlterTable
ALTER TABLE "communications" ADD COLUMN "thread_id" TEXT;

-- Backfill existing messages to their generated threads.
UPDATE "communications" SET "thread_id" = "id" WHERE "thread_id" IS NULL;

-- CreateIndex
CREATE INDEX "communication_threads_client_id_idx" ON "communication_threads"("client_id");

-- CreateIndex
CREATE INDEX "communication_threads_created_by_id_idx" ON "communication_threads"("created_by_id");

-- CreateIndex
CREATE INDEX "communications_thread_id_idx" ON "communications"("thread_id");
