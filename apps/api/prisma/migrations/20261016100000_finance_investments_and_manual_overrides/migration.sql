ALTER TABLE "FinanceTransaction" ADD COLUMN "descriptionEdited" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FinanceTransaction" ADD COLUMN "amountEdited" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FinanceTransaction" ADD COLUMN "categoryEdited" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "FinanceInvestment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Outros',
    "acquiredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinanceInvestment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Admin" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "FinanceInvestment_userId_acquiredAt_idx" ON "FinanceInvestment"("userId", "acquiredAt");
CREATE INDEX "FinanceInvestment_userId_category_idx" ON "FinanceInvestment"("userId", "category");
