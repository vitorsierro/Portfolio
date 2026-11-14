import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { FinanceService } from "./finance.service";
import { PluggyService } from "./pluggy.service";

describe("sincronização financeira com SQLite real", () => {
  let directory: string;
  let prisma: PrismaClient;
  let userId: string;
  const date = new Date();
  const month = date.toISOString().slice(0, 7);
  const client = {
    fetchItem: jest.fn(), fetchAccounts: jest.fn(), fetchAllTransactions: jest.fn(),
  };
  let service: PluggyService;
  let finance: FinanceService;

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), "portfolio-finance-"));
    // Prisma's SQLite schema engine on Windows needs an existing file here.
    writeFileSync(join(directory, "test.db"), "");
    const url = `file:${join(directory, "test.db").replace(/\\/g, "/")}`;
    execFileSync(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "deploy"], {
      cwd: resolve(__dirname, "../.."), env: { ...process.env, DATABASE_URL: url }, stdio: "pipe",
    });
    prisma = new PrismaClient({ datasources: { db: { url } } });
    const admin = await prisma.admin.create({ data: { email: "finance@test.local", passwordHash: "test-only" } });
    userId = admin.id;
    service = new PluggyService(prisma as never, () => client as never);
    finance = new FinanceService(prisma as never);
  }, 30_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    if (directory && resolve(directory).startsWith(resolve(tmpdir(), "portfolio-finance-"))) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("classifica histórico antigo sem Pluggy e mantém lançamentos manuais", async () => {
    const data = { userId, description: "PIX recebido Vitor Hugo de Souza Sierro", amountCents: 1000,
      kind: "income", occurredAt: new Date("2020-01-01T12:00:00Z") };
    await prisma.financeTransaction.create({ data: { ...data, source: "pluggy", pluggyTransactionId: "old-pix" } });
    await prisma.financeTransaction.create({ data });
    await service.syncUserConnections(userId);
    const rows = await prisma.financeTransaction.findMany({ orderBy: { source: "asc" } });
    expect(rows.map((row) => [row.source, row.ownTransfer])).toEqual([["manual", false], ["pluggy", true]]);
    expect(client.fetchItem).not.toHaveBeenCalled();
  });

  it("sincroniza quatro conexões repetidamente sem duplicar ou apagar pagamentos parecidos", async () => {
    for (let index = 0; index < 4; index++) {
      await prisma.pluggyConnection.create({ data: { userId, itemId: `item-${index}`, institutionName: "Banco", status: "UPDATED" } });
    }
    client.fetchItem.mockImplementation(async (id: string) => ({ id, clientUserId: userId, status: "UPDATED" }));
    client.fetchAccounts.mockImplementation(async (id: string) => ({ results: [{ id, type: "BANK", name: "Conta corrente", currencyCode: "BRL" }] }));
    client.fetchAllTransactions.mockImplementation(async (id: string) => [
      { id: `${id}-purchase-a`, description: "Compra", date, amount: 10, type: "DEBIT" },
      { id: `${id}-purchase-b`, description: "Compra", date, amount: 10, type: "DEBIT" },
      { id: `${id}-own-out`, description: "Transferência", date, amount: 20, type: "DEBIT",
        paymentData: { paymentMethod: "PIX", receiver: { name: "Vitor Hugo de Souza Sierro" } } },
      { id: `${id}-own-in`, description: "Transferência", date, amount: 20, type: "CREDIT",
        paymentData: { paymentMethod: "PIX", payer: { name: "Vitor Hugo de Souza Sierro" } } },
      { id: `${id}-third-party`, description: "Pix Vitor Hugo de Souza Sierro", date, amount: 30, type: "CREDIT",
        paymentData: { paymentMethod: "PIX", payer: { name: "Maria" }, receiver: { name: "Vitor Hugo de Souza Sierro" } } },
    ]);
    await expect(service.syncUserConnections(userId, true)).resolves.toMatchObject({ connections: 4, syncedConnections: 4 });
    const edited = await prisma.financeTransaction.findFirstOrThrow({ where: { pluggyTransactionId: "item-0-purchase-a" } });
    await finance.updateTransaction(userId, edited.id, { description: "Compra corrigida", amountCents: 1500 });
    await service.syncUserConnections(userId, true);
    expect(await prisma.financeTransaction.count()).toBe(22); // 20 imported + 2 legacy rows
    const list = await finance.listTransactions(userId, { month });
    expect(list.total).toBe(12);
    expect(list.items.every((row) => !row.ownTransfer)).toBe(true);
    expect(list.totalExpenseAmountCents).toBe(8500);
    expect(await prisma.financeTransaction.findUniqueOrThrow({ where: { id: edited.id } }))
      .toMatchObject({ description: "Compra corrigida", amountCents: 1500 });
    const overview = await finance.getOverview(userId, month);
    expect(overview.totals).toMatchObject({ expensesCents: 8500, incomeCents: 12000, balanceCents: 3500 });
    const annual = await finance.getAnnualCategorySummary(userId, date.getUTCFullYear(), date.getUTCFullYear());
    expect(annual.categories.flatMap((category) => category.totals)
      .reduce((sum, item) => sum + item.amountCents, 0)).toBe(8500);
  });

  it("compartilha a execução simultânea e libera a trava após falha", async () => {
    client.fetchItem.mockRejectedValueOnce(new Error("Pluggy indisponível"));
    const first = service.syncUserConnections(userId, true);
    const second = service.syncUserConnections(userId, true);
    expect(second).toBe(first);
    await expect(first).rejects.toThrow("Pluggy indisponível");
    await expect(service.syncUserConnections(userId, true)).resolves.toMatchObject({ syncedConnections: 4 });
  });

  it("aprende categoria no SQLite e reaplica após reiniciar o serviço", async () => {
    const category = await prisma.financeCategory.create({ data: { userId, name: "Compras — Casa e utilidades" } });
    const row = await prisma.financeTransaction.create({ data: { userId, description: "Loja Central 1/3",
      bankDescription: "Loja Central 1/3", kind: "expense", amountCents: 1500, occurredAt: date,
      source: "pluggy", pluggyTransactionId: "learned-first" } });
    await finance.updateTransaction(userId, row.id, { categoryId: category.id });
    expect(await prisma.financeCategoryRule.findFirst({ where: { userId } }))
      .toMatchObject({ merchantKey: "loja central", categoryId: category.id, amountCents: -1 });
    client.fetchAllTransactions.mockResolvedValue([{ id: "learned-next", date, description: "LOJA CENTRAL 2/3", amount: 16,
      type: "DEBIT", currencyCode: "BRL", category: "Shopping" }]);
    const restarted = new PluggyService(prisma as never, () => client as never);
    await restarted.syncUserConnections(userId, true);
    expect(await prisma.financeTransaction.findFirst({ where: { pluggyTransactionId: "learned-next" } }))
      .toMatchObject({ categoryId: category.id, categoryEdited: false, bankDescription: "LOJA CENTRAL 2/3" });
    await finance.updateTransaction(userId, row.id, { categoryId: null });
    expect(await prisma.financeCategoryRule.count({ where: { userId } })).toBe(0);
  });

  it("importa resgates e salário na categoria correta e calcula investimento líquido", async () => {
    client.fetchAllTransactions.mockResolvedValue([
      { id: "net-application", date, description: "Aplicação RDB", amount: -500, type: "DEBIT", category: "Investments" },
      { id: "net-redemption", date, description: "Resgate RDB", amount: 300, type: "CREDIT", category: "Other" },
      { id: "payroll-not-investment", date, description: "Salário SMR PARTICIPACOES E INVESTIMENTOS SA", amount: 2000, type: "CREDIT", category: "Investments" },
    ]);
    await service.syncUserConnections(userId, true);
    const salary = await prisma.financeTransaction.findFirstOrThrow({ where: { pluggyTransactionId: "payroll-not-investment" }, include: { category: true } });
    expect(salary.category?.name).toBe("Salário");
    const summary = await finance.getAnnualCategorySummary(userId, date.getUTCFullYear(), date.getUTCFullYear());
    expect(summary.categories.find((category) => category.name === "Investimentos"))
      .toMatchObject({ calculation: "net-investment-flow", totals: [{ year: date.getUTCFullYear(), amountCents: 20000, applicationsCents: 50000, withdrawalsCents: 30000 }] });
  });
});
