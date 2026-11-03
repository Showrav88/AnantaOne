-- Salary reverse: credit cash drawer when a salary payment is undone (emergency).
ALTER TABLE "SalaryPayment" ADD COLUMN "reverseReason" TEXT;
ALTER TABLE "SalaryPayment" ADD COLUMN "reversedAt" TIMESTAMP(3);
ALTER TABLE "SalaryPayment" ADD COLUMN "reversedBy" TEXT;
ALTER TABLE "SalaryPayment" ADD COLUMN "reverseCashTransactionId" TEXT;

CREATE UNIQUE INDEX "SalaryPayment_reverseCashTransactionId_key"
  ON "SalaryPayment"("reverseCashTransactionId");

ALTER TABLE "SalaryPayment" ADD CONSTRAINT "SalaryPayment_reverseCashTransactionId_fkey"
  FOREIGN KEY ("reverseCashTransactionId") REFERENCES "CashTransaction"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "WalletTxnTypeLookup" ("id","code","nameEn","nameBn","direction","description","sortOrder","isActive","createdAt","updatedAt") VALUES
('wtxn_salary_rev','SALARY_REVERSE','Salary reverse','বেতন রিভার্স','credit','Credit cash drawer when a salary payment is reversed',12,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
