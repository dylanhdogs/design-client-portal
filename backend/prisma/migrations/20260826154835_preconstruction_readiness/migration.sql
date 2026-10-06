-- CreateTable
CREATE TABLE "preconstruction_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT,
    "project_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "owner_id" TEXT,
    "reviewer_id" TEXT,
    "due_at" DATETIME,
    "client_visible" BOOLEAN NOT NULL DEFAULT false,
    "responsibility_party" TEXT,
    "cost_code" TEXT,
    "amount_cents" INTEGER,
    "allowance_cents" INTEGER,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "start_at" DATETIME,
    "end_at" DATETIME,
    "long_lead" BOOLEAN NOT NULL DEFAULT false,
    "source_reference" TEXT,
    "target_reference" TEXT,
    "completed_at" DATETIME,
    "verified_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "preconstruction_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "pool_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "preconstruction_items_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "preconstruction_items_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "readiness_reviews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT,
    "project_id" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "checklist_json" TEXT NOT NULL,
    "blocker_count" INTEGER NOT NULL DEFAULT 0,
    "exception_count" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,
    "result" TEXT,
    "submitted_at" DATETIME,
    "reviewed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "readiness_reviews_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "pool_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "readiness_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "readiness_exceptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT,
    "project_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "risk" TEXT NOT NULL,
    "mitigation" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "due_at" DATETIME NOT NULL,
    "high_risk" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approved_by" TEXT,
    "approved_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "readiness_exceptions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "pool_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "readiness_exceptions_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "preconstruction_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "readiness_exceptions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "readiness_exceptions_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "preconstruction_items_project_id_idx" ON "preconstruction_items"("project_id");

-- CreateIndex
CREATE INDEX "preconstruction_items_project_id_category_idx" ON "preconstruction_items"("project_id", "category");

-- CreateIndex
CREATE INDEX "preconstruction_items_owner_id_status_idx" ON "preconstruction_items"("owner_id", "status");

-- CreateIndex
CREATE INDEX "preconstruction_items_due_at_idx" ON "preconstruction_items"("due_at");

-- CreateIndex
CREATE INDEX "preconstruction_items_organization_id_project_id_idx" ON "preconstruction_items"("organization_id", "project_id");

-- CreateIndex
CREATE INDEX "readiness_reviews_project_id_idx" ON "readiness_reviews"("project_id");

-- CreateIndex
CREATE INDEX "readiness_reviews_project_id_status_idx" ON "readiness_reviews"("project_id", "status");

-- CreateIndex
CREATE INDEX "readiness_reviews_reviewer_id_idx" ON "readiness_reviews"("reviewer_id");

-- CreateIndex
CREATE INDEX "readiness_reviews_organization_id_project_id_idx" ON "readiness_reviews"("organization_id", "project_id");

-- CreateIndex
CREATE INDEX "readiness_exceptions_project_id_idx" ON "readiness_exceptions"("project_id");

-- CreateIndex
CREATE INDEX "readiness_exceptions_item_id_idx" ON "readiness_exceptions"("item_id");

-- CreateIndex
CREATE INDEX "readiness_exceptions_status_idx" ON "readiness_exceptions"("status");

-- CreateIndex
CREATE INDEX "readiness_exceptions_organization_id_project_id_idx" ON "readiness_exceptions"("organization_id", "project_id");
