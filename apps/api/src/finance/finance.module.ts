import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { FinanceController } from "./finance.controller";
import { FinanceService } from "./finance.service";
import { FinanceSyncScheduler } from "./finance-sync.scheduler";
import { PluggyService } from "./pluggy.service";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [FinanceController],
  providers: [FinanceService, PluggyService, FinanceSyncScheduler],
})
export class FinanceModule {}
