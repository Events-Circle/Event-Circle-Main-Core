import { PublicSupplierDto } from '../../../core/suppliers/suppliers.dto.js';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsString,
  MaxLength,
  MinLength,
  Matches,
  IsUUID,
  ValidateIf,
  IsOptional,
  IsArray,
  ArrayMaxSize,
  ArrayUnique,
  IsIn,
  IsInt,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Trim } from '../../../common/trim.js';
import { PublicContentDto } from './content.dto.js';
export class SocialLinkDto {
  @ApiProperty({ enum: ['WEBSITE', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'YOUTUBE', 'LINKEDIN'] })
  @IsIn(['WEBSITE', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'YOUTUBE', 'LINKEDIN'])
  provider!: 'WEBSITE' | 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK' | 'YOUTUBE' | 'LINKEDIN';
  @ApiProperty() @IsString() @MaxLength(2000) url!: string;
}
export class OpeningHourDto {
  @ApiProperty({ minimum: 0, maximum: 6 }) @IsInt() @Min(0) @Max(6) weekday!: number;
  @ApiProperty() @IsBoolean() closed!: boolean;
  @ApiPropertyOptional()
  @ValidateIf((_, v) => v !== undefined)
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  opens?: string;
  @ApiPropertyOptional()
  @ValidateIf((_, v) => v !== undefined)
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  closes?: string;
}
export class PresenceDto {
  @ApiPropertyOptional() @ValidateIf((_, v) => v !== undefined) @IsBoolean() showEmail?: boolean;
  @ApiPropertyOptional() @ValidateIf((_, v) => v !== undefined) @IsBoolean() showPhone?: boolean;
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  slug!: string;
  @ApiProperty() @Trim() @IsString() @MaxLength(4000) description!: string;
  @ApiProperty() @IsBoolean() published!: boolean;
  @ApiPropertyOptional()
  @ValidateIf((_, v) => v !== undefined)
  @Trim()
  @IsString()
  @MaxLength(200)
  tagline?: string;
  @ApiPropertyOptional({ nullable: true, type: String }) @IsOptional() @IsUUID() logoMediaId?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) @IsOptional() @IsUUID() coverMediaId?: string | null;
  @ApiPropertyOptional() @ValidateIf((_, v) => v !== undefined) @IsString() @MaxLength(160) seoTitle?: string;
  @ApiPropertyOptional()
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MaxLength(320)
  seoDescription?: string;
  @ApiPropertyOptional()
  @ValidateIf((_, v) => v !== undefined)
  @Matches(/^#[0-9a-fA-F]{6}$/)
  accentColor?: string;
  @ApiPropertyOptional({ type: [SocialLinkDto] })
  @ValidateIf((_, v) => v !== undefined)
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  socialLinks?: SocialLinkDto[];
  @ApiPropertyOptional({ type: [OpeningHourDto] })
  @ValidateIf((_, v) => v !== undefined)
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => OpeningHourDto)
  openingHours?: OpeningHourDto[];
  @ApiPropertyOptional({ type: [String] })
  @ValidateIf((_, v) => v !== undefined)
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(3)
  @IsIn(['portfolio', 'listings', 'gallery'], { each: true })
  sections?: string[];
  @ApiPropertyOptional() @ValidateIf((_, v) => v !== undefined) @IsInt() @Min(1) version?: number;
}
export class PresenceResponseDto extends PresenceDto {
  @ApiProperty() id!: string;
  @ApiProperty() supplierId!: string;
  @ApiProperty({ required: true }) declare version: number;
  @ApiProperty({ nullable: true, type: String }) publishedAt!: string | null;
}

export class PublicPresenceDto {
  @ApiProperty() slug!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ type: PublicSupplierDto }) supplier!: PublicSupplierDto;
  @ApiProperty() tagline!: string;
  @ApiProperty({ nullable: true, type: String }) logoMediaId!: string | null;
  @ApiProperty({ nullable: true, type: String }) coverMediaId!: string | null;
  @ApiProperty() seoTitle!: string;
  @ApiProperty() seoDescription!: string;
  @ApiProperty() accentColor!: string;
  @ApiProperty({ type: [SocialLinkDto] }) socialLinks!: SocialLinkDto[];
  @ApiProperty({ type: [OpeningHourDto] }) openingHours!: OpeningHourDto[];
  @ApiProperty({ type: [String] }) sections!: string[];
  @ApiProperty() inquiriesEnabled!: boolean;
  @ApiProperty({ nullable: true, description: 'API-relative Leads capture path, or null.' }) inquiryPath!:
    string | null;
  @ApiProperty({ type: [PublicContentDto] }) portfolio!: PublicContentDto[];
  @ApiProperty({ type: [PublicContentDto] }) listings!: PublicContentDto[];
  @ApiProperty({ type: [PublicContentDto] }) gallery!: PublicContentDto[];
}
export class ReadinessDto {
  @ApiProperty() ready!: boolean;
  @ApiProperty({ type: [String] }) missing!: string[];
  @ApiProperty() score!: number;
}
export class ShareDto {
  @ApiProperty() url!: string;
  @ApiProperty() qrPayload!: string;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
}
