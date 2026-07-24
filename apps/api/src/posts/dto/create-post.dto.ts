import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MinLength,
} from 'class-validator';

export class CreatePostDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be kebab-case (lowercase letters, numbers and hyphens)',
  })
  slug: string;

  @IsString()
  @MinLength(1)
  body: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  coverImageUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}
