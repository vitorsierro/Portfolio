import { FinanceSyncScheduler } from "./finance-sync.scheduler";

describe("FinanceSyncScheduler", () => {
  it("synchronizes each connected user hourly and continues after a user's failure", async () => {
    const prisma = {
      pluggyConnection: {
        findMany: jest.fn().mockResolvedValue([
          { userId: "admin-1" },
          { userId: "admin-2" },
        ]),
      },
    };
    const pluggy = {
      syncUserConnections: jest
        .fn()
        .mockResolvedValueOnce({ syncedConnections: 1 })
        .mockRejectedValueOnce(new Error("provider unavailable")),
    };
    const scheduler = new FinanceSyncScheduler(prisma as never, pluggy as never);
    const logger = (scheduler as unknown as { logger: { warn: (message: string) => void } }).logger;
    const warn = jest.spyOn(logger, "warn").mockImplementation();

    await scheduler.syncHourly();

    expect(prisma.pluggyConnection.findMany).toHaveBeenCalledWith({
      distinct: ["userId"],
      select: { userId: true },
    });
    expect(pluggy.syncUserConnections).toHaveBeenNthCalledWith(1, "admin-1", true);
    expect(pluggy.syncUserConnections).toHaveBeenNthCalledWith(2, "admin-2", true);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
