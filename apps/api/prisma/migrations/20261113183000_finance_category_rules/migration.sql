ALTER TABLE "FinanceTransaction" ADD COLUMN "bankDescription" TEXT NOT NULL DEFAULT '';
CREATE TABLE "FinanceCategoryRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "merchantKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL DEFAULT -1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinanceCategoryRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Admin" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FinanceCategoryRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinanceCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FinanceCategoryRule_userId_merchantKey_kind_amountCents_key" ON "FinanceCategoryRule"("userId", "merchantKey", "kind", "amountCents");
CREATE INDEX "FinanceCategoryRule_userId_kind_idx" ON "FinanceCategoryRule"("userId", "kind");
