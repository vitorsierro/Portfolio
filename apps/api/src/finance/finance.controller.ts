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
  CreateFinanceInvestmentDto,
  CreateFinanceTransactionDto,
  PluggyConnectionDto,
  UpdateFinanceInvestmentDto,
  UpdateFinanceTransactionDto,
} from "./dto/finance.dto";
import { FinanceService } from "./finance.service";
import { PluggyService } from "./pluggy.service";

@Controller("admin/finance")
@UseGuards(JwtAuthGuard)
export class FinanceController {
  constructor(
    private readonly finance: FinanceService,
    private readonly pluggy: PluggyService,
  ) {}

  @Post("pluggy/connect-token")
  async getPluggyConnectToken(@Req() req: AuthenticatedRequest) {
    return {
      accessToken: await this.pluggy.createConnectToken(req.user!.sub),
    };
  }

  @Get("pluggy/connections")
  listPluggyConnections(@Req() req: AuthenticatedRequest) {
    return this.pluggy.listConnections(req.user!.sub);
  }

  @Post("pluggy/connections")
  registerPluggyConnection(
    @Req() req: AuthenticatedRequest,
    @Body() dto: PluggyConnectionDto,
  ) {
    return this.pluggy.registerConnection(req.user!.sub, dto.itemId);
  }

  @Post("pluggy/sync")
  syncPluggyConnections(@Req() req: AuthenticatedRequest) {
    return this.pluggy.syncUserConnections(req.user!.sub, true);
  }

  @Get("overview")
  async getOverview(
    @Req() req: AuthenticatedRequest,
    @Query() query: { month?: string },
  ) {
    const userId = req.user!.sub;
    const pluggySyncUnavailable = await this.syncPluggyOrFlag(userId);
    const overview = await this.finance.getOverview(
      userId,
      query.month ?? new Date().toISOString().slice(0, 7),
    );
    return { ...overview, pluggySyncUnavailable };
  }

  @Get("transactions")
  async listTransactions(
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
    const userId = req.user!.sub;
    const pluggySyncUnavailable = await this.syncPluggyOrFlag(userId);
    const result = await this.finance.listTransactions(userId, {
      month: query.month,
      kind: query.kind,
      categoryId: query.categoryId,
      search: query.search,
      page: this.parsePositiveInt(query.page, 1),
      limit: this.parsePositiveInt(query.limit, 20),
    });
    return { ...result, pluggySyncUnavailable };
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

  @Get("investments")
  listInvestments(
    @Req() req: AuthenticatedRequest,
    @Query()
    query: {
      category?: string;
      search?: string;
      page?: string;
      limit?: string;
    },
  ) {
    return this.finance.listInvestments(req.user!.sub, {
      category: query.category,
      search: query.search,
      page: this.parsePositiveInt(query.page, 1),
      limit: this.parsePositiveInt(query.limit, 20),
    });
  }

  @Post("investments")
  createInvestment(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateFinanceInvestmentDto,
  ) {
    return this.finance.createInvestment(req.user!.sub, dto);
  }

  @Patch("investments/:id")
  updateInvestment(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: UpdateFinanceInvestmentDto,
  ) {
    return this.finance.updateInvestment(req.user!.sub, id, dto);
  }

  @Delete("investments/:id")
  removeInvestment(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    return this.finance.removeInvestment(req.user!.sub, id);
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

  private async syncPluggyOrFlag(userId: string): Promise<boolean> {
    try {
      await this.pluggy.syncUserConnections(userId);
      return false;
    } catch {
      // Keep the user's last synchronized ledger available during Pluggy outages.
      return true;
    }
  }
}
