ALTER TABLE "inquiries" ADD COLUMN "client_disposition" TEXT;
ALTER TABLE "inquiries" ADD COLUMN "client_disposition_comment" TEXT;
ALTER TABLE "inquiries" ADD COLUMN "client_disposition_source" TEXT;
ALTER TABLE "inquiries" ADD COLUMN "client_disposition_at" DATETIME;
ALTER TABLE "inquiries" ADD COLUMN "client_disposition_recorded_by" TEXT REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inquiries" ADD COLUMN "client_disposition_client_user_id" TEXT REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inquiries" ADD COLUMN "client_disposition_review_status" TEXT;
ALTER TABLE "inquiries" ADD COLUMN "client_disposition_reviewed_at" DATETIME;
ALTER TABLE "inquiries" ADD COLUMN "client_disposition_reviewed_by" TEXT REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inquiries" ADD COLUMN "rom_preview_snapshot" TEXT;
ALTER TABLE "inquiries" ADD COLUMN "rom_preview_hash" TEXT;
ALTER TABLE "inquiries" ADD COLUMN "rom_preview_revision" INTEGER;
ALTER TABLE "inquiries" ADD COLUMN "rom_preview_saved_at" DATETIME;

CREATE TABLE "inquiry_activities" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "inquiry_id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "actor_id" TEXT,
  "origin" TEXT NOT NULL,
  "source_event_id" TEXT,
  "channel" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "contact_person" TEXT,
  "occurred_at" DATETIME NOT NULL,
  "organization_timezone" TEXT NOT NULL DEFAULT 'America/Phoenix',
  "summary" TEXT NOT NULL,
  "outcome_code" TEXT NOT NULL,
  "outcome_detail" TEXT,
  "client_disposition_value" TEXT,
  "follow_up_work_item_id" TEXT,
  "idempotency_key" TEXT,
  "request_fingerprint" TEXT,
    "client_rom_snapshot" TEXT,
    "client_rom_snapshot_hash" TEXT,
  "correction_of_activity_id" TEXT,
  "correction_json" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inquiry_activities_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "inquiry_activities_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "inquiry_activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "inquiry_activities_follow_up_work_item_id_fkey" FOREIGN KEY ("follow_up_work_item_id") REFERENCES "work_items"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "inquiry_activities_correction_of_activity_id_fkey" FOREIGN KEY ("correction_of_activity_id") REFERENCES "inquiry_activities"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "inquiry_activities_inquiry_id_actor_id_idempotency_key_key" ON "inquiry_activities"("inquiry_id", "actor_id", "idempotency_key");
CREATE UNIQUE INDEX "inquiry_activities_origin_source_event_id_key" ON "inquiry_activities"("origin", "source_event_id");
CREATE INDEX "inquiry_activities_inquiry_id_occurred_at_idx" ON "inquiry_activities"("inquiry_id", "occurred_at");
CREATE INDEX "inquiry_activities_client_id_occurred_at_idx" ON "inquiry_activities"("client_id", "occurred_at");
CREATE INDEX "inquiry_activities_follow_up_work_item_id_idx" ON "inquiry_activities"("follow_up_work_item_id");
ALTER TABLE "inquiries" ADD COLUMN "client_disposition_evidence_activity_id" TEXT REFERENCES "inquiry_activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "inquiry_activity_documents" (
  "activity_id" TEXT NOT NULL,
  "document_id" TEXT NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inquiry_activity_documents_activity_id_document_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "inquiry_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "inquiry_activity_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  PRIMARY KEY ("activity_id", "document_id")
);
CREATE INDEX "inquiry_activity_documents_document_id_idx" ON "inquiry_activity_documents"("document_id");

CREATE TABLE "inquiry_evidence" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "inquiry_id" TEXT NOT NULL,
  "document_id" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inquiry_evidence_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "inquiry_evidence_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "inquiry_evidence_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "inquiry_evidence_inquiry_id_document_id_category_key" ON "inquiry_evidence"("inquiry_id", "document_id", "category");
CREATE INDEX "inquiry_evidence_inquiry_id_category_idx" ON "inquiry_evidence"("inquiry_id", "category");

CREATE TABLE "inquiry_handoff_reviews" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "inquiry_id" TEXT NOT NULL,
  "reviewer_id" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  "intake_revision" INTEGER NOT NULL,
  "workflow_version" INTEGER NOT NULL,
  "checklist_snapshot" TEXT NOT NULL,
  "checklist_hash" TEXT NOT NULL,
  "rom_preview_snapshot" TEXT NOT NULL,
  "rom_preview_hash" TEXT NOT NULL,
  "reason" TEXT,
  "reviewed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inquiry_handoff_reviews_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "inquiry_handoff_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "inquiry_handoff_reviews_inquiry_id_intake_revision_workflow_version_idx" ON "inquiry_handoff_reviews"("inquiry_id", "intake_revision", "workflow_version");
CREATE INDEX "inquiry_handoff_reviews_reviewer_id_reviewed_at_idx" ON "inquiry_handoff_reviews"("reviewer_id", "reviewed_at");
CREATE UNIQUE INDEX "inquiry_handoff_reviews_inquiry_id_intake_revision_workflow_version_key" ON "inquiry_handoff_reviews"("inquiry_id", "intake_revision", "workflow_version");
