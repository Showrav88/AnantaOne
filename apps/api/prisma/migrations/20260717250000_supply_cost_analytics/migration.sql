-- Extra purchase units (pack / can for chemicals)
INSERT INTO "UnitLookup" ("id","code","nameEn","nameBn","sortOrder","isActive","createdAt","updatedAt") VALUES
('unit_pack','PACK','Pack','প্যাক',6,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('unit_can','CAN','Can','ক্যান',7,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Supply kinds: raw water, bottle, acid, etc.
CREATE TABLE "SupplyKindLookup" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupplyKindLookup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplyKindLookup_code_key" ON "SupplyKindLookup"("code");

INSERT INTO "SupplyKindLookup" ("id","code","nameEn","nameBn","description","sortOrder","isActive","createdAt","updatedAt") VALUES
('supkind_raw','RAW_MATERIAL','Raw material / water','কাঁচামাল / পানি','Bulk water or raw input',1,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('supkind_bottle','BOTTLE','Empty bottle','খালি বোতল','Empty bottles by pcs',2,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('supkind_acid','ACID','Acid / chemical','অ্যাসিড / কেমিক্যাল','Acid and treatment chemicals',3,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('supkind_cap','CAP','Cap / lid','ঢাকনা','Bottle caps',4,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('supkind_label','LABEL','Label / sticker','লেবেল','Product labels',5,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('supkind_other','OTHER','Other supply','অন্যান্য সাপ্লাই','Other production supplies',6,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

-- Transport-related expense categories (standalone cash-out)
INSERT INTO "ExpenseCategoryLookup" ("id","code","nameEn","nameBn","description","sortOrder","isActive","createdAt","updatedAt") VALUES
('expcat_transport','TRANSPORT','Transportation','পরিবহন','Freight / vehicle hire for goods',6,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('expcat_driver','DRIVER','Driver bill','ড্রাইভার বিল','Driver wage or trip fee',7,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('expcat_travel','TRAVEL','Travel cost','ভ্রমণ খরচ','Travel for purchase / delivery',8,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "WalletTxnTypeLookup" ("id","code","nameEn","nameBn","direction","description","sortOrder","isActive","createdAt","updatedAt") VALUES
('wtxn_transport','TRANSPORT','Transportation','পরিবহন','debit','Transport / freight cash out',11,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Enrich material / supply purchases
ALTER TABLE "MaterialPurchase" ADD COLUMN "kindId" TEXT;
ALTER TABLE "MaterialPurchase" ADD COLUMN "unitId" TEXT;
ALTER TABLE "MaterialPurchase" ADD COLUMN "qty" DECIMAL(14,3) NOT NULL DEFAULT 1;
ALTER TABLE "MaterialPurchase" ADD COLUMN "goodsAmountBdt" DECIMAL(14,2);
ALTER TABLE "MaterialPurchase" ADD COLUMN "transportBdt" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "MaterialPurchase" ADD COLUMN "driverBdt" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "MaterialPurchase" ADD COLUMN "travelBdt" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- Backfill existing rows
UPDATE "MaterialPurchase"
SET
  "kindId" = 'supkind_other',
  "unitId" = 'unit_piece',
  "goodsAmountBdt" = "amountBdt"
WHERE "kindId" IS NULL;

ALTER TABLE "MaterialPurchase" ALTER COLUMN "kindId" SET NOT NULL;
ALTER TABLE "MaterialPurchase" ALTER COLUMN "unitId" SET NOT NULL;
ALTER TABLE "MaterialPurchase" ALTER COLUMN "goodsAmountBdt" SET NOT NULL;

ALTER TABLE "MaterialPurchase" ADD CONSTRAINT "MaterialPurchase_kindId_fkey"
  FOREIGN KEY ("kindId") REFERENCES "SupplyKindLookup"("id") ON UPDATE CASCADE;
ALTER TABLE "MaterialPurchase" ADD CONSTRAINT "MaterialPurchase_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "UnitLookup"("id") ON UPDATE CASCADE;

CREATE INDEX "MaterialPurchase_kindId_idx" ON "MaterialPurchase"("kindId");
CREATE INDEX "MaterialPurchase_unitId_idx" ON "MaterialPurchase"("unitId");
