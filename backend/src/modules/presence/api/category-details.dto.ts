import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject } from 'class-validator';
import type { CategoryDetails } from '../domain/category-details.js';
export class CategoryDetailsDto {
  @ApiProperty({ enum: ['VENUE', 'PHOTO_VIDEO', 'CATERING', 'ENTERTAINMENT', 'GENERAL'] })
  @IsIn(['VENUE', 'PHOTO_VIDEO', 'CATERING', 'ENTERTAINMENT', 'GENERAL'])
  type!: string;
  @ApiProperty({
    type: 'object',
    additionalProperties: {
      oneOf: [
        { type: 'string' },
        { type: 'number' },
        { type: 'boolean' },
        { type: 'array', items: { type: 'string' } },
      ],
    },
    description:
      'Only keys and values defined by GET /presence/detail-types are accepted. Omit unanswered fields. Sending an empty object clears the values.',
  })
  @IsObject()
  values!: CategoryDetails['values'];
}
export class DetailFieldDto {
  @ApiProperty() key!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ enum: ['number', 'select', 'multi', 'boolean', 'text'] }) kind!: string;
  @ApiProperty() hint!: string;
  @ApiPropertyOptional({ type: [String] }) options?: string[];
  @ApiPropertyOptional() min?: number;
  @ApiPropertyOptional() max?: number;
  @ApiPropertyOptional() unit?: string;
}
export class DetailTypeDto {
  @ApiProperty() id!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ type: [String] }) categories!: string[];
  @ApiProperty({ type: [DetailFieldDto] }) fields!: DetailFieldDto[];
}
