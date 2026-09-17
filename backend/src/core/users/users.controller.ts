import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import type { Identity } from '@events-circle/types';
import type { Response } from 'express';
import { PageQuery, pageResponse, pageHeaders } from '../../common/pagination.js';
import { Actor, AuthGuard } from '../auth/auth.guard.js';
import { AuthService } from '../auth/auth.service.js';
import { PermissionsService } from '../permissions/permissions.service.js';
import { UsersService } from './users.service.js';
import {
  ProfileDto,
  ConsentDto,
  MeDto,
  AccessDto,
  MembershipDto,
  SessionDto,
  ConsentResponseDto,
  SubscriptionDto,
  NotificationDto,
} from './users.dto.js';
@ApiTags('core.account')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('core')
export class UsersController {
  constructor(
    private users: UsersService,
    private auth: AuthService,
    private permissions: PermissionsService,
  ) {}
  @Get('me') @ApiOkResponse({ type: MeDto }) me(@Actor() a: Identity) {
    return this.users.me(a.userId);
  }
  @Patch('me') @ApiOkResponse({ type: MeDto }) update(@Actor() a: Identity, @Body() data: ProfileDto) {
    return this.users.update(a.userId, data);
  }
  @Get('memberships') @ApiOkResponse({ type: [MembershipDto] }) memberships(@Actor() a: Identity) {
    return this.users.memberships(a.userId);
  }
  @Get('sessions') @ApiOkResponse({ type: [SessionDto], headers: pageHeaders }) async sessions(
    @Actor() a: Identity,
    @Query() query: PageQuery,
    @Res({ passthrough: true }) response: Response,
  ) {
    return pageResponse(await this.users.sessions(a.userId, query), response);
  }
  @Delete('sessions/:id') @HttpCode(204) revoke(
    @Actor() a: Identity,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.auth.revoke(a.userId, id);
  }
  @Get('consents') @ApiOkResponse({ type: [ConsentResponseDto], headers: pageHeaders }) async consents(
    @Actor() a: Identity,
    @Query() query: PageQuery,
    @Res({ passthrough: true }) response: Response,
  ) {
    return pageResponse(await this.users.consents(a.userId, query), response);
  }
  @Post('consents') @ApiCreatedResponse({ type: ConsentResponseDto }) consent(
    @Actor() a: Identity,
    @Body() data: ConsentDto,
  ) {
    return this.users.consent(a.userId, data);
  }
  @Get('subscriptions') @ApiOkResponse({ type: [SubscriptionDto], headers: pageHeaders }) async subscriptions(
    @Actor() a: Identity,
    @Query() query: PageQuery,
    @Res({ passthrough: true }) response: Response,
  ) {
    return pageResponse(await this.users.subscriptions(a.userId, query), response);
  }
  @Get('access')
  @ApiOkResponse({ type: AccessDto })
  access(@Actor() a: Identity) {
    return this.permissions.access(a.userId);
  }
  @Get('notifications') @ApiOkResponse({ type: [NotificationDto], headers: pageHeaders }) async notifications(
    @Actor() a: Identity,
    @Query() query: PageQuery,
    @Res({ passthrough: true }) response: Response,
  ) {
    return pageResponse(await this.users.notifications(a.userId, query), response);
  }
  @Patch('notifications/:id/read') @HttpCode(204) read(
    @Actor() a: Identity,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.users.readNotification(a.userId, id);
  }
}
