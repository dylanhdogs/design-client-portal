-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_purchase_orders" (
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
    CONSTRAINT "purchase_orders_procurement_request_id_fkey" FOREIGN KEY ("procurement_request_id") REFERENCES "procurement_requests" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "purchase_orders_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "purchase_orders_authorized_by_fkey" FOREIGN KEY ("authorized_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_purchase_orders" ("approved_amount_cents", "authorized_by", "cost_code", "created_at", "currency_code", "id", "issued_at", "order_number", "procurement_request_id", "status", "subtotal_cents", "tax_cents", "updated_at", "vendor_id") SELECT "approved_amount_cents", "authorized_by", "cost_code", "created_at", "currency_code", "id", "issued_at", "order_number", "procurement_request_id", "status", "subtotal_cents", "tax_cents", "updated_at", "vendor_id" FROM "purchase_orders";
DROP TABLE "purchase_orders";
ALTER TABLE "new_purchase_orders" RENAME TO "purchase_orders";
CREATE UNIQUE INDEX "purchase_orders_procurement_request_id_key" ON "purchase_orders"("procurement_request_id");
CREATE UNIQUE INDEX "purchase_orders_order_number_key" ON "purchase_orders"("order_number");
CREATE INDEX "purchase_orders_vendor_id_idx" ON "purchase_orders"("vendor_id");
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
