-- Order source / status lookups
CREATE TABLE "OrderSourceLookup" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrderSourceLookup_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrderSourceLookup_code_key" ON "OrderSourceLookup"("code");

INSERT INTO "OrderSourceLookup" ("id","code","nameEn","nameBn","sortOrder","isActive","createdAt","updatedAt") VALUES
('osrc_phone','PHONE','Phone call','ফোন কল',1,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('osrc_online','ONLINE','Online order','অনলাইন অর্ডার',2,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('osrc_walk','WALK_IN','Walk-in','সরাসরি',3,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('osrc_counter','COUNTER','Counter','কাউন্টার',4,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

CREATE TABLE "OrderStatusLookup" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrderStatusLookup_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrderStatusLookup_code_key" ON "OrderStatusLookup"("code");

INSERT INTO "OrderStatusLookup" ("id","code","nameEn","nameBn","sortOrder","isActive","createdAt","updatedAt") VALUES
('ost_draft','DRAFT','Draft','খসড়া',1,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('ost_confirmed','CONFIRMED','Confirmed','নিশ্চিত',2,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('ost_cancelled','CANCELLED','Cancelled','বাতিল',3,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

-- Production batches
CREATE TABLE "ProductionBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchCode" TEXT NOT NULL,
    "manufacturedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "qtyProduced" DECIMAL(12,2) NOT NULL,
    "qtyRemaining" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    CONSTRAINT "ProductionBatch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductionBatch_tenantId_batchCode_key" ON "ProductionBatch"("tenantId", "batchCode");
CREATE INDEX "ProductionBatch_tenantId_productId_idx" ON "ProductionBatch"("tenantId", "productId");
CREATE INDEX "ProductionBatch_productId_expiresAt_idx" ON "ProductionBatch"("productId", "expiresAt");
ALTER TABLE "ProductionBatch" ADD CONSTRAINT "ProductionBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionBatch" ADD CONSTRAINT "ProductionBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sales orders
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "buyerId" TEXT,
    "buyerName" TEXT,
    "sourceId" TEXT NOT NULL,
    "statusId" TEXT NOT NULL,
    "totalBdt" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "saleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SalesOrder_saleId_key" ON "SalesOrder"("saleId");
CREATE INDEX "SalesOrder_tenantId_orderedAt_idx" ON "SalesOrder"("tenantId", "orderedAt");
CREATE INDEX "SalesOrder_statusId_idx" ON "SalesOrder"("statusId");
CREATE INDEX "SalesOrder_sourceId_idx" ON "SalesOrder"("sourceId");
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "OrderSourceLookup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "OrderStatusLookup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "OrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "qty" DECIMAL(12,2) NOT NULL,
    "unitPriceBdt" DECIMAL(12,2) NOT NULL,
    "lineTotalBdt" DECIMAL(14,2) NOT NULL,
    CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrderLine_orderId_idx" ON "OrderLine"("orderId");
CREATE INDEX "OrderLine_productId_idx" ON "OrderLine"("productId");
CREATE INDEX "OrderLine_batchId_idx" ON "OrderLine"("batchId");
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductionBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tag print templates
CREATE TABLE "TagTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "widthMm" INTEGER NOT NULL DEFAULT 50,
    "heightMm" INTEGER NOT NULL DEFAULT 30,
    "showSku" BOOLEAN NOT NULL DEFAULT true,
    "showPrice" BOOLEAN NOT NULL DEFAULT true,
    "showDescription" BOOLEAN NOT NULL DEFAULT true,
    "showMfgDate" BOOLEAN NOT NULL DEFAULT true,
    "showExpDate" BOOLEAN NOT NULL DEFAULT true,
    "showBatch" BOOLEAN NOT NULL DEFAULT true,
    "showQr" BOOLEAN NOT NULL DEFAULT true,
    "showCompany" BOOLEAN NOT NULL DEFAULT true,
    "tagDescription" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TagTemplate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TagTemplate_tenantId_idx" ON "TagTemplate"("tenantId");
ALTER TABLE "TagTemplate" ADD CONSTRAINT "TagTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
