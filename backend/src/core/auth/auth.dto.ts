import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { Trim } from '../../common/trim.js';
export class LoginDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;
  @ApiProperty({ minLength: 12, maxLength: 128 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}
export class RegisterDto extends LoginDto {
  @ApiProperty() @Trim() @IsString() @MinLength(1) @MaxLength(100) displayName!: string;
}
export class RefreshDto {
  @ApiProperty() @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) refreshToken!: string;
}
export class TokensDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty() expiresIn!: number;
  @ApiProperty() tokenType!: string;
}
