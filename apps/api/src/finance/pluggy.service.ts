import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
  ServiceUnavailableException,
} from "@nestjs/common";
import { PluggyClient } from "pluggy-sdk";
import { PrismaService } from "../prisma/prisma.service";
import { translateCategoryName } from "./category-localization";

export const PLUGGY_CLIENT_FACTORY = Symbol("PLUGGY_CLIENT_FACTORY");
type PluggyClientApi = Pick<
  PluggyClient,
  "createConnectToken" | "fetchItem" | "fetchAccounts" | "fetchAllTransactions"
>;
type PluggyClientFactory = () => PluggyClientApi;

const SYNC_INTERVAL_MS = 15 * 60 * 1000;
const OPEN_FINANCE_HISTORY_MONTHS = 12;

@Injectable()
export class PluggyService {
  private client?: PluggyClientApi;

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(PLUGGY_CLIENT_FACTORY)
    private readonly clientFactory?: PluggyClientFactory,
  ) {}

  async createConnectToken(userId: string): Promise<string> {
    const result = await this.getClient().createConnectToken(undefined, {
      clientUserId: userId,
      avoidDuplicates: false,
    });
    return result.accessToken;
  }

  async registerConnection(userId: string, itemId: string) {
    const item = await this.getClient().fetchItem(itemId);
    if (item.clientUserId !== userId) {
      throw new ForbiddenException("A conexão Pluggy pertence a outro usuário");
    }

    const existing = await this.prisma.pluggyConnection.findUnique({
      where: { itemId },
      select: { userId: true },
    });
    const connectionData = {
      institutionName: item.connector.name,
      status: item.status,
    };

    if (existing) {
      if (existing.userId !== userId) {
        throw new ForbiddenException("A conexão Pluggy pertence a outro usuário");
      }
      const updated = await this.prisma.pluggyConnection.updateMany({
        where: { itemId, userId },
        data: connectionData,
      });
      if (updated.count === 0) {
        throw new ConflictException("A conexão mudou durante a atualização; tente novamente");
      }
      const connection = await this.prisma.pluggyConnection.findUnique({
        where: { itemId },
      });
      if (!connection || connection.userId !== userId) {
        throw new ForbiddenException("A conexão Pluggy pertence a outro usuário");
      }
      return connection;
    }

    try {
      return await this.prisma.pluggyConnection.create({
        data: { userId, itemId, ...connectionData },
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        throw new ConflictException("A conexão foi registrada em paralelo; tente novamente");
      }
      throw error;
    }
  }

  async listConnections(userId: string) {
    return this.prisma.pluggyConnection.findMany({
      where: { userId },
      select: {
        id: true,
        institutionName: true,
        status: true,
        lastSyncedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async syncUserConnections(userId: string, force = false) {
    const connections = await this.prisma.pluggyConnection.findMany({
      where: { userId },
    });
    if (connections.length === 0) {
      return { connections: 0, syncedConnections: 0, pendingConnections: 0, importedTransactions: 0 };
    }

    const now = new Date();
    const dateTo = now.toISOString().slice(0, 10);
    const dateFromDate = new Date(now);
    dateFromDate.setUTCMonth(dateFromDate.getUTCMonth() - OPEN_FINANCE_HISTORY_MONTHS);
    const dateFrom = dateFromDate.toISOString().slice(0, 10);
    let syncedConnections = 0;
    let pendingConnections = 0;
    let importedTransactions = 0;

    for (const connection of connections) {
      if (
        !force &&
        connection.lastSyncedAt &&
        now.getTime() - connection.lastSyncedAt.getTime() < SYNC_INTERVAL_MS
      ) {
        continue;
      }

      const item = await this.getClient().fetchItem(connection.itemId);
      if (item.clientUserId !== userId) {
        throw new ForbiddenException("A conexão Pluggy pertence a outro usuário");
      }
      if (item.status !== "UPDATED") {
        await this.prisma.pluggyConnection.update({
          where: { id: connection.id },
          data: { status: item.status },
        });
        pendingConnections += 1;
        continue;
      }

      const accounts = await this.getClient().fetchAccounts(connection.itemId);
      for (const account of accounts.results) {
        // The finance ledger is displayed in BRL; don't mislabel foreign-currency values.
        if (account.currencyCode !== "BRL") continue;

        const transactions = await this.getClient().fetchAllTransactions(account.id, {
          dateFrom,
          dateTo,
        });
        for (const transaction of transactions) {
          if (
            account.type === "CREDIT" &&
            ["PAGAMENTO", "PAGAMENTO_FATURA"].includes(
              transaction.operationType ?? "",
            )
          ) {
            // A card bill payment is not income; counting it would inflate totals
            // or double-count the debit already present on the bank account.
            continue;
          }

          const occurredAt = new Date(transaction.date);
          if (!Number.isFinite(occurredAt.getTime())) continue;

          const amountCents = Math.round(Math.abs(transaction.amount) * 100);
          if (!Number.isSafeInteger(amountCents) || amountCents === 0) continue;

          const rawCategoryName = transaction.category?.trim().slice(0, 60);
          const categoryName = rawCategoryName
            ? translateCategoryName(rawCategoryName).slice(0, 60)
            : null;
          const category = categoryName
            ? await this.prisma.financeCategory.upsert({
                where: { userId_name: { userId, name: categoryName } },
                create: { userId, name: categoryName },
                update: {},
                select: { id: true },
              })
            : null;
          const transactionData = {
            userId,
            categoryId: category?.id ?? null,
            description: (transaction.description || "Transação bancária").slice(0, 160),
            amountCents,
            kind: transaction.type === "CREDIT" ? "income" : "expense",
            accountName: account.name.slice(0, 100),
            source: "pluggy",
            pluggyTransactionId: transaction.id,
            occurredAt,
          };

          const where = {
            userId_pluggyTransactionId: {
              userId,
              pluggyTransactionId: transaction.id,
            },
          };
          const {
            categoryId: importedCategoryId,
            description,
            amountCents: importedAmountCents,
            ...refreshData
          } = transactionData;
          await this.prisma.financeTransaction.upsert({
            where,
            create: { ...transactionData, categoryId: importedCategoryId },
            update: refreshData,
          });

          // Apply each importable field only while its override flag is false.
          // The predicate is evaluated by SQLite at write time, so a concurrent
          // user edit cannot be overwritten by this sync after a stale read.
          await this.prisma.financeTransaction.updateMany({
            where: {
              userId,
              pluggyTransactionId: transaction.id,
              descriptionEdited: false,
            },
            data: { description },
          });
          await this.prisma.financeTransaction.updateMany({
            where: {
              userId,
              pluggyTransactionId: transaction.id,
              amountEdited: false,
            },
            data: { amountCents: importedAmountCents },
          });
          await this.prisma.financeTransaction.updateMany({
            where: {
              userId,
              pluggyTransactionId: transaction.id,
              categoryEdited: false,
            },
            data: { categoryId: importedCategoryId },
          });
          importedTransactions += 1;
        }
      }

      await this.prisma.pluggyConnection.update({
        where: { id: connection.id },
        data: { status: item.status, lastSyncedAt: now },
      });
      syncedConnections += 1;
    }

    return {
      connections: connections.length,
      syncedConnections,
      pendingConnections,
      importedTransactions,
    };
  }

  private getClient(): PluggyClientApi {
    if (this.client) return this.client;
    if (this.clientFactory) {
      this.client = this.clientFactory();
      return this.client;
    }

    const clientId = process.env.PLUGGY_CLIENT_ID;
    const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        "A integração Open Finance ainda não está configurada",
      );
    }
    this.client = new PluggyClient({ clientId, clientSecret });
    return this.client;
  }
}
