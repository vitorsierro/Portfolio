import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { FinanceService } from "./finance.service";

describe("FinanceService", () => {
  const transactions = [
    {
      id: "expense-a",
      amountCents: 12500,
      kind: "expense",
      category: { id: "food", name: "Alimentação", color: "#f97316" },
      occurredAt: new Date("2026-06-04T12:00:00Z"),
      description: "Mercado",
    },
    {
      id: "expense-b",
      amountCents: 3500,
      kind: "expense",
      category: { id: "food", name: "Alimentação", color: "#f97316" },
      occurredAt: new Date("2026-06-20T12:00:00Z"),
      description: "Feira",
    },
    {
      id: "income-a",
      amountCents: 500000,
      kind: "income",
      category: { id: "salary", name: "Salário", color: "#22c55e" },
      occurredAt: new Date("2026-06-01T12:00:00Z"),
      description: "Salário",
    },
    {
      id: "previous-a",
      amountCents: 12000,
      kind: "expense",
      category: { id: "housing", name: "Moradia", color: "#2563eb" },
      occurredAt: new Date("2026-05-20T12:00:00Z"),
      description: "Aluguel",
    },
  ];
  const makeService = () => {
    const prisma = {
      financeTransaction: {
        findMany: jest.fn().mockResolvedValue(transactions),
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amountCents: 16000 } }),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      financeCategory: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      financeInvestment: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amountCents: 250000 } }),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn((operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
    };
    return { service: new FinanceService(prisma as never), prisma };
  };

  it("calculates monthly totals, daily spend and category totals for the authenticated admin", async () => {
    const { service, prisma } = makeService();
    await expect(
      service.getOverview("admin-1", "2026-06"),
    ).resolves.toMatchObject({
      month: "2026-06",
      totals: {
        expensesCents: 16000,
        incomeCents: 500000,
        balanceCents: 484000,
        previousExpensesCents: 12000,
      },
      categories: [
        {
          id: "food",
          name: "Alimentação",
          amountCents: 16000,
          color: "#f97316",
          count: 2,
        },
      ],
      daily: expect.arrayContaining([
        { day: 4, expensesCents: 12500 },
        { day: 20, expensesCents: 3500 },
      ]),
      recentTransactions: expect.arrayContaining([
        expect.objectContaining({ id: "expense-a", description: "Mercado" }),
      ]),
    });
    expect(prisma.financeTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "admin-1" }),
      }),
    );
  });

  it("rejects impossible calendar dates instead of normalizing them into another month", async () => {
    const { service, prisma } = makeService();
    await expect(
      service.createTransaction("admin-1", {
        description: "Data inválida",
        amountCents: 100,
        kind: "expense",
        occurredAt: "2026-02-31",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.financeTransaction.create).not.toHaveBeenCalled();
  });

  it("rejects attaching a category owned by another admin", async () => {
    const { service, prisma } = makeService();
    prisma.financeCategory.findFirst.mockResolvedValue(null);
    await expect(
      service.createTransaction("admin-1", {
        description: "Private",
        amountCents: 100,
        kind: "expense",
        occurredAt: "2026-06-01",
        categoryId: "foreign-category",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.financeCategory.findFirst).toHaveBeenCalledWith({
      where: { id: "foreign-category", userId: "admin-1" },
    });
    expect(prisma.financeTransaction.create).not.toHaveBeenCalled();
  });

  it("filters transactions by the selected user and month", async () => {
    const { service, prisma } = makeService();
    const result = await service.listTransactions("admin-1", {
      month: "2026-06",
      kind: "expense",
      categoryId: "food",
      page: 2,
      limit: 10,
    });
    expect(result.totalAmountCents).toBe(16000);
    expect(prisma.financeTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "admin-1", kind: "expense", categoryId: "food" }),
        skip: 10,
        take: 10,
      }),
    );
    expect(prisma.financeTransaction.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "admin-1", kind: "expense" }),
      }),
    );
  });

  it("reports category expense totals without including income rows", async () => {
    const { service, prisma } = makeService();
    const result = await service.listTransactions("admin-1", {
      month: "2026-06",
      categoryId: "food",
      kind: "all",
    });

    expect(result.totalExpenseAmountCents).toBe(16000);
    expect(prisma.financeTransaction.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "admin-1",
          categoryId: "food",
          kind: "expense",
        }),
      }),
    );
  });

  it("allows editing the description, amount, and category of Pluggy transactions", async () => {
    const { service, prisma } = makeService();
    prisma.financeTransaction.findFirst.mockResolvedValue({
      id: "bank-tx",
      userId: "admin-1",
      source: "pluggy",
      description: "Mercado",
      amountCents: 1000,
      kind: "expense",
      occurredAt: new Date("2026-06-01T12:00:00.000Z"),
    });
    prisma.financeCategory.findFirst.mockResolvedValue({ id: "food" });
    prisma.financeTransaction.update.mockResolvedValue({ id: "bank-tx" });

    await service.updateTransaction("admin-1", "bank-tx", {
      description: "Mercado municipal",
      amountCents: 1250,
      categoryId: "food",
    });

    expect(prisma.financeTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "bank-tx" },
        data: expect.objectContaining({
          description: "Mercado municipal",
          amountCents: 1250,
          categoryId: "food",
          descriptionEdited: true,
          amountEdited: true,
          categoryEdited: true,
        }),
      }),
    );
  });

  it("creates a new investment with Portuguese category and authenticated ownership", async () => {
    const { service, prisma } = makeService();
    prisma.financeInvestment.create.mockResolvedValue({ id: "investment-1" });

    await expect(
      service.createInvestment("admin-1", {
        name: "Tesouro Selic",
        amountCents: 250000,
        category: "Fixed income",
        acquiredAt: "2026-06-01",
      }),
    ).resolves.toEqual({ id: "investment-1" });
    expect(prisma.financeInvestment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "admin-1",
        name: "Tesouro Selic",
        amountCents: 250000,
        category: "Renda fixa",
        acquiredAt: new Date("2026-06-01T12:00:00.000Z"),
      }),
    });
  });

  it("returns investment totals scoped to the authenticated user", async () => {
    const { service, prisma } = makeService();
    const result = await service.listInvestments("admin-1", {
      category: "Renda fixa",
      page: 1,
      limit: 20,
    });

    expect(result.totalAmountCents).toBe(250000);
    expect(prisma.financeInvestment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "admin-1", category: "Renda fixa" },
      }),
    );
  });

  it("updates and removes only investments owned by the authenticated user", async () => {
    const { service, prisma } = makeService();
    prisma.financeInvestment.findFirst.mockResolvedValue({
      id: "investment-1",
      userId: "admin-1",
      name: "CDB",
      amountCents: 100000,
      category: "Renda fixa",
      acquiredAt: new Date("2026-06-01T12:00:00.000Z"),
    });
    prisma.financeInvestment.update.mockResolvedValue({ id: "investment-1" });
    prisma.financeInvestment.deleteMany.mockResolvedValue({ count: 1 });

    await service.updateInvestment("admin-1", "investment-1", {
      name: "CDB liquidez diária",
      amountCents: 110000,
      category: "Tesouro Direto",
    });
    expect(prisma.financeInvestment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "investment-1" },
        data: expect.objectContaining({
          name: "CDB liquidez diária",
          amountCents: 110000,
          category: "Tesouro Direto",
        }),
      }),
    );

    await expect(
      service.removeInvestment("admin-1", "investment-1"),
    ).resolves.toEqual({ success: true });
    expect(prisma.financeInvestment.deleteMany).toHaveBeenCalledWith({
      where: { id: "investment-1", userId: "admin-1" },
    });
  });

  it("prevents deleting Pluggy-imported transactions", async () => {
    const { service, prisma } = makeService();
    prisma.financeTransaction.findFirst.mockResolvedValue({
      id: "bank-tx",
      userId: "admin-1",
      source: "pluggy",
    });

    await expect(
      service.removeTransaction("admin-1", "bank-tx"),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.financeTransaction.deleteMany).not.toHaveBeenCalled();
  });
});
