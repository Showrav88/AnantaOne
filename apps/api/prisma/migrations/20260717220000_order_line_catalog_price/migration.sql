-- Snapshot catalog price at sell time (list vs charged)
ALTER TABLE "OrderLine" ADD COLUMN "catalogPriceBdt" DECIMAL(12,2);

UPDATE "OrderLine" SET "catalogPriceBdt" = "unitPriceBdt" WHERE "catalogPriceBdt" IS NULL;

ALTER TABLE "OrderLine" ALTER COLUMN "catalogPriceBdt" SET NOT NULL;
