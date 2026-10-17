import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { translateCategoryName } from "./category-localization";

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

function localizeTransactionCategory<T extends { category?: { name: string } | null }>(
  transaction: T,
) {
  if (!transaction.category) return transaction;
  return {
    ...transaction,
    category: {
      ...transaction.category,
      name: translateCategoryName(transaction.category.name),
    },
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
        name: translateCategoryName(item.category.name),
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
      recentTransactions: current.slice(0, 8).map(localizeTransactionCategory),
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
    const [items, total, aggregate, expenseAggregate] = await this.prisma.$transaction([
      this.prisma.financeTransaction.findMany({
        where,
        include: { category: true },
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.financeTransaction.count({ where }),
      this.prisma.financeTransaction.aggregate({
        where,
        _sum: { amountCents: true },
      }),
      this.prisma.financeTransaction.aggregate({
        where: { ...where, kind: "expense" },
        _sum: { amountCents: true },
      }),
    ]);
    return {
      items: items.map(localizeTransactionCategory),
      total,
      totalAmountCents: aggregate._sum.amountCents ?? 0,
      totalExpenseAmountCents: expenseAggregate._sum.amountCents ?? 0,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
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
    const editablePluggyFields = new Set([
      "description",
      "amountCents",
      "categoryId",
    ]);
    if (
      current.source === "pluggy" &&
      Object.keys(data).some((field) => !editablePluggyFields.has(field))
    ) {
      throw new ForbiddenException(
        "Em transações bancárias, altere apenas descrição, valor e categoria",
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
    if (current.source === "pluggy") {
      if ("description" in data) updateData.descriptionEdited = true;
      if ("amountCents" in data) updateData.amountEdited = true;
      if ("categoryId" in data) updateData.categoryEdited = true;
    }
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

  async listInvestments(
    userId: string,
    query: {
      category?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const where = {
      userId,
      ...(query.category ? { category: query.category } : {}),
      ...(query.search ? { name: { contains: query.search } } : {}),
    };
    const [items, total, aggregate] = await this.prisma.$transaction([
      this.prisma.financeInvestment.findMany({
        where,
        orderBy: [{ acquiredAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.financeInvestment.count({ where }),
      this.prisma.financeInvestment.aggregate({
        where,
        _sum: { amountCents: true },
      }),
    ]);
    return {
      items,
      total,
      totalAmountCents: aggregate._sum.amountCents ?? 0,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createInvestment(
    userId: string,
    data: {
      name: string;
      amountCents: number;
      category: string;
      acquiredAt?: string;
    },
  ) {
    this.validateInvestment(data.name, data.amountCents, data.category);
    return this.prisma.financeInvestment.create({
      data: {
        userId,
        name: data.name.trim(),
        amountCents: data.amountCents,
        category: translateCategoryName(data.category),
        acquiredAt: this.parseInvestmentDate(data.acquiredAt),
      },
    });
  }

  async updateInvestment(
    userId: string,
    id: string,
    data: Partial<{
      name: string;
      amountCents: number;
      category: string;
      acquiredAt: string;
    }>,
  ) {
    const current = await this.prisma.financeInvestment.findFirst({
      where: { id, userId },
    });
    if (!current) throw new NotFoundException("Investimento não encontrado");
    const name = data.name ?? current.name;
    const amountCents = data.amountCents ?? current.amountCents;
    const category = data.category ?? current.category;
    this.validateInvestment(name, amountCents, category);
    const updateData: Record<string, unknown> = { ...data };
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.category !== undefined)
      updateData.category = translateCategoryName(data.category);
    if (data.acquiredAt !== undefined)
      updateData.acquiredAt = this.parseInvestmentDate(data.acquiredAt);
    return this.prisma.financeInvestment.update({
      where: { id },
      data: updateData,
    });
  }

  async removeInvestment(userId: string, id: string) {
    const current = await this.prisma.financeInvestment.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!current) throw new NotFoundException("Investimento não encontrado");
    const result = await this.prisma.financeInvestment.deleteMany({
      where: { id, userId },
    });
    if (result.count === 0)
      throw new NotFoundException("Investimento não encontrado");
    return { success: true };
  }

  async listCategories(userId: string) {
    const categories = await this.prisma.financeCategory.findMany({
      where: { userId },
      orderBy: [{ name: "asc" }],
    });
    return categories.map((category) => ({
      ...category,
      name: translateCategoryName(category.name),
    }));
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
        name: translateCategoryName(data.name),
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

  private validateInvestment(name: string, amountCents: number, category: string) {
    if (!name?.trim())
      throw new BadRequestException("Informe o nome do investimento");
    if (!Number.isInteger(amountCents) || amountCents <= 0)
      throw new BadRequestException("Valor do investimento deve ser positivo");
    if (!category?.trim())
      throw new BadRequestException("Informe a categoria do investimento");
  }

  private parseInvestmentDate(value?: string) {
    const dateValue = value ?? new Date().toISOString().slice(0, 10);
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
    if (!dateMatch) throw new BadRequestException("Data do investimento inválida");
    const [, year, month, day] = dateMatch.map(Number) as [
      number,
      number,
      number,
      number,
    ];
    const date = new Date(Date.UTC(year, month - 1, day, 12));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException("Data do investimento inválida");
    }
    return date;
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
