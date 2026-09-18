CREATE TABLE "client_status_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT,
    "client_id" TEXT NOT NULL,
    "project_id" TEXT,
    "inquiry_id" TEXT,
    "as_of_date" DATETIME NOT NULL,
    "display_time_zone" TEXT NOT NULL,
    "generated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generated_by" TEXT NOT NULL,
    "source_watermark" DATETIME NOT NULL,
    "source_fingerprint" TEXT NOT NULL,
    "report_version" INTEGER NOT NULL DEFAULT 1,
    "generation_mode" TEXT NOT NULL DEFAULT 'FACTS_ONLY',
    "overall_state" TEXT NOT NULL,
    "fact_snapshot_json" TEXT NOT NULL,
    "narrative_json" TEXT,
    "model_name" TEXT,
    "prompt_version" TEXT,
    "estimated_cost_cents" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'COMPLETE',
    "warning_summary" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "client_status_reports_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "client_status_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "pool_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "client_status_reports_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "client_status_reports_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "client_status_reports_client_id_generated_at_idx" ON "client_status_reports"("client_id", "generated_at");
CREATE INDEX "client_status_reports_project_id_generated_at_idx" ON "client_status_reports"("project_id", "generated_at");
CREATE INDEX "client_status_reports_inquiry_id_generated_at_idx" ON "client_status_reports"("inquiry_id", "generated_at");
CREATE INDEX "client_status_reports_organization_id_generated_at_idx" ON "client_status_reports"("organization_id", "generated_at");
CREATE INDEX "client_status_reports_source_fingerprint_idx" ON "client_status_reports"("source_fingerprint");

CREATE TABLE "client_status_report_sources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "report_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "source_updated_at" DATETIME NOT NULL,
    "section" TEXT NOT NULL,
    CONSTRAINT "client_status_report_sources_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "client_status_reports" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "client_status_report_sources_report_id_source_type_source_id_section_key" ON "client_status_report_sources"("report_id", "source_type", "source_id", "section");
CREATE INDEX "client_status_report_sources_report_id_idx" ON "client_status_report_sources"("report_id");
CREATE INDEX "client_status_report_sources_source_type_source_id_idx" ON "client_status_report_sources"("source_type", "source_id");
