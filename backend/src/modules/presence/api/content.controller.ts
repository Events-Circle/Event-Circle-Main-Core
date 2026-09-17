import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Headers,
  Query,
  Res,
  UseGuards,
  ParseEnumPipe,
  ParseUUIDPipe,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiHeader, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import type { Identity } from '@events-circle/types';
import { Actor, AuthGuard } from '../../../core/auth/auth.guard.js';
import { pageHeaders, pageResponse } from '../../../common/pagination.js';
import { PresenceService } from '../application/presence.service.js';
import {
  collections,
  type Collection,
  ContentWriteDto,
  ContentResponseDto,
  PublicContentDto,
  ContentPageQuery,
  VersionDto,
  ReorderDto,
} from './content.dto.js';
const collectionPipe = new ParseEnumPipe(collections);
@ApiTags('presence-content')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Organization-Id', required: true })
@UseGuards(AuthGuard)
@Controller('presence/collections/:collection')
export class ContentController {
  constructor(private presence: PresenceService) {}
  @Get()
  @ApiOkResponse({ type: [ContentResponseDto], headers: pageHeaders })
  async list(
    @Actor() a: Identity,
    @Headers('x-organization-id') org: string,
    @Param('collection', collectionPipe) c: Collection,
    @Query() q: ContentPageQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    return pageResponse(await this.presence.list(a.userId, org, c, q), res);
  }
  @Post()
  @ApiCreatedResponse({ type: ContentResponseDto })
  create(
    @Actor() a: Identity,
    @Headers('x-organization-id') org: string,
    @Param('collection', collectionPipe) c: Collection,
    @Body() data: ContentWriteDto,
  ) {
    return this.presence.write(a.userId, org, c, data);
  }
  @Post('reorder')
  @ApiCreatedResponse({ type: VersionDto })
  reorder(
    @Actor() a: Identity,
    @Headers('x-organization-id') org: string,
    @Param('collection', collectionPipe) c: Collection,
    @Body() data: ReorderDto,
  ) {
    return this.presence.reorder(a.userId, org, c, data);
  }
  @Get(':id')
  @ApiOkResponse({ type: ContentResponseDto })
  get(
    @Actor() a: Identity,
    @Headers('x-organization-id') org: string,
    @Param('collection', collectionPipe) c: Collection,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.presence.get(a.userId, org, c, id);
  }
  @Put(':id')
  @ApiOkResponse({ type: ContentResponseDto })
  update(
    @Actor() a: Identity,
    @Headers('x-organization-id') org: string,
    @Param('collection', collectionPipe) c: Collection,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: ContentWriteDto,
  ) {
    return this.presence.write(a.userId, org, c, data, id);
  }
  @Post(':id/publish')
  @ApiCreatedResponse({ type: ContentResponseDto })
  publish(
    @Actor() a: Identity,
    @Headers('x-organization-id') org: string,
    @Param('collection', collectionPipe) c: Collection,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: VersionDto,
  ) {
    return this.presence.lifecycle(a.userId, org, c, id, 'PUBLISH', data.version);
  }
  @Post(':id/unpublish')
  @ApiCreatedResponse({ type: ContentResponseDto })
  unpublish(
    @Actor() a: Identity,
    @Headers('x-organization-id') org: string,
    @Param('collection', collectionPipe) c: Collection,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: VersionDto,
  ) {
    return this.presence.lifecycle(a.userId, org, c, id, 'UNPUBLISH', data.version);
  }
  @Post(':id/restore')
  @ApiCreatedResponse({ type: ContentResponseDto })
  restore(
    @Actor() a: Identity,
    @Headers('x-organization-id') org: string,
    @Param('collection', collectionPipe) c: Collection,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: VersionDto,
  ) {
    return this.presence.lifecycle(a.userId, org, c, id, 'RESTORE', data.version);
  }
  @Delete(':id')
  @ApiOkResponse({ type: ContentResponseDto })
  archive(
    @Actor() a: Identity,
    @Headers('x-organization-id') org: string,
    @Param('collection', collectionPipe) c: Collection,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: VersionDto,
  ) {
    return this.presence.lifecycle(a.userId, org, c, id, 'ARCHIVE', data.version);
  }
}
@ApiTags('presence-public')
@Controller('presence/public/:slug')
export class PublicContentController {
  constructor(private presence: PresenceService) {}
  @Get('media/:id')
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  async media(@Param('slug') slug: string, @Param('id', ParseUUIDPipe) id: string) {
    return new StreamableFile(await this.presence.publicMedia(slug, id), { type: 'image/webp' });
  }
  @Get('collections/:collection')
  @ApiOkResponse({ type: [PublicContentDto], headers: pageHeaders })
  async list(
    @Param('slug') slug: string,
    @Param('collection', collectionPipe) c: Collection,
    @Query() q: ContentPageQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    const page = await this.presence.publicList(slug, c, q);
    if ('items' in page) return pageResponse(page, res);
  }
  @Get('collections/:collection/:id')
  @ApiOkResponse({ type: PublicContentDto })
  get(
    @Param('slug') slug: string,
    @Param('collection', collectionPipe) c: Collection,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.presence.publicList(slug, c, { limit: 100 }, id);
  }
}
