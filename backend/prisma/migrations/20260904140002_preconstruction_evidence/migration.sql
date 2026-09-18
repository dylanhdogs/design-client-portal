-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_evidence_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT,
    "document_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "requirement_id" TEXT,
    "design_version_id" TEXT,
    "scope_version_id" TEXT,
    "work_item_id" TEXT,
    "preconstruction_item_id" TEXT,
    "purpose" TEXT NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evidence_links_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "evidence_links_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "pool_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "evidence_links_design_version_id_fkey" FOREIGN KEY ("design_version_id") REFERENCES "design_versions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "evidence_links_scope_version_id_fkey" FOREIGN KEY ("scope_version_id") REFERENCES "scope_versions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "evidence_links_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "work_items" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "evidence_links_preconstruction_item_id_fkey" FOREIGN KEY ("preconstruction_item_id") REFERENCES "preconstruction_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "evidence_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "evidence_links_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "compliance_requirements" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_evidence_links" ("created_at", "created_by", "design_version_id", "document_id", "id", "is_current", "organization_id", "project_id", "purpose", "requirement_id", "scope_version_id", "stage", "work_item_id") SELECT "created_at", "created_by", "design_version_id", "document_id", "id", "is_current", "organization_id", "project_id", "purpose", "requirement_id", "scope_version_id", "stage", "work_item_id" FROM "evidence_links";
DROP TABLE "evidence_links";
ALTER TABLE "new_evidence_links" RENAME TO "evidence_links";
CREATE INDEX "evidence_links_project_id_stage_idx" ON "evidence_links"("project_id", "stage");
CREATE INDEX "evidence_links_requirement_id_is_current_idx" ON "evidence_links"("requirement_id", "is_current");
CREATE INDEX "evidence_links_document_id_idx" ON "evidence_links"("document_id");
CREATE INDEX "evidence_links_design_version_id_idx" ON "evidence_links"("design_version_id");
CREATE INDEX "evidence_links_scope_version_id_idx" ON "evidence_links"("scope_version_id");
CREATE INDEX "evidence_links_work_item_id_idx" ON "evidence_links"("work_item_id");
CREATE INDEX "evidence_links_preconstruction_item_id_is_current_idx" ON "evidence_links"("preconstruction_item_id", "is_current");
CREATE INDEX "evidence_links_organization_id_project_id_idx" ON "evidence_links"("organization_id", "project_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
