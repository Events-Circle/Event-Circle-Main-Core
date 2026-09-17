import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, ValidateIf, MinLength, MaxLength, IsIn, Equals, Matches } from 'class-validator';
import { leadStages, type LeadStage } from '@events-circle/contracts';
import { Trim } from '../../../common/trim.js';
export class LeadDto {
  @ApiProperty() @Trim() @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsEmail()
  @Trim()
  @MaxLength(254)
  email?: string;
  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Trim()
  @MaxLength(30)
  @Matches(/^(?=(?:\D*\d){7,15}\D*$)\+?[0-9 ()-]+$/)
  phone?: string;
  @ApiProperty() @Trim() @IsString() @MinLength(1) @MaxLength(4000) message!: string;
  @ApiProperty({ enum: ['DIRECT', 'QR', 'PROFILE', 'LISTING', 'SOCIAL', 'ADS', 'EMAIL'] })
  @IsIn(['DIRECT', 'QR', 'PROFILE', 'LISTING', 'SOCIAL', 'ADS', 'EMAIL'])
  source = 'DIRECT';
  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Trim()
  @MinLength(1)
  @MaxLength(200)
  campaign?: string;
  @ApiProperty() @Equals(true) contactConsent!: boolean;
  @ApiProperty() @Trim() @IsString() @MinLength(1) @MaxLength(50) contactConsentVersion!: string;
}
export class StageDto {
  @ApiProperty({ enum: leadStages }) @IsIn(leadStages) stage!: LeadStage;
}
export class LeadResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() supplierId!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty({ enum: leadStages }) stage!: LeadStage;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) email!: string | null;
  @ApiProperty({ type: String, nullable: true }) phone!: string | null;
  @ApiProperty() message!: string;
  @ApiProperty({ enum: ['DIRECT', 'QR', 'PROFILE', 'LISTING', 'SOCIAL', 'ADS', 'EMAIL'] }) source!: string;
  @ApiProperty({ type: String, nullable: true }) campaign!: string | null;
  @ApiProperty() contactConsent!: boolean;
  @ApiProperty() contactConsentVersion!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}
export class ReceiptDto {
  @ApiProperty() id!: string;
}
