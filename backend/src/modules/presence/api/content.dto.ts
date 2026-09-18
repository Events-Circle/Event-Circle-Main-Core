import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  MinLength,
  MaxLength,
  IsUUID,
  IsArray,
  ArrayMaxSize,
  IsIn,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsISO8601,
  ValidateNested,
  ValidateIf,
  IsOptional,
  ArrayUnique,
} from 'class-validator';
import { Trim } from '../../../common/trim.js';
import { PageQuery } from '../../../common/pagination.js';
import { listingTypes, pricingModes, priceUnits } from '@events-circle/contracts';
import type { ListingType, PricingMode, PriceUnit } from '@events-circle/contracts';
export const collections = { portfolio: 'portfolio', listings: 'listings', gallery: 'gallery' } as const;
export type Collection = keyof typeof collections;
export class MediaReferenceDto {
  @ApiProperty() @IsUUID() mediaId!: string;
  @ApiProperty({ enum: ['COVER', 'GALLERY'] }) @IsIn(['COVER', 'GALLERY']) role!: 'COVER' | 'GALLERY';
  @ApiProperty() @Trim() @IsString() @MinLength(1) @MaxLength(300) altText!: string;
  @ApiPropertyOptional()
  @ValidateIf((_, v) => v !== undefined)
  @Trim()
  @IsString()
  @MaxLength(1000)
  caption?: string;
}
export class ContentWriteDto {
  @ApiProperty() @Trim() @IsString() @MinLength(1) @MaxLength(160) title!: string;
  @ApiPropertyOptional() @Trim() @IsString() @MaxLength(500) summary = '';
  @ApiPropertyOptional() @Trim() @IsString() @MaxLength(4000) description = '';
  @ApiPropertyOptional({ nullable: true, type: String }) @IsOptional() @IsUUID() categoryId?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) @IsOptional() @IsUUID() locationId?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsISO8601({ strict: true })
  occurredAt?: string | null;
  @ApiPropertyOptional({ enum: listingTypes })
  @ValidateIf((_, v) => v !== undefined)
  @IsIn(listingTypes)
  type?: ListingType;
  @ApiPropertyOptional({ enum: pricingModes })
  @ValidateIf((_, v) => v !== undefined)
  @IsIn(pricingModes)
  pricingMode?: PricingMode;
  @ApiPropertyOptional({
    enum: priceUnits,
    nullable: true,
    description: 'Price basis. Null means unspecified for compatibility with existing listings.',
  })
  @IsOptional()
  @IsIn(priceUnits)
  priceUnit?: PriceUnit | null;
  @ApiPropertyOptional({
    type: [String],
    description: 'Up to 20 ordered inclusions, 200 characters each. Omit to preserve; [] clears.',
  })
  @ValidateIf((_, v) => v !== undefined)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(200, { each: true })
  inclusions?: string[];
  @ApiPropertyOptional({
    description:
      'Optional pricing conditions, such as minimum guest count or extra travel fees. Omit to preserve; empty string clears.',
  })
  @ValidateIf((_, v) => v !== undefined)
  @Trim()
  @IsString()
  @MaxLength(500)
  pricingNote?: string;
  @ApiPropertyOptional({ nullable: true, type: Number })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483647)
  amountMinor?: number | null;
  @ApiPropertyOptional({ nullable: true, type: String }) @IsOptional() @IsString() @MaxLength(3) currency?:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsISO8601({ strict: true })
  validFrom?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsISO8601({ strict: true })
  validUntil?: string | null;
  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(100, { each: true })
  serviceAreas: string[] = [];
  @ApiPropertyOptional() @Trim() @IsString() @MaxLength(500) availabilityNote = '';
  @ApiPropertyOptional() @IsBoolean() featured = false;
  @ApiProperty({ type: [MediaReferenceDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => MediaReferenceDto)
  media!: MediaReferenceDto[];
  @ApiPropertyOptional({
    description: 'Required when updating an existing record; stale versions return 409.',
  })
  @ValidateIf((_, v) => v !== undefined)
  @IsInt()
  @Min(1)
  version?: number;
}
export class PublicContentDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() summary!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ nullable: true, type: String }) categoryId!: string | null;
  @ApiProperty({ nullable: true, type: String }) locationId!: string | null;
  @ApiProperty({ nullable: true, type: String }) occurredAt!: string | null;
  @ApiProperty({ enum: listingTypes, nullable: true }) type!: string | null;
  @ApiProperty({ enum: pricingModes, nullable: true }) pricingMode!: string | null;
  @ApiProperty({ enum: priceUnits, nullable: true }) priceUnit!: string | null;
  @ApiProperty({ type: [String] }) inclusions!: string[];
  @ApiProperty() pricingNote!: string;
  @ApiProperty({ nullable: true, type: Number }) amountMinor!: number | null;
  @ApiProperty({ nullable: true, type: String }) currency!: string | null;
  @ApiProperty({ nullable: true, type: String }) validFrom!: string | null;
  @ApiProperty({ nullable: true, type: String }) validUntil!: string | null;
  @ApiProperty({ type: [String] }) serviceAreas!: string[];
  @ApiProperty() availabilityNote!: string;
  @ApiProperty() featured!: boolean;
  @ApiProperty() displayOrder!: number;
  @ApiProperty({ type: [MediaReferenceDto] }) media!: MediaReferenceDto[];
}
export class ContentResponseDto extends PublicContentDto {
  @ApiProperty() supplierId!: string;
  @ApiProperty({ enum: ['PORTFOLIO', 'LISTING', 'GALLERY'] }) kind!: string;
  @ApiProperty({ enum: ['DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED'] }) status!: string;
  @ApiProperty() version!: number;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
  @ApiProperty({ nullable: true, type: String }) publishedAt!: string | null;
}
export class ContentPageQuery extends PageQuery {
  @ApiPropertyOptional({ enum: listingTypes })
  @ValidateIf((_, v) => v !== undefined)
  @IsIn(listingTypes)
  type?: ListingType;
}
export class VersionDto {
  @ApiProperty() @IsInt() @Min(1) version!: number;
}
export class ReorderDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  ids!: string[];
  @ApiProperty({ description: 'Current profile version; returned by GET profile.' })
  @IsInt()
  @Min(1)
  version!: number;
}
