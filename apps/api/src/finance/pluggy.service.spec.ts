import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
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
      avoidDuplicates: false,
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
    const prisma = { pluggyConnection: { create: jest.fn(), updateMany: jest.fn() } };
    const service = new PluggyService(prisma as never, () => client as never);

    await expect(
      service.registerConnection("admin-1", "foreign-item"),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.pluggyConnection.create).not.toHaveBeenCalled();
    expect(prisma.pluggyConnection.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a database item conflict owned by another user", async () => {
    const client = {
      fetchItem: jest.fn().mockResolvedValue({
        id: "shared-item",
        clientUserId: "admin-1",
        connector: { name: "Banco Exemplo" },
        status: "UPDATED",
      }),
    };
    const prisma = {
      pluggyConnection: {
        findUnique: jest.fn().mockResolvedValue({ userId: "other-admin" }),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
    };
    const service = new PluggyService(prisma as never, () => client as never);

    await expect(
      service.registerConnection("admin-1", "shared-item"),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.pluggyConnection.updateMany).not.toHaveBeenCalled();
    expect(prisma.pluggyConnection.create).not.toHaveBeenCalled();
  });

  it("creates a new connection after verifying its Pluggy owner", async () => {
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
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "connection-1" }),
      },
    };
    const service = new PluggyService(prisma as never, () => client as never);

    await expect(
      service.registerConnection("admin-1", "item-1"),
    ).resolves.toEqual({ id: "connection-1" });
    expect(prisma.pluggyConnection.create).toHaveBeenCalledWith({
      data: {
        userId: "admin-1",
        itemId: "item-1",
        institutionName: "Banco Exemplo",
        status: "UPDATED",
      },
    });
  });

  it("registers separate items from the same institution as distinct connections", async () => {
    const client = {
      fetchItem: jest
        .fn()
        .mockResolvedValueOnce({
          id: "item-1",
          clientUserId: "admin-1",
          connector: { name: "Banco Exemplo" },
          status: "UPDATED",
        })
        .mockResolvedValueOnce({
          id: "item-2",
          clientUserId: "admin-1",
          connector: { name: "Banco Exemplo" },
          status: "UPDATED",
        }),
    };
    const prisma = {
      pluggyConnection: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockResolvedValueOnce({ id: "connection-1" })
          .mockResolvedValueOnce({ id: "connection-2" }),
      },
    };
    const service = new PluggyService(prisma as never, () => client as never);

    await expect(
      service.registerConnection("admin-1", "item-1"),
    ).resolves.toEqual({ id: "connection-1" });
    await expect(
      service.registerConnection("admin-1", "item-2"),
    ).resolves.toEqual({ id: "connection-2" });

    expect(prisma.pluggyConnection.create).toHaveBeenCalledTimes(2);
    expect(prisma.pluggyConnection.create).toHaveBeenNthCalledWith(1, {
      data: {
        userId: "admin-1",
        itemId: "item-1",
        institutionName: "Banco Exemplo",
        status: "UPDATED",
      },
    });
    expect(prisma.pluggyConnection.create).toHaveBeenNthCalledWith(2, {
      data: {
        userId: "admin-1",
        itemId: "item-2",
        institutionName: "Banco Exemplo",
        status: "UPDATED",
      },
    });
  });

  it("updates a registered connection only for its owner", async () => {
    const client = {
      fetchItem: jest.fn().mockResolvedValue({
        id: "item-1",
        clientUserId: "admin-1",
        connector: { name: "Banco Atualizado" },
        status: "UPDATED",
      }),
    };
    const connection = { id: "connection-1", userId: "admin-1" };
    const prisma = {
      pluggyConnection: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ userId: "admin-1" })
          .mockResolvedValueOnce(connection),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new PluggyService(prisma as never, () => client as never);

    await expect(service.registerConnection("admin-1", "item-1")).resolves.toEqual(connection);
    expect(prisma.pluggyConnection.updateMany).toHaveBeenCalledWith({
      where: { itemId: "item-1", userId: "admin-1" },
      data: { institutionName: "Banco Atualizado", status: "UPDATED" },
    });
  });

  it("rejects a unique-item race instead of updating another user's row", async () => {
    const client = {
      fetchItem: jest.fn().mockResolvedValue({
        id: "racing-item",
        clientUserId: "admin-1",
        connector: { name: "Banco Exemplo" },
        status: "UPDATED",
      }),
    };
    const prisma = {
      pluggyConnection: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" })),
        updateMany: jest.fn(),
      },
    };
    const service = new PluggyService(prisma as never, () => client as never);

    await expect(service.registerConnection("admin-1", "racing-item")).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.pluggyConnection.updateMany).not.toHaveBeenCalled();
  });

  it("revokes a Pluggy item and removes only the owner's local connection", async () => {
    const client = {
      fetchItem: jest.fn().mockResolvedValue({ id: "item-1", clientUserId: "admin-1" }),
      deleteItem: jest.fn().mockResolvedValue(undefined),
    };
    const prisma = {
      pluggyConnection: {
        findFirst: jest.fn().mockResolvedValue({ id: "connection-1", itemId: "item-1" }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      financeTransaction: { deleteMany: jest.fn() },
    };
    const service = new PluggyService(prisma as never, () => client as never);

    await expect(service.removeConnection("admin-1", "connection-1")).resolves.toEqual({
      success: true,
      historyPreserved: true,
    });
    expect(client.deleteItem).toHaveBeenCalledWith("item-1");
    expect(prisma.pluggyConnection.deleteMany).toHaveBeenCalledWith({
      where: { id: "connection-1", userId: "admin-1" },
    });
    expect(prisma.financeTransaction.deleteMany).not.toHaveBeenCalled();
  });

  it("does not revoke or remove a connection that does not belong to the user", async () => {
    const client = { fetchItem: jest.fn(), deleteItem: jest.fn() };
    const prisma = {
      pluggyConnection: { findFirst: jest.fn().mockResolvedValue(null), deleteMany: jest.fn() },
    };
    const service = new PluggyService(prisma as never, () => client as never);

    await expect(service.removeConnection("admin-1", "other-connection")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(client.fetchItem).not.toHaveBeenCalled();
    expect(client.deleteItem).not.toHaveBeenCalled();
    expect(prisma.pluggyConnection.deleteMany).not.toHaveBeenCalled();
  });

  it("removes only duplicate Pluggy rows with the same normalized description, amount, type, account and minute", async () => {
    const now = new Date("2026-10-21T12:31:00.000Z");
    const rows = [
      {
        id: "kept-edited", description: " mercado  central ", amountCents: 2500, kind: "expense",
        accountName: "conta corrente", occurredAt: new Date("2026-10-21T12:31:58.000Z"),
        categoryEdited: true, descriptionEdited: false, amountEdited: false,
        createdAt: new Date("2026-10-20T00:00:00Z"), updatedAt: now,
      },
      {
        id: "removed", description: "Mercado Central", amountCents: 2500, kind: "expense",
        accountName: "Conta Corrente", occurredAt: new Date("2026-10-21T12:31:03.000Z"),
        categoryEdited: false, descriptionEdited: false, amountEdited: false,
        createdAt: new Date("2026-10-21T00:00:00Z"), updatedAt: new Date("2026-10-21T00:00:00Z"),
      },
      {
        id: "different-minute", description: "Mercado Central", amountCents: 2500, kind: "expense",
        accountName: "Conta Corrente", occurredAt: new Date("2026-10-21T12:32:01.000Z"),
        categoryEdited: false, descriptionEdited: false, amountEdited: false,
        createdAt: now, updatedAt: now,
      },
    ];
    const prisma = {
      financeTransaction: {
        findMany: jest.fn().mockResolvedValue(rows),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn().mockImplementation(async (operations) => Promise.all(operations)),
    };
    const service = new PluggyService(prisma as never, () => ({}) as never);

    await expect(service.deduplicateImportedTransactions("admin-1")).resolves.toBe(1);
    expect(prisma.financeTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "admin-1", source: "pluggy" } }),
    );
    expect(prisma.financeTransaction.deleteMany).toHaveBeenCalledWith({
      where: { userId: "admin-1", source: "pluggy", id: { in: ["removed"] } },
    });
  });

  it("syncs every connection when one institution has multiple connected accounts", async () => {
    const occurredAt = new Date("2026-10-15T12:00:00.000Z");
    const client = {
      fetchItem: jest.fn().mockImplementation(async (itemId: string) => ({
        id: itemId,
        clientUserId: "admin-1",
        connector: { name: "Banco Exemplo" },
        status: "UPDATED",
      })),
      fetchAccounts: jest.fn().mockImplementation(async (itemId: string) => ({
        results: [
          {
            id: `account-${itemId}`,
            type: "BANK",
            name: `Conta ${itemId}`,
            currencyCode: "BRL",
          },
        ],
      })),
      fetchAllTransactions: jest.fn().mockImplementation(async (accountId: string) => [
        {
          id: `transaction-${accountId}`,
          date: occurredAt,
          description: `Compra ${accountId}`,
          amount: 10,
          type: "DEBIT",
          status: "POSTED",
        },
      ]),
    };
    const prisma = {
      pluggyConnection: {
        findMany: jest.fn().mockResolvedValue([
          { id: "connection-1", itemId: "item-1", lastSyncedAt: null },
          { id: "connection-2", itemId: "item-2", lastSyncedAt: null },
        ]),
        update: jest.fn(),
      },
      financeTransaction: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (operations) => Promise.all(operations)),
    };
    const service = new PluggyService(prisma as never, () => client as never);

    await expect(service.syncUserConnections("admin-1", true)).resolves.toMatchObject({
      connections: 2,
      syncedConnections: 2,
      importedTransactions: 2,
    });
    expect(client.fetchItem).toHaveBeenCalledTimes(2);
    expect(client.fetchAccounts).toHaveBeenCalledTimes(2);
    expect(prisma.financeTransaction.upsert).toHaveBeenCalledTimes(2);
    expect(
      prisma.financeTransaction.upsert.mock.calls.map(
        ([arguments_]) => arguments_.create.accountName,
      ),
    ).toEqual(["Conta item-1", "Conta item-2"]);
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
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn(),
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (operations) => Promise.all(operations)),
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
    const firstSync = prisma.financeTransaction.upsert.mock.calls[0][0];
    expect(firstSync.update).not.toHaveProperty("description");
    expect(firstSync.update).not.toHaveProperty("amountCents");
    expect(firstSync.update).not.toHaveProperty("categoryId");
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
