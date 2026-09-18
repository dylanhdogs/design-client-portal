-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_work_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT,
    "project_id" TEXT,
    "inquiry_id" TEXT,
    "stage" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TASK',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "owner_id" TEXT,
    "reviewer_id" TEXT,
    "due_at" DATETIME,
    "client_visible" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT NOT NULL,
    "completed_at" DATETIME,
    "verified_at" DATETIME,
    "deleted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "work_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "pool_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "work_items_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "work_items_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "work_items_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "work_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_work_items" ("client_visible", "completed_at", "created_at", "created_by", "deleted_at", "description", "due_at", "id", "organization_id", "owner_id", "priority", "project_id", "reviewer_id", "stage", "status", "title", "type", "updated_at", "verified_at") SELECT "client_visible", "completed_at", "created_at", "created_by", "deleted_at", "description", "due_at", "id", "organization_id", "owner_id", "priority", "project_id", "reviewer_id", "stage", "status", "title", "type", "updated_at", "verified_at" FROM "work_items";
DROP TABLE "work_items";
ALTER TABLE "new_work_items" RENAME TO "work_items";
CREATE INDEX "work_items_project_id_idx" ON "work_items"("project_id");
CREATE INDEX "work_items_inquiry_id_idx" ON "work_items"("inquiry_id");
CREATE INDEX "work_items_owner_id_idx" ON "work_items"("owner_id");
CREATE INDEX "work_items_reviewer_id_idx" ON "work_items"("reviewer_id");
CREATE INDEX "work_items_status_idx" ON "work_items"("status");
CREATE INDEX "work_items_due_at_idx" ON "work_items"("due_at");
CREATE INDEX "work_items_organization_id_status_idx" ON "work_items"("organization_id", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
