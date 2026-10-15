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
    await service.listTransactions("admin-1", {
      month: "2026-06",
      kind: "expense",
      page: 2,
      limit: 10,
    });
    expect(prisma.financeTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "admin-1", kind: "expense" }),
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

  it("prevents editing the bank-sourced fields of Pluggy transactions", async () => {
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

    await expect(
      service.updateTransaction("admin-1", "bank-tx", {
        description: "Alterado manualmente",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.financeTransaction.update).not.toHaveBeenCalled();
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
