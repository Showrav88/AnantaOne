-- Reversed order status
INSERT INTO "OrderStatusLookup" ("id","code","nameEn","nameBn","sortOrder","isActive","createdAt","updatedAt")
VALUES ('ost_reversed','REVERSED','Reversed','বাতিল/রিভার্স',4,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Wallet debit type for sale reverse / return
INSERT INTO "WalletTxnTypeLookup" ("id","code","nameEn","nameBn","direction","description","sortOrder","isActive","createdAt","updatedAt")
VALUES ('wtxn_sale_rev','SALE_REVERSE','Sale reverse','বিক্রয় রিভার্স','debit','Debit cash drawer when a confirmed sale is reversed',8,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Stable invoice code + reverse audit fields
ALTER TABLE "SalesOrder" ADD COLUMN "invoiceCode" TEXT;
ALTER TABLE "SalesOrder" ADD COLUMN "reverseReason" TEXT;
ALTER TABLE "SalesOrder" ADD COLUMN "reversedAt" TIMESTAMP(3);
ALTER TABLE "SalesOrder" ADD COLUMN "reversedBy" TEXT;

-- Backfill invoice codes for existing rows
UPDATE "SalesOrder"
SET "invoiceCode" = 'INV-' || to_char("orderedAt", 'YYYYMMDD') || '-' || upper(right("id", 6))
WHERE "invoiceCode" IS NULL;

ALTER TABLE "SalesOrder" ALTER COLUMN "invoiceCode" SET NOT NULL;

CREATE UNIQUE INDEX "SalesOrder_tenantId_invoiceCode_key" ON "SalesOrder"("tenantId", "invoiceCode");
CREATE INDEX "SalesOrder_invoiceCode_idx" ON "SalesOrder"("invoiceCode");
