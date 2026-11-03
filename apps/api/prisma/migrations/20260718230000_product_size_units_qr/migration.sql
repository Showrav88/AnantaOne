-- AlterTable
ALTER TABLE "Product" ADD COLUMN "size" DECIMAL(12,3);

-- AlterTable
ALTER TABLE "ProductionBatch" ADD COLUMN "serialStart" INTEGER,
ADD COLUMN "serialEnd" INTEGER,
ADD COLUMN "reversedAt" TIMESTAMP(3),
ADD COLUMN "reverseReason" TEXT;

-- CreateTable
CREATE TABLE "ProductUnit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "serialNo" INTEGER NOT NULL,
    "serialCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_STOCK',
    "orderLineId" TEXT,
    "soldAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductUnit_tenantId_serialCode_key" ON "ProductUnit"("tenantId", "serialCode");

-- CreateIndex
CREATE UNIQUE INDEX "ProductUnit_tenantId_productId_serialNo_key" ON "ProductUnit"("tenantId", "productId", "serialNo");

-- CreateIndex
CREATE INDEX "ProductUnit_tenantId_batchId_status_idx" ON "ProductUnit"("tenantId", "batchId", "status");

-- CreateIndex
CREATE INDEX "ProductUnit_orderLineId_idx" ON "ProductUnit"("orderLineId");

-- CreateIndex
CREATE INDEX "ProductUnit_status_idx" ON "ProductUnit"("status");

-- AddForeignKey
ALTER TABLE "ProductUnit" ADD CONSTRAINT "ProductUnit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductUnit" ADD CONSTRAINT "ProductUnit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductUnit" ADD CONSTRAINT "ProductUnit_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductUnit" ADD CONSTRAINT "ProductUnit_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Optional milliliter unit for 500ml-style sizes
INSERT INTO "UnitLookup" ("id", "code", "nameEn", "nameBn", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT 'clunit_ml_' || substr(md5(random()::text), 1, 10), 'MILLILITER', 'Milliliter', 'মিলিলিটার', 15, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "UnitLookup" WHERE "code" = 'MILLILITER');
