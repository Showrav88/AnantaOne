-- Supplier contact on material purchases
ALTER TABLE "MaterialPurchase" ADD COLUMN "supplierPhone" TEXT;

-- Expense categories (utility, family, lawsuit, gesture, other)
CREATE TABLE "ExpenseCategoryLookup" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExpenseCategoryLookup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExpenseCategoryLookup_code_key" ON "ExpenseCategoryLookup"("code");

INSERT INTO "ExpenseCategoryLookup" ("id","code","nameEn","nameBn","description","sortOrder","isActive","createdAt","updatedAt") VALUES
('expcat_utility','UTILITY','Utility bill','ইউটিলিটি বিল','Electricity, gas, water, internet',1,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('expcat_family','FAMILY','Family expense','পারিবারিক খরচ','Family-related cash out',2,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('expcat_lawsuit','LAWSUIT','Lawsuit / legal','মামলা / আইনি','Legal fees and case costs',3,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('expcat_gesture','GESTURE','Gesture / goodwill','সৌজন্য / উপহার','Gifts, hospitality, goodwill',4,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('expcat_other','OTHER','Other expense','অন্যান্য খরচ','Misc company expense',5,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

-- Wallet debit types for utility + general expense
INSERT INTO "WalletTxnTypeLookup" ("id","code","nameEn","nameBn","direction","description","sortOrder","isActive","createdAt","updatedAt") VALUES
('wtxn_utility','UTILITY','Utility bill','ইউটিলিটি বিল','debit','Electricity, gas, water, internet',9,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('wtxn_expense','EXPENSE','Other expense','অন্যান্য খরচ','debit','Family, lawsuit, gesture, and other cash out',10,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Cash expenses (utility + other) — auto-debit wallet
CREATE TABLE "CashExpense" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amountBdt" DECIMAL(14,2) NOT NULL,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cashTransactionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    CONSTRAINT "CashExpense_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CashExpense_cashTransactionId_key" ON "CashExpense"("cashTransactionId");
CREATE INDEX "CashExpense_tenantId_occurredAt_idx" ON "CashExpense"("tenantId", "occurredAt");
CREATE INDEX "CashExpense_categoryId_idx" ON "CashExpense"("categoryId");

ALTER TABLE "CashExpense" ADD CONSTRAINT "CashExpense_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashExpense" ADD CONSTRAINT "CashExpense_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategoryLookup"("id") ON UPDATE CASCADE;
ALTER TABLE "CashExpense" ADD CONSTRAINT "CashExpense_cashTransactionId_fkey"
  FOREIGN KEY ("cashTransactionId") REFERENCES "CashTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
