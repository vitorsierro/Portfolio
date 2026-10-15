import {
  ForbiddenException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { PluggyService } from "./pluggy.service";

describe("PluggyService", () => {
  it("creates a short-lived Connect token scoped to the authenticated user", async () => {
    const client = {
      createConnectToken: jest.fn().mockResolvedValue({
        accessToken: "widget-token",
      }),
    };
    const service = new PluggyService({} as never, () => client as never);

    await expect(service.createConnectToken("admin-1")).resolves.toBe(
      "widget-token",
    );
    expect(client.createConnectToken).toHaveBeenCalledWith(undefined, {
      clientUserId: "admin-1",
      avoidDuplicates: true,
    });
  });

  it("returns unavailable when server credentials are not configured", async () => {
    const originalClientId = process.env.PLUGGY_CLIENT_ID;
    const originalClientSecret = process.env.PLUGGY_CLIENT_SECRET;
    delete process.env.PLUGGY_CLIENT_ID;
    delete process.env.PLUGGY_CLIENT_SECRET;
    const service = new PluggyService({} as never);

    try {
      await expect(
        service.createConnectToken("admin-1"),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    } finally {
      if (originalClientId === undefined) delete process.env.PLUGGY_CLIENT_ID;
      else process.env.PLUGGY_CLIENT_ID = originalClientId;
      if (originalClientSecret === undefined)
        delete process.env.PLUGGY_CLIENT_SECRET;
      else process.env.PLUGGY_CLIENT_SECRET = originalClientSecret;
    }
  });

  it("rejects an item created for a different authenticated user", async () => {
    const client = {
      fetchItem: jest.fn().mockResolvedValue({
        id: "foreign-item",
        clientUserId: "other-admin",
        connector: { name: "Banco" },
        status: "UPDATED",
      }),
    };
    const prisma = { pluggyConnection: { upsert: jest.fn() } };
    const service = new PluggyService(prisma as never, () => client as never);

    await expect(
      service.registerConnection("admin-1", "foreign-item"),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.pluggyConnection.upsert).not.toHaveBeenCalled();
  });

  it("stores a Pluggy item only after verifying its clientUserId", async () => {
    const client = {
      fetchItem: jest.fn().mockResolvedValue({
        id: "item-1",
        clientUserId: "admin-1",
        connector: { name: "Banco Exemplo" },
        status: "UPDATED",
      }),
    };
    const prisma = {
      pluggyConnection: {
        upsert: jest.fn().mockResolvedValue({ id: "connection-1" }),
      },
    };
    const service = new PluggyService(prisma as never, () => client as never);

    await expect(
      service.registerConnection("admin-1", "item-1"),
    ).resolves.toEqual({ id: "connection-1" });
    expect(prisma.pluggyConnection.upsert).toHaveBeenCalledWith({
      where: { itemId: "item-1" },
      create: {
        userId: "admin-1",
        itemId: "item-1",
        institutionName: "Banco Exemplo",
        status: "UPDATED",
      },
      update: { institutionName: "Banco Exemplo", status: "UPDATED" },
    });
  });

  it("imports BRL transactions but excludes credit-card bill payments", async () => {
    const occurredAt = new Date("2026-10-15T12:00:00.000Z");
    const client = {
      fetchItem: jest.fn().mockResolvedValue({
        id: "item-1",
        clientUserId: "admin-1",
        connector: { name: "Banco Exemplo" },
        status: "UPDATED",
      }),
      fetchAccounts: jest.fn().mockResolvedValue({
        results: [
          {
            id: "account-1",
            type: "BANK",
            name: "Conta corrente",
            currencyCode: "BRL",
          },
          {
            id: "account-card",
            type: "CREDIT",
            name: "Cartão",
            currencyCode: "BRL",
          },
        ],
      }),
      fetchAllTransactions: jest.fn().mockImplementation(async (accountId) =>
        accountId === "account-1"
          ? [
              {
                id: "transaction-1",
                date: occurredAt,
                description: "Mercado",
                amount: 123.45,
                type: "DEBIT",
                category: "Alimentação",
                status: "POSTED",
              },
            ]
          : [
              {
                id: "card-payment",
                date: occurredAt,
                description: "Pagamento da fatura",
                amount: -123.45,
                type: "CREDIT",
                operationType: "PAGAMENTO_FATURA",
                category: null,
              },
              {
                id: "card-purchase",
                date: occurredAt,
                description: "Compra no cartão",
                amount: 20,
                type: "DEBIT",
                operationType: "OUTROS",
                category: "Compras",
              },
            ],
      ),
    };
    const prisma = {
      pluggyConnection: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "connection-1",
            itemId: "item-1",
            lastSyncedAt: null,
          },
        ]),
        update: jest.fn(),
      },
      financeCategory: {
        upsert: jest.fn().mockResolvedValue({ id: "category-1" }),
      },
      financeTransaction: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new PluggyService(prisma as never, () => client as never);

    await expect(service.syncUserConnections("admin-1", true)).resolves.toMatchObject({
      connections: 1,
      importedTransactions: 2,
    });
    expect(prisma.financeTransaction.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_pluggyTransactionId: {
            userId: "admin-1",
            pluggyTransactionId: "transaction-1",
          },
        },
        create: expect.objectContaining({
          userId: "admin-1",
          source: "pluggy",
          amountCents: 12345,
          kind: "expense",
          accountName: "Conta corrente",
          categoryId: "category-1",
          occurredAt,
        }),
      }),
    );
    expect(prisma.financeTransaction.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_pluggyTransactionId: {
            userId: "admin-1",
            pluggyTransactionId: "card-purchase",
          },
        },
        create: expect.objectContaining({ kind: "expense", amountCents: 2000 }),
      }),
    );
    expect(prisma.financeTransaction.upsert).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_pluggyTransactionId: {
            userId: "admin-1",
            pluggyTransactionId: "card-payment",
          },
        },
      }),
    );
  });
});
