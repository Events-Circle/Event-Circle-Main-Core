import {
  Controller,
  Post,
  Get,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Headers,
  Param,
  ParseUUIDPipe,
  StreamableFile,
  Query,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiHeader,
  ApiConsumes,
  ApiBody,
  ApiCreatedResponse,
  ApiProperty,
  ApiOkResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Actor, AuthGuard } from '../auth/auth.guard.js';
import type { Identity } from '@events-circle/types';
import { MediaService } from './media.service.js';
import { PageQuery, pageResponse, pageHeaders } from '../../common/pagination.js';
import type { Response } from 'express';
export class MediaResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() width!: number;
  @ApiProperty() height!: number;
  @ApiProperty() bytes!: number;
  @ApiProperty({ enum: ['image/webp'] }) mimeType!: string;
  @ApiProperty({ enum: ['READY'] }) status!: string;
}
@ApiTags('core-media')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Organization-Id', required: true })
@UseGuards(AuthGuard)
@Controller('core/media')
export class MediaController {
  constructor(private media: MediaService) {}
  @Get()
  @ApiOkResponse({ type: [MediaResponseDto], headers: pageHeaders })
  async list(
    @Actor() a: Identity,
    @Headers('x-organization-id') org: string,
    @Query() q: PageQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    return pageResponse(await this.media.list(a.userId, org, q), res);
  }
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiCreatedResponse({ type: MediaResponseDto })
  upload(
    @Actor() a: Identity,
    @Headers('x-organization-id') org: string,
    @UploadedFile() file?: { buffer: Buffer },
  ) {
    return this.media.upload(a.userId, org, file?.buffer);
  }
  @Get(':id/file')
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  async file(
    @Actor() a: Identity,
    @Headers('x-organization-id') org: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return new StreamableFile(await this.media.ownedBytes(a.userId, org, id), { type: 'image/webp' });
  }
}
