ALTER TABLE "inquiries" ADD COLUMN "legacy_review_status" TEXT NOT NULL DEFAULT 'PENDING';
UPDATE "inquiries"
SET "legacy_review_status" = CASE
  WHEN "qualification_status" = 'CONVERTED' AND "project_id" IS NOT NULL THEN 'PRESERVED_CONVERTED'
  WHEN "qualification_status" IN ('DECLINED', 'NURTURED') THEN 'CLOSED_HISTORY'
  ELSE 'PENDING'
END;

ALTER TABLE "consultations" ADD COLUMN "meeting_mode" TEXT;
ALTER TABLE "work_items" ADD COLUMN "criterion_id" TEXT;

CREATE TABLE "inquiry_criterion_states" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "inquiry_id" TEXT NOT NULL,
  "criterion_id" TEXT NOT NULL,
  "answer_state" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "reason" TEXT,
  "source" TEXT NOT NULL DEFAULT 'SYSTEM',
  "updated_by" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inquiry_criterion_states_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "inquiry_criterion_states_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "inquiry_criterion_state_audits" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "inquiry_id" TEXT NOT NULL,
  "criterion_id" TEXT NOT NULL,
  "criterion_state_id" TEXT,
  "from_answer_state" TEXT,
  "to_answer_state" TEXT NOT NULL,
  "from_reason" TEXT,
  "to_reason" TEXT,
  "source" TEXT NOT NULL,
  "actor_id" TEXT,
  "workflow_version" INTEGER NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inquiry_criterion_state_audits_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "inquiry_criterion_state_audits_criterion_state_id_fkey" FOREIGN KEY ("criterion_state_id") REFERENCES "inquiry_criterion_states" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "inquiry_criterion_state_audits_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "inquiry_criterion_states_inquiry_id_criterion_id_key" ON "inquiry_criterion_states"("inquiry_id", "criterion_id");
CREATE INDEX "inquiry_criterion_states_criterion_id_answer_state_idx" ON "inquiry_criterion_states"("criterion_id", "answer_state");
CREATE INDEX "inquiry_criterion_states_inquiry_id_idx" ON "inquiry_criterion_states"("inquiry_id");
CREATE INDEX "inquiry_criterion_state_audits_inquiry_id_created_at_idx" ON "inquiry_criterion_state_audits"("inquiry_id", "created_at");
CREATE INDEX "inquiry_criterion_state_audits_criterion_id_created_at_idx" ON "inquiry_criterion_state_audits"("criterion_id", "created_at");
CREATE INDEX "inquiries_legacy_review_status_qualification_status_idx" ON "inquiries"("legacy_review_status", "qualification_status");
CREATE INDEX "work_items_inquiry_id_criterion_id_idx" ON "work_items"("inquiry_id", "criterion_id");
