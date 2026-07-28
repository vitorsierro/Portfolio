import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class ImageDto {
  @IsString() url: string;
  @IsOptional() @IsString() alt?: string;
  @IsInt() @Min(1) width: number;
  @IsInt() @Min(1) height: number;
  @IsOptional() @IsString() blurDataURL?: string;
  @IsOptional() @IsString() cloudinaryId?: string;
}

export class PropertyDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() tagline?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() airbnbListingId?: string;
  @IsOptional() @IsInt() @Min(0) maxGuests?: number;
  @IsOptional() @IsInt() @Min(0) bedrooms?: number;
  @IsOptional() @IsInt() @Min(0) beds?: number;
  @IsOptional() @IsInt() @Min(0) bathrooms?: number;
  @IsOptional() @IsInt() @Min(0) areaM2?: number;
  @IsOptional() @IsInt() @Min(0) basePriceFrom?: number;
  @IsOptional() @IsInt() @Min(1) minNights?: number;
  @IsOptional() @IsString() checkInTime?: string;
  @IsOptional() @IsString() checkOutTime?: string;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
  @IsOptional() @IsString() neighborhood?: string;
  @IsOptional() @IsString() seoTitle?: string;
  @IsOptional() @IsString() seoDescription?: string;
  @IsOptional() @IsString() seoOgImage?: string;
}

export class SpaceDto {
  @IsString() @Matches(SLUG, { message: 'slug deve ser kebab-case' }) slug: string;
  @IsString() category: string;
  @IsString() @MinLength(1) title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() order?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) amenities?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageDto)
  images?: ImageDto[];
}

export class AmenityDto {
  @IsString() @Matches(SLUG) slug: string;
  @IsString() @MinLength(1) label: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() group?: string;
  @IsOptional() @IsInt() order?: number;
}

class GuideBaseDto {
  @IsString() @Matches(SLUG) slug: string;
  @IsString() @MinLength(1) name: string;
  @IsOptional() @IsInt() @Min(0) distanceMinutes?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() tip?: string;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() imageAlt?: string;
  @IsOptional() @IsInt() imageWidth?: number;
  @IsOptional() @IsInt() imageHeight?: number;
  @IsOptional() @IsString() imageBlur?: string;
  @IsOptional() @IsString() cloudinaryId?: string;
  @IsOptional() @IsInt() order?: number;
  @IsOptional() @IsBoolean() published?: boolean;
}

export class RestaurantDto extends GuideBaseDto {
  @IsOptional() @IsString() cuisine?: string;
  @IsOptional() @IsString() priceRange?: string;
  @IsOptional() @IsString() distanceMode?: string;
  @IsOptional() @IsString() mapsUrl?: string;
}

export class ActivityDto extends GuideBaseDto {
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) seasons?: string[];
}

export class FaqItemDto {
  @IsString() @MinLength(1) question: string;
  @IsString() @MinLength(1) answer: string;
  @IsOptional() @IsInt() order?: number;
}

export class Model3dDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() url?: string;
  @IsOptional() @IsString() posterUrl?: string;
}

// Reordenação drag-and-drop: o front manda a lista inteira na ordem nova.
export class ReorderDto {
  @IsArray() @IsString({ each: true }) ids: string[];
}
