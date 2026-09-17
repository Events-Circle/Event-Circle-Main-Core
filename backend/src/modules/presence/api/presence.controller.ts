import { Controller, Get, Put, Body, Headers, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiHeader, ApiOkResponse } from '@nestjs/swagger';
import type { Identity } from '@events-circle/types';
import { Actor, AuthGuard } from '../../../core/auth/auth.guard.js';
import { PresenceService } from '../application/presence.service.js';
import { PresenceDto, PresenceResponseDto, PublicPresenceDto } from './presence.dto.js';
@ApiTags('presence')
@Controller('presence')
export class PresenceController {
  constructor(private presence: PresenceService) {}
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
  @Get('public/:slug') @ApiOkResponse({ type: PublicPresenceDto }) publicProfile(
    @Param('slug') slug: string,
  ) {
    return this.presence.publicProfile(slug);
  }
}
