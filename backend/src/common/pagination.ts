import { BadRequestException } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsUUID, Max, Min, ValidateIf } from 'class-validator';
import type { Response } from 'express';
export class PageQuery {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 100;
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  cursor?: string;
}
type PageArgs = { take: number; skip?: number; cursor?: { id: string } };
export async function paginate<T extends { id: string }>(
  query: PageQuery,
  ownsCursor: (id: string) => Promise<unknown>,
  read: (args: PageArgs) => Promise<T[]>,
) {
  if (query.cursor && !(await ownsCursor(query.cursor))) throw new BadRequestException('Invalid cursor');
  const rows = await read({
    take: query.limit + 1,
    ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
  });
  const items = rows.slice(0, query.limit);
  return { items, nextCursor: rows.length > query.limit ? items.at(-1)!.id : undefined };
}
export function pageResponse<T>(page: { items: T[]; nextCursor?: string }, response: Response) {
  if (page.nextCursor) response.setHeader('X-Next-Cursor', page.nextCursor);
  return page.items;
}
export const pageHeaders = {
  'X-Next-Cursor': {
    description: 'Pass as cursor to retrieve the next page. Absent on the last page.',
    schema: { type: 'string', format: 'uuid' },
  },
};
