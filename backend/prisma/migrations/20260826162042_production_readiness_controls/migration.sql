-- AlterTable
ALTER TABLE "documents" ADD COLUMN "retention_until" DATETIME;

-- CreateTable
CREATE TABLE "legal_holds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "set_by" TEXT NOT NULL,
    "released_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "legal_holds_set_by_fkey" FOREIGN KEY ("set_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "operational_alerts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'WARNING',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "request_id" TEXT,
    "message" TEXT NOT NULL,
    "metadata_json" TEXT,
    "acknowledged_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "legal_holds_entity_type_entity_id_active_idx" ON "legal_holds"("entity_type", "entity_id", "active");

-- CreateIndex
CREATE INDEX "operational_alerts_category_status_created_at_idx" ON "operational_alerts"("category", "status", "created_at");

-- CreateIndex
CREATE INDEX "operational_alerts_request_id_idx" ON "operational_alerts"("request_id");
