-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "managerId" TEXT;

-- CreateIndex
CREATE INDEX "Branch_managerId_idx" ON "Branch"("managerId");

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
