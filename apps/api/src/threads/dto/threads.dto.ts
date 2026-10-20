import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ThreadPostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30000)
  text!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsUrl({ protocols: ['https'], require_protocol: true }, { each: true })
  @Matches(/^https:\/\/pbs\.twimg\.com\//i, { each: true })
  mediaUrls?: string[];
}

export class ImportThreadDto {
  @IsString()
  @MaxLength(2048)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @Matches(/^https?:\/\/(?:www\.)?(?:x\.com|twitter\.com|twitter-thread\.com)\//i)
  sourceUrl!: string;
}

export class CreateThreadDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @IsString()
  @MaxLength(2048)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @Matches(/^https:\/\/(?:x\.com|twitter-thread\.com)\//i)
  sourceUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  authorName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^$|^@?[A-Za-z0-9_]{1,15}$/)
  authorHandle?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ThreadPostDto)
  posts!: ThreadPostDto[];
}

export class UpdateThreadDto {
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ThreadPostDto)
  posts?: ThreadPostDto[];
}

export class ListThreadsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
