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

  it("aplica o ano completo à lista, contagem e agregados", async () => {
    const category = await prisma.financeCategory.create({ data: { userId, name: "Compras — Teste do período" } });
    for (const [occurredAt, amountCents] of [
      ["2024-12-31T23:59:59.999Z", 100], ["2025-01-01T00:00:00.000Z", 200],
      ["2025-12-31T23:59:59.999Z", 300], ["2026-01-01T00:00:00.000Z", 400],
    ] as const) {
      await prisma.financeTransaction.create({ data: { userId, categoryId: category.id,
        description: "Teste de período", kind: "expense", amountCents, occurredAt: new Date(occurredAt) } });
    }
    const result = await finance.listTransactions(userId, { year: "2025", month: "2026-01", categoryId: category.id });
    expect(result.total).toBe(2);
    expect(result.totalAmountCents).toBe(500);
    expect(result.totalExpenseAmountCents).toBe(500);
    expect(result.items.map((row) => row.amountCents).sort()).toEqual([200, 300]);
  });

  it("preserva repasses excluídos no histórico sem afetar receitas, despesas ou gráficos", async () => {
    const category = await prisma.financeCategory.create({ data: { userId, name: "Clínica — Pai", excludedFromTotals: true } });
    const before = await finance.getOverview(userId, month);
    const beforeList = await finance.listTransactions(userId, { month: "all" });
    const examples = [
      { id: "clinic-in", description: "Transferência Recebida|LAURA DE SOUZA SIERRO", type: "CREDIT", kind: "income" },
      { id: "clinic-out", description: "Pagamento efetuado|J L PEREIRA JUNIOR", type: "DEBIT", kind: "expense" },
    ];
    for (const example of examples) {
      const row = await prisma.financeTransaction.create({ data: { userId, source: "pluggy", description: example.description,
        bankDescription: example.description, amountCents: 170000, kind: example.kind, occurredAt: date, pluggyTransactionId: example.id } });
      await finance.updateTransaction(userId, row.id, { categoryId: category.id });
    }
    client.fetchAllTransactions.mockResolvedValue(examples.map((example) => ({
      id: `${example.id}-next`, description: example.description, date, amount: 1700, type: example.type, category: "Transfers",
    })));
    await service.syncUserConnections(userId, true);
    const after = await finance.getOverview(userId, month);
    expect(after.totals).toEqual(before.totals);
    expect(after.recentTransactions.some((row) => row.categoryId === category.id)).toBe(false);
    const afterList = await finance.listTransactions(userId, { month: "all" });
    expect(afterList.total).toBe(beforeList.total + 4);
    expect(afterList.totalAmountCents).toBe(beforeList.totalAmountCents);
    expect(afterList.totalExpenseAmountCents).toBe(beforeList.totalExpenseAmountCents);
    const clinic = await finance.listTransactions(userId, { month: "all", categoryId: category.id });
    expect(clinic.total).toBe(4);
    expect(clinic.totalAmountCents).toBe(0);
    const annual = await finance.getAnnualCategorySummary(userId, date.getUTCFullYear(), date.getUTCFullYear());
    expect(annual.categories.some((item) => item.id === category.id)).toBe(false);
    expect((await finance.listCategories(userId)).find((item) => item.id === category.id)?.excludedFromTotals).toBe(true);
  });

  it("aplica regra de Pix do Itaú sem alterar categorias ajustadas ou duplicar salário", async () => {
    const salary = await prisma.financeCategory.upsert({ where: { userId_name: { userId, name: "Salário" } }, create: { userId, name: "Salário" }, update: {} });
    const protectedCategory = await prisma.financeCategory.create({ data: { userId, name: "Moradia — Compra do imóvel" } });
    for (const kind of ["income", "expense"]) await prisma.financePixAccountRule.create({ data: { userId, accountName: "itau", kind, categoryId: salary.id, ownTransfer: true } });
    for (const [id, categoryEdited] of [["protected-manual-pix", true], ["protected-known-pix", false]] as const) {
      await prisma.financeTransaction.create({ data: { userId, source: "pluggy", pluggyTransactionId: id, description: "Pix enviado Pix enviado", amountCents: 12345, kind: "expense", occurredAt: date, categoryId: protectedCategory.id, categoryEdited } });
    }
    client.fetchAccounts.mockImplementation(async (id: string) => ({ results: [{ id, type: "BANK", name: id === "item-0" ? "Itaú" : "Outra conta", currencyCode: "BRL" }] }));
    client.fetchAllTransactions.mockImplementation(async (id: string) => id === "item-0" ? [
      { id: "new-itau-income", description: "Pix recebido Pix recebido", type: "CREDIT", amount: 987.65, date },
      { id: "new-itau-expense", description: "Pix enviado Pix enviado", type: "DEBIT", amount: 789, date },
      { id: "protected-manual-pix", description: "Pix enviado Pix enviado", type: "DEBIT", amount: 123.45, date },
      { id: "protected-known-pix", description: "Pix enviado Pix enviado", type: "DEBIT", amount: 123.45, date },
      { id: "real-payroll-itau", description: "Salário SMR PARTICIPACOES E INVESTIMENTOS SA", type: "CREDIT", amount: 5000, date },
    ] : id === "item-1" ? [{ id: "other-account-pix", description: "Pix recebido Pix recebido", type: "CREDIT", amount: 123, date }] : []);
    await new PluggyService(prisma as never, () => client as never).syncUserConnections(userId, true);
    const load = (pluggyTransactionId: string) => prisma.financeTransaction.findFirstOrThrow({ where: { userId, pluggyTransactionId } });
    expect(await load("new-itau-income")).toMatchObject({ categoryId: salary.id, ownTransfer: true, kind: "income" });
    expect(await load("new-itau-expense")).toMatchObject({ categoryId: salary.id, ownTransfer: true, kind: "expense" });
    expect(await load("protected-manual-pix")).toMatchObject({ categoryId: protectedCategory.id, ownTransfer: false });
    expect(await load("protected-known-pix")).toMatchObject({ categoryId: protectedCategory.id, ownTransfer: false });
    expect(await load("real-payroll-itau")).toMatchObject({ categoryId: salary.id, ownTransfer: false });
    expect(await load("other-account-pix")).toMatchObject({ ownTransfer: false });
    expect((await load("other-account-pix")).categoryId).not.toBe(salary.id);
  });

  it("importa novos lançamentos diretamente nas categorias consolidadas", async () => {
    const cases = [
      ["supplements", "Ec *Maxtitanium 4/6", "Transfers", "Compras — Supermercado"],
      ["pharmacy", "Drogaria Sao Paulo", "Pharmacy", "Compras — Supermercado"],
      ["ride", "Uber* Trip", "Taxi and ride-hailing", "Transporte"],
      ["dentist", "Dentista", "Dentist", "Saúde"],
      ["hosting", "Hostinger.Com", "Digital services", "Assinaturas — Software, hospedagem e IA"],
      ["language", "Praktika.Ai", "School", "Assinaturas"],
    ];
    client.fetchAllTransactions.mockImplementation(async (id: string) => id === "item-0" ? cases.map(([key, description, category]) => ({
      id: `consolidated-${key}`, description, category, type: "DEBIT", amount: 10, date,
    })) : []);
    await service.syncUserConnections(userId, true);
    for (const [key, , , category] of cases) {
      const row = await prisma.financeTransaction.findFirstOrThrow({ where: { pluggyTransactionId: `consolidated-${key}` }, include: { category: true } });
      expect(row.category?.name).toBe(category);
    }
  });
});
