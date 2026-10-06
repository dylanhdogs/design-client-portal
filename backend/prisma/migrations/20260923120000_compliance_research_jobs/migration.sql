CREATE TABLE "compliance_research_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inquiry_id" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "query_summary" TEXT,
    "source_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "started_at" DATETIME,
    "completed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "compliance_research_jobs_inquiry_id_fkey"
      FOREIGN KEY ("inquiry_id") REFERENCES "inquiries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "compliance_research_sources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "job_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "excerpt" TEXT,
    "retrieved_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "compliance_research_sources_job_id_fkey"
      FOREIGN KEY ("job_id") REFERENCES "compliance_research_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "compliance_research_sources_job_id_url_key"
  ON "compliance_research_sources"("job_id", "url");
CREATE INDEX "compliance_research_jobs_inquiry_id_created_at_idx"
  ON "compliance_research_jobs"("inquiry_id", "created_at");
CREATE INDEX "compliance_research_jobs_status_created_at_idx"
  ON "compliance_research_jobs"("status", "created_at");
CREATE INDEX "compliance_research_sources_job_id_idx"
  ON "compliance_research_sources"("job_id");
