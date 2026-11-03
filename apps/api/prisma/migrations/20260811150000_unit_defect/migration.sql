-- Track defective unit tags (QC / customer return scrap).
ALTER TABLE "ProductUnit" ADD COLUMN IF NOT EXISTS "defectReason" TEXT;
ALTER TABLE "ProductUnit" ADD COLUMN IF NOT EXISTS "defectAt" TIMESTAMP(3);
