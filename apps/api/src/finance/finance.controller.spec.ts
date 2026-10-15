import { Test, TestingModule } from "@nestjs/testing";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { FinanceController } from "./finance.controller";
import { FinanceService } from "./finance.service";

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
  };
  const request = {
    user: { sub: "admin-1", email: "admin@example.com" },
  } as never;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinanceController],
      providers: [{ provide: FinanceService, useValue: financeService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(FinanceController);
  });

  it("scopes dashboard overview to the authenticated admin", async () => {
    financeService.getOverview.mockResolvedValue({ month: "2026-06" });
    await expect(
      controller.getOverview(request, { month: "2026-06" }),
    ).resolves.toEqual({ month: "2026-06" });
    expect(financeService.getOverview).toHaveBeenCalledWith(
      "admin-1",
      "2026-06",
    );
  });
});
