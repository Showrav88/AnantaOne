-- Product catalog: packaging type + materials/recipe note (BOM placeholder).
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "packType" TEXT NOT NULL DEFAULT 'BOTTLE';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "materialsNote" TEXT;
