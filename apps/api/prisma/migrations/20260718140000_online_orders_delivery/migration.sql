-- Online orders, ward delivery, category rates, coupons, buyer contact

-- Order statuses for online workflow
INSERT INTO "OrderStatusLookup" ("id", "code", "nameEn", "nameBn", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES
  ('ost_pending', 'PENDING', 'Pending', 'অপেক্ষমাণ', 5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ost_accepted', 'ACCEPTED', 'Accepted', 'গৃহীত', 6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ost_out_del', 'OUT_FOR_DELIVERY', 'Out for delivery', 'ডেলিভারিতে', 7, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ost_delivered', 'DELIVERED', 'Delivered', 'ডেলিভারি সম্পন্ন', 8, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

CREATE TABLE IF NOT EXISTS "DeliveryWard" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "freeDelivery" BOOLEAN NOT NULL DEFAULT false,
    "baseChargeBdt" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeliveryWard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DeliveryCategoryRate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "chargePerUnitBdt" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeliveryCategoryRate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Coupon" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" TEXT NOT NULL,
    "discountValue" DECIMAL(12,2) NOT NULL,
    "minOrderBdt" DECIMAL(12,2),
    "maxDiscountBdt" DECIMAL(12,2),
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DeliveryWard_tenantId_idx" ON "DeliveryWard"("tenantId");
CREATE INDEX IF NOT EXISTS "DeliveryWard_tenantId_branchId_idx" ON "DeliveryWard"("tenantId", "branchId");
CREATE INDEX IF NOT EXISTS "DeliveryWard_branchId_idx" ON "DeliveryWard"("branchId");
CREATE UNIQUE INDEX IF NOT EXISTS "DeliveryCategoryRate_tenantId_category_key" ON "DeliveryCategoryRate"("tenantId", "category");
CREATE INDEX IF NOT EXISTS "DeliveryCategoryRate_tenantId_idx" ON "DeliveryCategoryRate"("tenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "Coupon_tenantId_code_key" ON "Coupon"("tenantId", "code");
CREATE INDEX IF NOT EXISTS "Coupon_tenantId_idx" ON "Coupon"("tenantId");

DO $$ BEGIN
  ALTER TABLE "DeliveryWard" ADD CONSTRAINT "DeliveryWard_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DeliveryWard" ADD CONSTRAINT "DeliveryWard_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DeliveryCategoryRate" ADD CONSTRAINT "DeliveryCategoryRate_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Buyer" ADD COLUMN IF NOT EXISTS "contactName" TEXT;
ALTER TABLE "Buyer" ADD COLUMN IF NOT EXISTS "wardId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Buyer" ADD CONSTRAINT "Buyer_wardId_fkey"
    FOREIGN KEY ("wardId") REFERENCES "DeliveryWard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Buyer_wardId_idx" ON "Buyer"("wardId");

ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "clientName" TEXT;
ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "shopName" TEXT;
ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "wardId" TEXT;
ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "couponId" TEXT;
ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "couponCode" TEXT;
ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "subtotalBdt" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "deliveryBdt" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "discountBdt" DECIMAL(12,2) NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_wardId_fkey"
    FOREIGN KEY ("wardId") REFERENCES "DeliveryWard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_couponId_fkey"
    FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "SalesOrder_wardId_idx" ON "SalesOrder"("wardId");
CREATE INDEX IF NOT EXISTS "SalesOrder_branchId_idx" ON "SalesOrder"("branchId");

-- Pending online lines may not have a batch yet
ALTER TABLE "OrderLine" ALTER COLUMN "batchId" DROP NOT NULL;
