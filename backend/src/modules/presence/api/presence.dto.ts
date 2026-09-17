import { PublicSupplierDto } from '../../../core/suppliers/suppliers.dto.js';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString, MaxLength, MinLength, Matches } from 'class-validator';
export class PresenceDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;
  @ApiProperty() @IsString() @MaxLength(4000) description!: string;
  @ApiProperty() @IsBoolean() published!: boolean;
}
export class PresenceResponseDto extends PresenceDto {
  @ApiProperty() id!: string;
  @ApiProperty() supplierId!: string;
}

export class PublicPresenceDto {
  @ApiProperty() slug!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ type: PublicSupplierDto }) supplier!: PublicSupplierDto;
}
