-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT,
    "name" TEXT NOT NULL,
    "contact_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "category" TEXT NOT NULL,
    "compliance_status" TEXT NOT NULL DEFAULT 'PENDING',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "procurement_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT,
    "project_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "specification" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "required_by" DATETIME NOT NULL,
    "estimated_cost_cents" INTEGER,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "cost_code" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "owner_id" TEXT,
    "client_visible" BOOLEAN NOT NULL DEFAULT false,
    "selected_quote_id" TEXT,
    "closed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "procurement_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "pool_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "procurement_requests_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "procurement_requests_selected_quote_id_fkey" FOREIGN KEY ("selected_quote_id") REFERENCES "quotes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "procurement_request_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "tax_cents" INTEGER NOT NULL DEFAULT 0,
    "total_cents" INTEGER NOT NULL,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "scope" TEXT NOT NULL,
    "valid_until" DATETIME,
    "lead_time_days" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "selected_by" TEXT,
    "selected_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quotes_procurement_request_id_fkey" FOREIGN KEY ("procurement_request_id") REFERENCES "procurement_requests" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "quotes_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "quotes_selected_by_fkey" FOREIGN KEY ("selected_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "procurement_request_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "subtotal_cents" INTEGER NOT NULL,
    "tax_cents" INTEGER NOT NULL DEFAULT 0,
    "approved_amount_cents" INTEGER NOT NULL,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "cost_code" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "issued_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorized_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "purchase_orders_procurement_request_id_fkey" FOREIGN KEY ("procurement_request_id") REFERENCES "procurement_requests" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "purchase_orders_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "purchase_orders_authorized_by_fkey" FOREIGN KEY ("authorized_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchase_order_id" TEXT NOT NULL,
    "expected_at" DATETIME,
    "received_at" DATETIME,
    "quantity_received" REAL NOT NULL,
    "condition" TEXT NOT NULL,
    "inspection_status" TEXT NOT NULL DEFAULT 'PENDING',
    "inspection_notes" TEXT,
    "inspected_by" TEXT,
    "inspected_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deliveries_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "deliveries_inspected_by_fkey" FOREIGN KEY ("inspected_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "substitutions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "procurement_request_id" TEXT NOT NULL,
    "original_specification" TEXT NOT NULL,
    "proposed_specification" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "cost_impact_cents" INTEGER NOT NULL DEFAULT 0,
    "schedule_impact_days" INTEGER NOT NULL DEFAULT 0,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "client_authorization_required" BOOLEAN NOT NULL DEFAULT false,
    "requested_by" TEXT NOT NULL,
    "approved_by" TEXT,
    "approved_at" DATETIME,
    "client_authorized_by" TEXT,
    "client_authorized_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "substitutions_procurement_request_id_fkey" FOREIGN KEY ("procurement_request_id") REFERENCES "procurement_requests" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "substitutions_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "substitutions_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "substitutions_client_authorized_by_fkey" FOREIGN KEY ("client_authorized_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invoice_matches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchase_order_id" TEXT NOT NULL,
    "invoice_reference" TEXT NOT NULL,
    "ordered_amount_cents" INTEGER NOT NULL,
    "delivered_amount_cents" INTEGER NOT NULL,
    "invoiced_amount_cents" INTEGER NOT NULL,
    "variance_amount_cents" INTEGER NOT NULL,
    "ordered_quantity" REAL NOT NULL,
    "delivered_quantity" REAL NOT NULL,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "invoice_matches_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "vendors_name_idx" ON "vendors"("name");

-- CreateIndex
CREATE INDEX "vendors_category_active_idx" ON "vendors"("category", "active");

-- CreateIndex
CREATE INDEX "vendors_organization_id_active_idx" ON "vendors"("organization_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_requests_selected_quote_id_key" ON "procurement_requests"("selected_quote_id");

-- CreateIndex
CREATE INDEX "procurement_requests_project_id_idx" ON "procurement_requests"("project_id");

-- CreateIndex
CREATE INDEX "procurement_requests_project_id_status_idx" ON "procurement_requests"("project_id", "status");

-- CreateIndex
CREATE INDEX "procurement_requests_owner_id_status_idx" ON "procurement_requests"("owner_id", "status");

-- CreateIndex
CREATE INDEX "procurement_requests_required_by_idx" ON "procurement_requests"("required_by");

-- CreateIndex
CREATE INDEX "procurement_requests_organization_id_project_id_idx" ON "procurement_requests"("organization_id", "project_id");

-- CreateIndex
CREATE INDEX "quotes_procurement_request_id_idx" ON "quotes"("procurement_request_id");

-- CreateIndex
CREATE INDEX "quotes_vendor_id_idx" ON "quotes"("vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_procurement_request_id_vendor_id_key" ON "quotes"("procurement_request_id", "vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_procurement_request_id_key" ON "purchase_orders"("procurement_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_order_number_key" ON "purchase_orders"("order_number");

-- CreateIndex
CREATE INDEX "purchase_orders_vendor_id_idx" ON "purchase_orders"("vendor_id");

-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");

-- CreateIndex
CREATE INDEX "deliveries_purchase_order_id_idx" ON "deliveries"("purchase_order_id");

-- CreateIndex
CREATE INDEX "deliveries_inspection_status_idx" ON "deliveries"("inspection_status");

-- CreateIndex
CREATE INDEX "substitutions_procurement_request_id_idx" ON "substitutions"("procurement_request_id");

-- CreateIndex
CREATE INDEX "substitutions_status_idx" ON "substitutions"("status");

-- CreateIndex
CREATE INDEX "invoice_matches_purchase_order_id_idx" ON "invoice_matches"("purchase_order_id");

-- CreateIndex
CREATE INDEX "invoice_matches_status_idx" ON "invoice_matches"("status");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_matches_purchase_order_id_invoice_reference_key" ON "invoice_matches"("purchase_order_id", "invoice_reference");
