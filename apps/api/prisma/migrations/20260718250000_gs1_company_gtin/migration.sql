-- GS1 company prefix + product GTIN allocation
ALTER TABLE "Company" ADD COLUMN "gs1CompanyPrefix" TEXT;
ALTER TABLE "Company" ADD COLUMN "gs1Enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Company" ADD COLUMN "gs1NextItemRef" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Product" ADD COLUMN "gtin" TEXT;
ALTER TABLE "Product" ADD COLUMN "gs1ItemReference" TEXT;

CREATE UNIQUE INDEX "Product_gtin_key" ON "Product"("gtin");
