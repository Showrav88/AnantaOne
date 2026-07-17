-- Staff HR fields on User
ALTER TABLE "User" ADD COLUMN "employeeCode" TEXT;
ALTER TABLE "User" ADD COLUMN "designation" TEXT;
ALTER TABLE "User" ADD COLUMN "joiningDate" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "salaryBdt" DECIMAL(12,2);

CREATE UNIQUE INDEX "User_tenantId_employeeCode_key" ON "User"("tenantId", "employeeCode");

-- Wallet transaction type lookup
CREATE TABLE "WalletTxnTypeLookup" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WalletTxnTypeLookup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WalletTxnTypeLookup_code_key" ON "WalletTxnTypeLookup"("code");

INSERT INTO "WalletTxnTypeLookup" ("id","code","nameEn","nameBn","direction","description","sortOrder","isActive","createdAt","updatedAt") VALUES
('wtxn_opening','OPENING','Opening balance','ওপেনিং ব্যালেন্স','credit','Initial cash drawer balance',0,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('wtxn_sale','SALE','Sale credit','বিক্রয় জমা','credit','Cash in after sale',1,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('wtxn_material','MATERIAL_BUY','Material purchase','কাঁচামাল ক্রয়','debit','Cash out to buy materials',2,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('wtxn_salary','SALARY','Salary payment','বেতন পরিশোধ','debit','Staff salary debit',3,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('wtxn_adj_in','ADJUSTMENT_IN','Adjustment in','সমন্বয় জমা','credit','Manual credit adjustment',4,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('wtxn_adj_out','ADJUSTMENT_OUT','Adjustment out','সমন্বয় উত্তোলন','debit','Manual debit adjustment',5,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('wtxn_other_in','OTHER_IN','Other credit','অন্যান্য জমা','credit','Other cash in',6,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('wtxn_other_out','OTHER_OUT','Other debit','অন্যান্য উত্তোলন','debit','Other cash out',7,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

-- Company cash wallet
CREATE TABLE "CashWallet" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "balanceBdt" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CashWallet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CashWallet_tenantId_key" ON "CashWallet"("tenantId");
ALTER TABLE "CashWallet" ADD CONSTRAINT "CashWallet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Cash ledger
CREATE TABLE "CashTransaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "amountBdt" DECIMAL(14,2) NOT NULL,
    "balanceAfter" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "reference" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    CONSTRAINT "CashTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CashTransaction_tenantId_occurredAt_idx" ON "CashTransaction"("tenantId", "occurredAt");
CREATE INDEX "CashTransaction_walletId_idx" ON "CashTransaction"("walletId");
CREATE INDEX "CashTransaction_typeId_idx" ON "CashTransaction"("typeId");
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "CashWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "WalletTxnTypeLookup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Salary payments
CREATE TABLE "SalaryPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountBdt" DECIMAL(12,2) NOT NULL,
    "periodLabel" TEXT,
    "note" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cashTransactionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    CONSTRAINT "SalaryPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalaryPayment_cashTransactionId_key" ON "SalaryPayment"("cashTransactionId");
CREATE INDEX "SalaryPayment_tenantId_paidAt_idx" ON "SalaryPayment"("tenantId", "paidAt");
CREATE INDEX "SalaryPayment_userId_idx" ON "SalaryPayment"("userId");
ALTER TABLE "SalaryPayment" ADD CONSTRAINT "SalaryPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalaryPayment" ADD CONSTRAINT "SalaryPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalaryPayment" ADD CONSTRAINT "SalaryPayment_cashTransactionId_fkey" FOREIGN KEY ("cashTransactionId") REFERENCES "CashTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sales (wallet credit)
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "buyerId" TEXT,
    "buyerName" TEXT,
    "amountBdt" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cashTransactionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Sale_cashTransactionId_key" ON "Sale"("cashTransactionId");
CREATE INDEX "Sale_tenantId_soldAt_idx" ON "Sale"("tenantId", "soldAt");
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cashTransactionId_fkey" FOREIGN KEY ("cashTransactionId") REFERENCES "CashTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Material purchases (wallet debit)
CREATE TABLE "MaterialPurchase" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierName" TEXT,
    "materialName" TEXT NOT NULL,
    "amountBdt" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cashTransactionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    CONSTRAINT "MaterialPurchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MaterialPurchase_cashTransactionId_key" ON "MaterialPurchase"("cashTransactionId");
CREATE INDEX "MaterialPurchase_tenantId_purchasedAt_idx" ON "MaterialPurchase"("tenantId", "purchasedAt");
ALTER TABLE "MaterialPurchase" ADD CONSTRAINT "MaterialPurchase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaterialPurchase" ADD CONSTRAINT "MaterialPurchase_cashTransactionId_fkey" FOREIGN KEY ("cashTransactionId") REFERENCES "CashTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
