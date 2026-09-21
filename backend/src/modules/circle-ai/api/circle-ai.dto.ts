import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsString, IsUUID, Length, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { actionKinds, type ActionKind } from '../domain/planning.js';
export class RequestDto {
  @ApiProperty({ format: 'uuid', description: 'Client request ID; retries must reuse the same ID and body.' })
  @IsUUID()
  requestId!: string;
  @ApiProperty({ enum: actionKinds })
  @IsIn(actionKinds)
  kind!: ActionKind;
  @ApiProperty({ minLength: 1, maxLength: 4000 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 4000)
  prompt!: string;
}
export class EditPlanDto {
  @ApiProperty() @IsInt() @Min(1) version!: number;
  @ApiProperty({ maxLength: 4000 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 4000)
  draft!: string;
}
export class DecisionDto {
  @ApiProperty() @IsInt() @Min(1) version!: number;
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsIn(['APPROVED', 'REJECTED'])
  decision!: 'APPROVED' | 'REJECTED';
}
export class PlanDto {
  @ApiProperty() id!: string;
  @ApiProperty() kind!: string;
  @ApiProperty() prompt!: string;
  @ApiProperty() title!: string;
  @ApiProperty() response!: string;
  @ApiProperty() draft!: string;
  @ApiProperty() blockedReason!: string;
  @ApiProperty({ enum: ['DRAFT', 'APPROVED', 'REJECTED'] }) status!: string;
  @ApiProperty() version!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
export class BriefDto {
  @ApiProperty() providerReady!: boolean;
  @ApiProperty() executionReady!: boolean;
  @ApiProperty() draftCount!: number;
  @ApiProperty() approvedCount!: number;
  @ApiProperty() rejectedCount!: number;
  @ApiProperty() notice!: string;
}
