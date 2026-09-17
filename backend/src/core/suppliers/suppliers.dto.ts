import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  MaxLength,
  MinLength,
  IsArray,
  ArrayMaxSize,
  ValidateIf,
  IsBoolean,
} from 'class-validator';
export class SupplierDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(160) businessName!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) category!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) city!: string;
  @ApiPropertyOptional({ type: [String] })
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  serviceAreas: string[] = [];
  @ApiPropertyOptional() @ValidateIf((_object, value) => value !== undefined) @IsBoolean() acceptInquiries =
    false;
}
export class SupplierResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() businessName!: string;
  @ApiProperty() category!: string;
  @ApiProperty() city!: string;
  @ApiProperty({ type: [String] }) serviceAreas!: string[];
  @ApiProperty() acceptInquiries!: boolean;
}

export class PublicSupplierDto {
  @ApiProperty() id!: string;
  @ApiProperty() businessName!: string;
  @ApiProperty() category!: string;
  @ApiProperty() city!: string;
  @ApiProperty({ type: [String] }) serviceAreas!: string[];
}
