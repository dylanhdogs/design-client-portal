-- AlterTable
ALTER TABLE "inquiries" ADD COLUMN "decline_reason" TEXT;
ALTER TABLE "inquiries" ADD COLUMN "preliminary_scope" TEXT;
ALTER TABLE "inquiries" ADD COLUMN "referral_name" TEXT;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "inquiry_id" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_consultations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "inquiry_id" TEXT,
    "title" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "outcome" TEXT,
    "deleted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "consultations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "consultations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "consultations_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_consultations" ("client_id", "created_at", "date", "deleted_at", "id", "notes", "status", "title", "updated_at", "user_id") SELECT "client_id", "created_at", "date", "deleted_at", "id", "notes", "status", "title", "updated_at", "user_id" FROM "consultations";
DROP TABLE "consultations";
ALTER TABLE "new_consultations" RENAME TO "consultations";
CREATE INDEX "consultations_client_id_idx" ON "consultations"("client_id");
CREATE INDEX "consultations_user_id_idx" ON "consultations"("user_id");
CREATE INDEX "consultations_inquiry_id_idx" ON "consultations"("inquiry_id");
CREATE TABLE "new_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "client_id" TEXT NOT NULL,
    "consultation_id" TEXT,
    "inquiry_id" TEXT,
    "user_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "description" TEXT,
    "deleted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "documents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "documents_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_documents" ("client_id", "consultation_id", "created_at", "deleted_at", "description", "filename", "id", "mime_type", "original_name", "size", "user_id") SELECT "client_id", "consultation_id", "created_at", "deleted_at", "description", "filename", "id", "mime_type", "original_name", "size", "user_id" FROM "documents";
DROP TABLE "documents";
ALTER TABLE "new_documents" RENAME TO "documents";
CREATE INDEX "documents_client_id_idx" ON "documents"("client_id");
CREATE INDEX "documents_consultation_id_idx" ON "documents"("consultation_id");
CREATE INDEX "documents_inquiry_id_idx" ON "documents"("inquiry_id");
CREATE INDEX "documents_user_id_idx" ON "documents"("user_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "notifications_inquiry_id_idx" ON "notifications"("inquiry_id");
