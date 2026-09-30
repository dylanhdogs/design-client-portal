CREATE TABLE "inquiry_compliance_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inquiry_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "summary" TEXT,
    "authority_type" TEXT NOT NULL,
    "authority_name" TEXT NOT NULL,
    "added_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inquiry_compliance_links_inquiry_id_fkey"
      FOREIGN KEY ("inquiry_id") REFERENCES "inquiries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "inquiry_compliance_links_inquiry_id_url_key"
ON "inquiry_compliance_links"("inquiry_id", "url");

CREATE INDEX "inquiry_compliance_links_inquiry_id_added_at_idx"
ON "inquiry_compliance_links"("inquiry_id", "added_at");
