ALTER TABLE "FinanceTransaction" ADD COLUMN "ownTransfer" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FinanceTransaction" ADD COLUMN "ownTransferChecked" BOOLEAN NOT NULL DEFAULT false;
