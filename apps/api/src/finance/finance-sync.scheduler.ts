import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { PluggyService } from "./pluggy.service";

@Injectable()
export class FinanceSyncScheduler {
  private readonly logger = new Logger(FinanceSyncScheduler.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pluggy: PluggyService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async syncHourly() {
    if (this.running) return;
    this.running = true;
    try {
      const connections = await this.prisma.pluggyConnection.findMany({
        distinct: ["userId"],
        select: { userId: true },
      });
      for (const { userId } of connections) {
        try {
          await this.pluggy.syncUserConnections(userId, true);
        } catch {
          this.logger.warn("Hourly Open Finance sync failed for one user");
        }
      }
    } catch {
      this.logger.error("Unable to load accounts for hourly Open Finance sync");
    } finally {
      this.running = false;
    }
  }
}
