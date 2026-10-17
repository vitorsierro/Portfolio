import { Test, TestingModule } from "@nestjs/testing";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { FinanceController } from "./finance.controller";
import { FinanceService } from "./finance.service";
import { PluggyService } from "./pluggy.service";

describe("FinanceController", () => {
  let controller: FinanceController;
  const financeService = {
    getOverview: jest.fn(),
    listTransactions: jest.fn(),
    createTransaction: jest.fn(),
    updateTransaction: jest.fn(),
    removeTransaction: jest.fn(),
    listCategories: jest.fn(),
    createCategory: jest.fn(),
    listInvestments: jest.fn(),
    createInvestment: jest.fn(),
    updateInvestment: jest.fn(),
    removeInvestment: jest.fn(),
  };
  const pluggyService = {
    createConnectToken: jest.fn(),
    syncUserConnections: jest.fn(),
  };
  const request = {
    user: { sub: "admin-1", email: "admin@example.com" },
  } as never;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinanceController],
      providers: [
        { provide: FinanceService, useValue: financeService },
        { provide: PluggyService, useValue: pluggyService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(FinanceController);
  });

  it("scopes Connect token creation to the authenticated admin", async () => {
    pluggyService.createConnectToken.mockResolvedValue("widget-token");

    await expect(controller.getPluggyConnectToken(request)).resolves.toEqual({
      accessToken: "widget-token",
    });
    expect(pluggyService.createConnectToken).toHaveBeenCalledWith("admin-1");
  });

  it("scopes dashboard overview to the authenticated admin", async () => {
    financeService.getOverview.mockResolvedValue({ month: "2026-06" });
    pluggyService.syncUserConnections.mockResolvedValue({ connections: 0 });
    await expect(
      controller.getOverview(request, { month: "2026-06" }),
    ).resolves.toEqual({
      month: "2026-06",
      pluggySyncUnavailable: false,
    });
    expect(financeService.getOverview).toHaveBeenCalledWith(
      "admin-1",
      "2026-06",
    );
    expect(pluggyService.syncUserConnections).toHaveBeenCalledWith("admin-1");
  });

  it("returns cached transactions when Pluggy is temporarily unavailable", async () => {
    const page = { items: [{ id: "tx-1" }], total: 1, page: 1, limit: 20, totalPages: 1 };
    financeService.listTransactions.mockResolvedValue(page);
    pluggyService.syncUserConnections.mockRejectedValue(new Error("offline"));

    await expect(controller.listTransactions(request, {})).resolves.toEqual({
      ...page,
      pluggySyncUnavailable: true,
    });
    expect(financeService.listTransactions).toHaveBeenCalledWith("admin-1", {
      month: undefined,
      kind: undefined,
      categoryId: undefined,
      search: undefined,
      page: 1,
      limit: 20,
    });
  });

  it("returns cached overview data when Pluggy is temporarily unavailable", async () => {
    financeService.getOverview.mockResolvedValue({ month: "2026-06" });
    pluggyService.syncUserConnections.mockRejectedValue(new Error("offline"));

    await expect(
      controller.getOverview(request, { month: "2026-06" }),
    ).resolves.toEqual({
      month: "2026-06",
      pluggySyncUnavailable: true,
    });
    expect(financeService.getOverview).toHaveBeenCalledWith(
      "admin-1",
      "2026-06",
    );
  });

});
