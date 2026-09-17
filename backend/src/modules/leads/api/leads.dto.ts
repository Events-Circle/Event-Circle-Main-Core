import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, ValidateIf, MinLength, MaxLength, IsIn, Equals, Matches } from 'class-validator';
import { leadStages, type LeadStage } from '@events-circle/contracts';
export class LeadDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsEmail()
  @MaxLength(254)
  email?: string;
  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Matches(/^[+0-9 ()-]{7,30}$/)
  phone?: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(4000) message!: string;
  @ApiProperty({ enum: ['DIRECT', 'QR', 'PROFILE', 'LISTING', 'SOCIAL', 'ADS', 'EMAIL'] })
  @IsIn(['DIRECT', 'QR', 'PROFILE', 'LISTING', 'SOCIAL', 'ADS', 'EMAIL'])
  source = 'DIRECT';
  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(200)
  campaign?: string;
  @ApiProperty() @Equals(true) contactConsent!: boolean;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(50) contactConsentVersion!: string;
}
export class StageDto {
  @ApiProperty({ enum: leadStages }) @IsIn(leadStages) stage!: LeadStage;
}
export class LeadResponseDto extends LeadDto {
  @ApiProperty() id!: string;
  @ApiProperty() supplierId!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty({ enum: leadStages }) stage!: LeadStage;
}
export class ReceiptDto {
  @ApiProperty() id!: string;
}
