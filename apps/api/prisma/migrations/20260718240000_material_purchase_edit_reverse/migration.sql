-- Editable / reversible supply purchases.
ALTER TABLE "MaterialPurchase" ADD COLUMN "reverseReason" TEXT;
ALTER TABLE "MaterialPurchase" ADD COLUMN "reversedAt" TIMESTAMP(3);
ALTER TABLE "MaterialPurchase" ADD COLUMN "reversedBy" TEXT;
ALTER TABLE "MaterialPurchase" ADD COLUMN "reverseCashTransactionId" TEXT;
ALTER TABLE "MaterialPurchase" ADD COLUMN "updatedBy" TEXT;

CREATE UNIQUE INDEX "MaterialPurchase_reverseCashTransactionId_key"
  ON "MaterialPurchase"("reverseCashTransactionId");

ALTER TABLE "MaterialPurchase" ADD CONSTRAINT "MaterialPurchase_reverseCashTransactionId_fkey"
  FOREIGN KEY ("reverseCashTransactionId") REFERENCES "CashTransaction"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "WalletTxnTypeLookup" ("id","code","nameEn","nameBn","direction","description","sortOrder","isActive","createdAt","updatedAt") VALUES
('wtxn_material_rev','MATERIAL_REVERSE','Material reverse','কাঁচামাল রিভার্স','credit','Credit cash drawer when a supply purchase is reversed',13,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
