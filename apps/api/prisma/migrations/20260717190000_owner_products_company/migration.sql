-- AlterTable
ALTER TABLE "Company" ADD COLUMN "phone" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "tagline" TEXT,
ADD COLUMN "description" TEXT;

-- CreateEnum
CREATE TYPE "ProductUnit" AS ENUM ('LITER', 'BOTTLE', 'DRUM', 'PIECE', 'KG');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "sku" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'water',
    "unit" "ProductUnit" NOT NULL DEFAULT 'BOTTLE',
    "priceBdt" DECIMAL(12,2) NOT NULL,
    "stockQty" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "minStock" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Product_tenantId_idx" ON "Product"("tenantId");

-- CreateIndex
CREATE INDEX "Product_tenantId_isActive_idx" ON "Product"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Product_tenantId_sku_key" ON "Product"("tenantId", "sku");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
