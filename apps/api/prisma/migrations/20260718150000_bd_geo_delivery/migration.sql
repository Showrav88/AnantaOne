-- Bangladesh geography + company location + outside/zila delivery charges

CREATE TABLE IF NOT EXISTS "BdDivision" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BdDivision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BdDivision_code_key" ON "BdDivision"("code");

CREATE TABLE IF NOT EXISTS "BdDistrict" (
    "id" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BdDistrict_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BdDistrict_code_key" ON "BdDistrict"("code");
CREATE INDEX IF NOT EXISTS "BdDistrict_divisionId_idx" ON "BdDistrict"("divisionId");

CREATE TABLE IF NOT EXISTS "BdUpazila" (
    "id" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BdUpazila_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BdUpazila_code_key" ON "BdUpazila"("code");
CREATE INDEX IF NOT EXISTS "BdUpazila_districtId_idx" ON "BdUpazila"("districtId");

DO $$ BEGIN
  ALTER TABLE "BdDistrict" ADD CONSTRAINT "BdDistrict_divisionId_fkey"
    FOREIGN KEY ("divisionId") REFERENCES "BdDivision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "BdUpazila" ADD CONSTRAINT "BdUpazila_districtId_fkey"
    FOREIGN KEY ("districtId") REFERENCES "BdDistrict"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "divisionId" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "districtId" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "upazilaId" TEXT;

CREATE INDEX IF NOT EXISTS "Company_divisionId_idx" ON "Company"("divisionId");
CREATE INDEX IF NOT EXISTS "Company_districtId_idx" ON "Company"("districtId");
CREATE INDEX IF NOT EXISTS "Company_upazilaId_idx" ON "Company"("upazilaId");

DO $$ BEGIN
  ALTER TABLE "Company" ADD CONSTRAINT "Company_divisionId_fkey"
    FOREIGN KEY ("divisionId") REFERENCES "BdDivision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Company" ADD CONSTRAINT "Company_districtId_fkey"
    FOREIGN KEY ("districtId") REFERENCES "BdDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Company" ADD CONSTRAINT "Company_upazilaId_fkey"
    FOREIGN KEY ("upazilaId") REFERENCES "BdUpazila"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "DeliverySettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "outsideAreaChargeBdt" DECIMAL(12,2) NOT NULL DEFAULT 80,
    "sameDistrictChargeBdt" DECIMAL(12,2) NOT NULL DEFAULT 120,
    "otherDistrictChargeBdt" DECIMAL(12,2) NOT NULL DEFAULT 250,
    "defaultWardCount" INTEGER NOT NULL DEFAULT 15,
    "freeWardCount" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeliverySettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DeliverySettings_tenantId_key" ON "DeliverySettings"("tenantId");

DO $$ BEGIN
  ALTER TABLE "DeliverySettings" ADD CONSTRAINT "DeliverySettings_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "DeliveryWard" ADD COLUMN IF NOT EXISTS "districtId" TEXT;
ALTER TABLE "DeliveryWard" ADD COLUMN IF NOT EXISTS "upazilaId" TEXT;

CREATE INDEX IF NOT EXISTS "DeliveryWard_tenantId_upazilaId_idx" ON "DeliveryWard"("tenantId", "upazilaId");
CREATE INDEX IF NOT EXISTS "DeliveryWard_districtId_idx" ON "DeliveryWard"("districtId");
CREATE INDEX IF NOT EXISTS "DeliveryWard_upazilaId_idx" ON "DeliveryWard"("upazilaId");

DO $$ BEGIN
  ALTER TABLE "DeliveryWard" ADD CONSTRAINT "DeliveryWard_districtId_fkey"
    FOREIGN KEY ("districtId") REFERENCES "BdDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DeliveryWard" ADD CONSTRAINT "DeliveryWard_upazilaId_fkey"
    FOREIGN KEY ("upazilaId") REFERENCES "BdUpazila"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "districtId" TEXT;
ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "upazilaId" TEXT;

CREATE INDEX IF NOT EXISTS "SalesOrder_districtId_idx" ON "SalesOrder"("districtId");
CREATE INDEX IF NOT EXISTS "SalesOrder_upazilaId_idx" ON "SalesOrder"("upazilaId");

DO $$ BEGIN
  ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_districtId_fkey"
    FOREIGN KEY ("districtId") REFERENCES "BdDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_upazilaId_fkey"
    FOREIGN KEY ("upazilaId") REFERENCES "BdUpazila"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
