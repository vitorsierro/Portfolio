import {
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
  ServiceUnavailableException,
} from "@nestjs/common";
import { PluggyClient } from "pluggy-sdk";
import { PrismaService } from "../prisma/prisma.service";

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
      avoidDuplicates: true,
    });
    return result.accessToken;
  }

  async registerConnection(userId: string, itemId: string) {
    const item = await this.getClient().fetchItem(itemId);
    if (item.clientUserId !== userId) {
      throw new ForbiddenException("A conexão Pluggy pertence a outro usuário");
    }

    return this.prisma.pluggyConnection.upsert({
      where: { itemId },
      create: {
        userId,
        itemId,
        institutionName: item.connector.name,
        status: item.status,
      },
      update: {
        institutionName: item.connector.name,
        status: item.status,
      },
    });
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

          const categoryName = transaction.category?.trim().slice(0, 60);
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

          const { categoryId: importedCategoryId, ...refreshData } = transactionData;
          await this.prisma.financeTransaction.upsert({
            where: {
              userId_pluggyTransactionId: {
                userId,
                pluggyTransactionId: transaction.id,
              },
            },
            create: { ...transactionData, categoryId: importedCategoryId },
            // Preserve a category the user may have customized after import.
            update: refreshData,
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
