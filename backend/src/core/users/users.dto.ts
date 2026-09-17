import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  ValidateIf,
  MaxLength,
  MinLength,
  IsBoolean,
  IsIn,
  ValidateNested,
  IsTimeZone,
  IsObject,
} from 'class-validator';
import { Transform, plainToInstance } from 'class-transformer';
export class PreferencesDto {
  @ApiProperty() @IsBoolean() email!: boolean;
  @ApiProperty() @IsBoolean() push!: boolean;
}
export class ProfileDto {
  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName?: string;
  @ApiPropertyOptional({ enum: ['en', 'ar', 'fr'] })
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['en', 'ar', 'fr'])
  locale?: string;
  @ApiPropertyOptional() @ValidateIf((_object, value) => value !== undefined) @IsTimeZone() timezone?: string;
  @ApiPropertyOptional({ type: PreferencesDto })
  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  @ValidateNested()
  // Reject arrays before converting: PreferencesDto.push is a boolean, not an array method.
  @Transform(({ value }) =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? plainToInstance(PreferencesDto, value)
      : value,
  )
  notificationPreferences?: PreferencesDto;
}
export class ConsentDto {
  @ApiProperty({ enum: ['marketing', 'analytics'] }) @IsIn(['marketing', 'analytics']) purpose!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(50) version!: string;
  @ApiProperty() @IsBoolean() granted!: boolean;
}
export class MeDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty() locale!: string;
  @ApiProperty() timezone!: string;
  @ApiProperty({ type: PreferencesDto }) notificationPreferences!: PreferencesDto;
}
export class AccessDto {
  @ApiProperty() userId!: string;
  @ApiProperty({ type: [String] }) features!: string[];
}

export class OrganizationNameDto {
  @ApiProperty() name!: string;
}
export class MembershipDto {
  @ApiProperty() organizationId!: string;
  @ApiProperty({ enum: ['OWNER', 'EDITOR', 'VIEWER'] }) role!: string;
  @ApiProperty({ type: OrganizationNameDto }) organization!: OrganizationNameDto;
}
export class SessionDto {
  @ApiProperty() id!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
}
export class ConsentResponseDto extends ConsentDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty({ format: 'date-time' }) recordedAt!: string;
}
export class SubscriptionDto {
  @ApiProperty() id!: string;
  @ApiProperty() planCode!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ type: [String] }) features!: string[];
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty({ format: 'date-time' }) endsAt!: string;
  @ApiProperty() cancelAtPeriodEnd!: boolean;
}
export class NotificationDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() kind!: string;
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) readAt!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
