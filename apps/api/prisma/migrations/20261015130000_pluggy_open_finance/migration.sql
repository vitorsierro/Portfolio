ALTER TABLE "FinanceTransaction" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "FinanceTransaction" ADD COLUMN "pluggyTransactionId" TEXT;

CREATE UNIQUE INDEX "FinanceTransaction_userId_pluggyTransactionId_key" ON "FinanceTransaction"("userId", "pluggyTransactionId");

CREATE TABLE "PluggyConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PluggyConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Admin" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PluggyConnection_itemId_key" ON "PluggyConnection"("itemId");
CREATE INDEX "PluggyConnection_userId_idx" ON "PluggyConnection"("userId");
