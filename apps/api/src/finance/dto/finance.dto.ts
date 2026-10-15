import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from "class-validator";

export class CreateFinanceTransactionDto {
  @IsString() @MaxLength(160) description!: string;
  @IsInt() @Min(1) amountCents!: number;
  @IsIn(["expense", "income"]) kind!: "expense" | "income";
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/) occurredAt!: string;
  @IsOptional() @IsString() categoryId?: string | null;
  @IsOptional() @IsString() @MaxLength(100) accountName?: string;
}

export class UpdateFinanceTransactionDto {
  @IsOptional() @IsString() @MaxLength(160) description?: string;
  @IsOptional() @IsInt() @Min(1) amountCents?: number;
  @IsOptional() @IsIn(["expense", "income"]) kind?: "expense" | "income";
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/)
  occurredAt?: string;
  @IsOptional() @IsString() categoryId?: string | null;
  @IsOptional() @IsString() @MaxLength(100) accountName?: string;
}

export class CreateFinanceCategoryDto {
  @IsString() @MaxLength(60) name!: string;
  @IsOptional() @IsString() @Matches(/^#[\da-fA-F]{6}$/) color?: string;
  @IsOptional() @IsString() @MaxLength(30) icon?: string;
}

export class PluggyConnectionDto {
  @IsString() @MaxLength(100) itemId!: string;
}
