import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function monthBounds(month: string) {
  if (!MONTH_PATTERN.test(month)) {
    throw new BadRequestException("Mês inválido; use YYYY-MM");
  }
  const [year, monthIndex] = month.split("-").map(Number);
  const currentStart = new Date(Date.UTC(year, monthIndex - 1, 1));
  const nextStart = new Date(Date.UTC(year, monthIndex, 1));
  const previousStart = new Date(Date.UTC(year, monthIndex - 2, 1));
  return {
    currentStart,
    nextStart,
    previousStart,
    days: new Date(Date.UTC(year, monthIndex, 0)).getUTCDate(),
  };
}

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(userId: string, month: string) {
    const bounds = monthBounds(month);
    const transactions = await this.prisma.financeTransaction.findMany({
      where: {
        userId,
        occurredAt: { gte: bounds.previousStart, lt: bounds.nextStart },
      },
      include: { category: true },
      orderBy: { occurredAt: "desc" },
    });
    const current = transactions.filter(
      (item) => item.occurredAt >= bounds.currentStart,
    );
    const previous = transactions.filter(
      (item) => item.occurredAt < bounds.currentStart,
    );
    const sum = (items: typeof transactions, kind: string) =>
      items
        .filter((item) => item.kind === kind)
        .reduce((total, item) => total + item.amountCents, 0);
    const expensesCents = sum(current, "expense");
    const incomeCents = sum(current, "income");
    const previousExpensesCents = sum(previous, "expense");
    const previousIncomeCents = sum(previous, "income");

    const categoryMap = new Map<
      string,
      {
        id: string;
        name: string;
        color: string;
        amountCents: number;
        count: number;
      }
    >();
    for (const item of current) {
      if (item.kind !== "expense" || !item.category) continue;
      const currentCategory = categoryMap.get(item.category.id) ?? {
        id: item.category.id,
        name: item.category.name,
        color: item.category.color,
        amountCents: 0,
        count: 0,
      };
      currentCategory.amountCents += item.amountCents;
      currentCategory.count += 1;
      categoryMap.set(item.category.id, currentCategory);
    }

    const daily = Array.from({ length: bounds.days }, (_, index) => ({
      day: index + 1,
      expensesCents: 0,
    }));
    for (const item of current) {
      if (item.kind === "expense")
        daily[item.occurredAt.getUTCDate() - 1].expensesCents +=
          item.amountCents;
    }

    return {
      month,
      totals: {
        expensesCents,
        incomeCents,
        balanceCents: incomeCents - expensesCents,
        previousExpensesCents,
        previousIncomeCents,
      },
      categories: Array.from(categoryMap.values()).sort(
        (a, b) => b.amountCents - a.amountCents,
      ),
      daily,
      recentTransactions: current.slice(0, 8),
    };
  }

  async listTransactions(
    userId: string,
    query: {
      month?: string;
      kind?: string;
      categoryId?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const month = query.month ?? new Date().toISOString().slice(0, 7);
    const bounds = monthBounds(month);
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const where = {
      userId,
      occurredAt: { gte: bounds.currentStart, lt: bounds.nextStart },
      ...(query.kind === "expense" || query.kind === "income"
        ? { kind: query.kind }
        : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.search ? { description: { contains: query.search } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.financeTransaction.findMany({
        where,
        include: { category: true },
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.financeTransaction.count({ where }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async createTransaction(
    userId: string,
    data: {
      description: string;
      amountCents: number;
      kind: string;
      occurredAt: string;
      categoryId?: string | null;
      accountName?: string;
    },
  ) {
    this.validateTransaction(data);
    if (data.categoryId)
      await this.assertCategoryOwner(userId, data.categoryId);
    return this.prisma.financeTransaction.create({
      data: {
        ...data,
        userId,
        occurredAt: new Date(`${data.occurredAt}T12:00:00.000Z`),
        categoryId: data.categoryId || null,
      },
      include: { category: true },
    });
  }

  async updateTransaction(
    userId: string,
    id: string,
    data: Partial<{
      description: string;
      amountCents: number;
      kind: string;
      occurredAt: string;
      categoryId: string | null;
      accountName: string;
    }>,
  ) {
    const current = await this.prisma.financeTransaction.findFirst({
      where: { id, userId },
    });
    if (!current) throw new NotFoundException("Lançamento não encontrado");
    if (
      current.source === "pluggy" &&
      Object.keys(data).some((field) => field !== "categoryId")
    ) {
      throw new ForbiddenException(
        "Os dados de uma transação bancária não podem ser alterados",
      );
    }
    this.validateTransaction({
      description: data.description ?? current.description,
      amountCents: data.amountCents ?? current.amountCents,
      kind: data.kind ?? current.kind,
      occurredAt:
        data.occurredAt ?? current.occurredAt.toISOString().slice(0, 10),
    });
    if (data.categoryId)
      await this.assertCategoryOwner(userId, data.categoryId);
    const updateData = { ...data } as Record<string, unknown>;
    if (data.occurredAt)
      updateData.occurredAt = new Date(`${data.occurredAt}T12:00:00.000Z`);
    if ("categoryId" in data) updateData.categoryId = data.categoryId || null;
    return this.prisma.financeTransaction.update({
      where: { id },
      data: updateData,
      include: { category: true },
    });
  }

  async removeTransaction(userId: string, id: string) {
    const current = await this.prisma.financeTransaction.findFirst({
      where: { id, userId },
      select: { source: true },
    });
    if (!current) throw new NotFoundException("Lançamento não encontrado");
    if (current.source === "pluggy") {
      throw new ForbiddenException(
        "Uma transação bancária importada não pode ser excluída",
      );
    }
    const result = await this.prisma.financeTransaction.deleteMany({
      where: { id, userId },
    });
    if (result.count === 0)
      throw new NotFoundException("Lançamento não encontrado");
    return { success: true };
  }

  async listCategories(userId: string) {
    return this.prisma.financeCategory.findMany({
      where: { userId },
      orderBy: [{ name: "asc" }],
    });
  }

  async createCategory(
    userId: string,
    data: { name: string; color?: string; icon?: string },
  ) {
    if (!data.name?.trim())
      throw new BadRequestException("Informe o nome da categoria");
    return this.prisma.financeCategory.create({
      data: {
        userId,
        name: data.name.trim(),
        color: data.color ?? "#16a34a",
        icon: data.icon ?? "circle",
      },
    });
  }

  private async assertCategoryOwner(userId: string, categoryId: string) {
    const category = await this.prisma.financeCategory.findFirst({
      where: { id: categoryId, userId },
    });
    if (!category) throw new BadRequestException("Categoria inválida");
  }

  private validateTransaction(data: {
    description: string;
    amountCents: number;
    kind: string;
    occurredAt: string;
  }) {
    if (!data.description?.trim())
      throw new BadRequestException("Informe a descrição");
    if (!Number.isInteger(data.amountCents) || data.amountCents <= 0)
      throw new BadRequestException("Valor deve ser positivo");
    if (!["expense", "income"].includes(data.kind))
      throw new BadRequestException("Tipo inválido");
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data.occurredAt ?? "");
    if (!dateMatch) throw new BadRequestException("Data inválida");
    const [, year, month, day] = dateMatch.map(Number) as [
      number,
      number,
      number,
      number,
    ];
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException("Data inválida");
    }
  }
}
