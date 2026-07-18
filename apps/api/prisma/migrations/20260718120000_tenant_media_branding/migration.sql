-- Tenant public-shop branding + Cloudinary media library + product images

ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "logoPublicId" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "heroImageUrl" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "heroImagePublicId" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "heroVideoUrl" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "heroVideoPublicId" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "brandPrimary" TEXT DEFAULT '#0f6b4c';
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "brandAccent" TEXT DEFAULT '#f42a41';
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "brandBg" TEXT DEFAULT '#06281f';
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "brandFont" TEXT DEFAULT 'source-sans';
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "siteHeadline" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "siteSubhead" TEXT;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "imagePublicId" TEXT;

CREATE TABLE IF NOT EXISTS "MediaAsset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "folder" TEXT NOT NULL,
    "format" TEXT,
    "bytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "durationSec" DOUBLE PRECISION,
    "originalName" TEXT,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MediaAsset_tenantId_publicId_key" ON "MediaAsset"("tenantId", "publicId");
CREATE INDEX IF NOT EXISTS "MediaAsset_tenantId_idx" ON "MediaAsset"("tenantId");
CREATE INDEX IF NOT EXISTS "MediaAsset_tenantId_kind_idx" ON "MediaAsset"("tenantId", "kind");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MediaAsset_tenantId_fkey'
  ) THEN
    ALTER TABLE "MediaAsset"
      ADD CONSTRAINT "MediaAsset_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
