import { Controller, Get, Put, Post, Body, Headers, Param, UseGuards, Res } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiHeader, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import type { Identity } from '@events-circle/types';
import { Actor, AuthGuard } from '../../../core/auth/auth.guard.js';
import { PresenceService } from '../application/presence.service.js';
import {
  PresenceDto,
  PresenceResponseDto,
  PublicPresenceDto,
  ReadinessDto,
  ShareDto,
} from './presence.dto.js';
import { VersionDto } from './content.dto.js';
@ApiTags('presence')
@Controller('presence')
export class PresenceController {
  constructor(private presence: PresenceService) {}
  @Get('readiness')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Organization-Id', required: true })
  @ApiOkResponse({ type: ReadinessDto })
  readiness(@Actor() a: Identity, @Headers('x-organization-id') org: string) {
    return this.presence.readiness(a.userId, org);
  }
  @Post('profile/publish')
  @ApiCreatedResponse({ type: PresenceResponseDto })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Organization-Id', required: true })
  publish(@Actor() a: Identity, @Headers('x-organization-id') org: string, @Body() data: VersionDto) {
    return this.presence.publication(a.userId, org, true, data.version);
  }
  @Post('profile/unpublish')
  @ApiCreatedResponse({ type: PresenceResponseDto })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Organization-Id', required: true })
  unpublish(@Actor() a: Identity, @Headers('x-organization-id') org: string, @Body() data: VersionDto) {
    return this.presence.publication(a.userId, org, false, data.version);
  }
  @Get('public/:slug/share')
  @ApiOkResponse({ type: ShareDto })
  share(@Param('slug') slug: string) {
    return this.presence.share(slug);
  }
  @Get('profile')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Organization-Id', required: true })
  @ApiOkResponse({ type: PresenceResponseDto })
  current(@Actor() a: Identity, @Headers('x-organization-id') org: string) {
    return this.presence.current(a.userId, org);
  }
  @Put('profile')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Organization-Id', required: true })
  @ApiOkResponse({ type: PresenceResponseDto })
  save(@Actor() a: Identity, @Headers('x-organization-id') org: string, @Body() data: PresenceDto) {
    return this.presence.save(a.userId, org, data);
  }
  @Get('public/:slug') @ApiOkResponse({ type: PublicPresenceDto }) async publicProfile(
    @Param('slug') slug: string,
    @Headers('if-none-match') match: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const body = await this.presence.publicProfile(slug);
    const etag = `"${createHash('sha256').update(JSON.stringify(body)).digest('hex')}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, no-cache, must-revalidate');
    if (
      match
        ?.split(',')
        .map((value) => value.trim())
        .includes(etag)
    ) {
      res.status(304);
      return;
    }
    return body;
  }
}
