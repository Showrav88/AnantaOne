-- Lookups (no Postgres enums for app roles/units)
CREATE TABLE "RoleLookup" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RoleLookup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoleLookup_code_key" ON "RoleLookup"("code");

CREATE TABLE "UnitLookup" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UnitLookup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UnitLookup_code_key" ON "UnitLookup"("code");

-- Fixed ids so data migration is deterministic
INSERT INTO "RoleLookup" ("id","code","nameEn","nameBn","scope","description","sortOrder","isActive","createdAt","updatedAt") VALUES
('role_super_admin','SUPER_ADMIN','Super Admin','সুপার অ্যাডমিন','platform','SaaS platform owner — manage all companies',0,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('role_owner','OWNER','Owner','মালিক','tenant','Company owner',1,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('role_manager','MANAGER','Manager','ম্যানেজার','tenant','Company manager',2,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('role_employee','EMPLOYEE','Employee','কর্মচারী','tenant','Company employee',3,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

INSERT INTO "UnitLookup" ("id","code","nameEn","nameBn","sortOrder","isActive","createdAt","updatedAt") VALUES
('unit_liter','LITER','Liter','লিটার',1,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('unit_bottle','BOTTLE','Bottle','বোতল',2,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('unit_drum','DRUM','Drum','ড্রাম',3,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('unit_piece','PIECE','Piece','পিস',4,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('unit_kg','KG','Kilogram','কেজি',5,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

-- Company active flag for SaaS admin
ALTER TABLE "Company" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- User: add roleId, relax tenantId, prepare global email unique
ALTER TABLE "User" ADD COLUMN "roleId" TEXT;
ALTER TABLE "User" ALTER COLUMN "tenantId" DROP NOT NULL;

UPDATE "User" SET "roleId" = 'role_owner' WHERE "role"::text = 'OWNER';
UPDATE "User" SET "roleId" = 'role_manager' WHERE "role"::text = 'MANAGER';
UPDATE "User" SET "roleId" = 'role_employee' WHERE "role"::text IN ('COUNTER','PRODUCTION','DELIVERY','BUYER');
UPDATE "User" SET "roleId" = 'role_employee' WHERE "roleId" IS NULL;

ALTER TABLE "User" ALTER COLUMN "roleId" SET NOT NULL;

-- Drop old tenant+email unique; use global email for login
DROP INDEX IF EXISTS "User_tenantId_email_key";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

ALTER TABLE "User" DROP COLUMN "role";

ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "RoleLookup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- Product unit lookup
ALTER TABLE "Product" ADD COLUMN "unitId" TEXT;

UPDATE "Product" SET "unitId" = 'unit_liter' WHERE "unit"::text = 'LITER';
UPDATE "Product" SET "unitId" = 'unit_bottle' WHERE "unit"::text = 'BOTTLE';
UPDATE "Product" SET "unitId" = 'unit_drum' WHERE "unit"::text = 'DRUM';
UPDATE "Product" SET "unitId" = 'unit_piece' WHERE "unit"::text = 'PIECE';
UPDATE "Product" SET "unitId" = 'unit_kg' WHERE "unit"::text = 'KG';
UPDATE "Product" SET "unitId" = 'unit_bottle' WHERE "unitId" IS NULL;

ALTER TABLE "Product" ALTER COLUMN "unitId" SET NOT NULL;
ALTER TABLE "Product" DROP COLUMN "unit";
ALTER TABLE "Product" ADD CONSTRAINT "Product_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "UnitLookup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Product_unitId_idx" ON "Product"("unitId");

DROP TYPE "Role";
DROP TYPE "ProductUnit";

CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
