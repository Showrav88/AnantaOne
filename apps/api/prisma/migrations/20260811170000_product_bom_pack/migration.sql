-- Structured BOM + outer box link (any units per pack).
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "innerProductId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "unitsPerPack" INTEGER;

CREATE INDEX IF NOT EXISTS "Product_innerProductId_idx" ON "Product"("innerProductId");

ALTER TABLE "Product" ADD CONSTRAINT "Product_innerProductId_fkey"
    FOREIGN KEY ("innerProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ProductBomLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "qty" DECIMAL(14,6) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductBomLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductBomLine_productId_materialId_key" ON "ProductBomLine"("productId", "materialId");
CREATE INDEX "ProductBomLine_productId_idx" ON "ProductBomLine"("productId");
CREATE INDEX "ProductBomLine_materialId_idx" ON "ProductBomLine"("materialId");
CREATE INDEX "ProductBomLine_tenantId_idx" ON "ProductBomLine"("tenantId");

ALTER TABLE "ProductBomLine" ADD CONSTRAINT "ProductBomLine_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductBomLine" ADD CONSTRAINT "ProductBomLine_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductBomLine" ADD CONSTRAINT "ProductBomLine_materialId_fkey"
    FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
