import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthenticatedRequest, JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  CreateFinanceCategoryDto,
  CreateFinanceTransactionDto,
  UpdateFinanceTransactionDto,
} from "./dto/finance.dto";
import { FinanceService } from "./finance.service";

@Controller("admin/finance")
@UseGuards(JwtAuthGuard)
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get("overview")
  getOverview(
    @Req() req: AuthenticatedRequest,
    @Query() query: { month?: string },
  ) {
    return this.finance.getOverview(
      req.user!.sub,
      query.month ?? new Date().toISOString().slice(0, 7),
    );
  }

  @Get("transactions")
  listTransactions(
    @Req() req: AuthenticatedRequest,
    @Query()
    query: {
      month?: string;
      kind?: string;
      categoryId?: string;
      search?: string;
      page?: string;
      limit?: string;
    },
  ) {
    return this.finance.listTransactions(req.user!.sub, {
      month: query.month,
      kind: query.kind,
      categoryId: query.categoryId,
      search: query.search,
      page: this.parsePositiveInt(query.page, 1),
      limit: this.parsePositiveInt(query.limit, 20),
    });
  }

  @Post("transactions")
  createTransaction(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateFinanceTransactionDto,
  ) {
    return this.finance.createTransaction(req.user!.sub, dto);
  }

  @Patch("transactions/:id")
  updateTransaction(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: UpdateFinanceTransactionDto,
  ) {
    return this.finance.updateTransaction(req.user!.sub, id, dto);
  }

  @Delete("transactions/:id")
  removeTransaction(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    return this.finance.removeTransaction(req.user!.sub, id);
  }

  @Get("categories")
  listCategories(@Req() req: AuthenticatedRequest) {
    return this.finance.listCategories(req.user!.sub);
  }

  @Post("categories")
  createCategory(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateFinanceCategoryDto,
  ) {
    return this.finance.createCategory(req.user!.sub, dto);
  }

  private parsePositiveInt(value: string | undefined, fallback: number) {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
