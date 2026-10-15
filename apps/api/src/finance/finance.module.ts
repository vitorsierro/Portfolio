import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { FinanceController } from "./finance.controller";
import { FinanceService } from "./finance.service";
import { PluggyService } from "./pluggy.service";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [FinanceController],
  providers: [FinanceService, PluggyService],
})
export class FinanceModule {}
