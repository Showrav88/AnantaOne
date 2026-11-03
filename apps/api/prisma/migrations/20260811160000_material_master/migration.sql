-- Tenant-scoped raw material / supply catalog (bottle, cap, acid…).
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "code" TEXT,
    "kindId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "minStock" DECIMAL(14,3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Material_tenantId_code_key" ON "Material"("tenantId", "code");
CREATE INDEX "Material_tenantId_idx" ON "Material"("tenantId");
CREATE INDEX "Material_tenantId_isActive_idx" ON "Material"("tenantId", "isActive");
CREATE INDEX "Material_kindId_idx" ON "Material"("kindId");
CREATE INDEX "Material_unitId_idx" ON "Material"("unitId");

ALTER TABLE "Material" ADD CONSTRAINT "Material_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Material" ADD CONSTRAINT "Material_kindId_fkey"
    FOREIGN KEY ("kindId") REFERENCES "SupplyKindLookup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Material" ADD CONSTRAINT "Material_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "UnitLookup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MaterialPurchase" ADD COLUMN IF NOT EXISTS "materialId" TEXT;
CREATE INDEX IF NOT EXISTS "MaterialPurchase_materialId_idx" ON "MaterialPurchase"("materialId");
ALTER TABLE "MaterialPurchase" ADD CONSTRAINT "MaterialPurchase_materialId_fkey"
    FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;
