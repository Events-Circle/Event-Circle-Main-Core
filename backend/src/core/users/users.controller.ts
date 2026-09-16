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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import type { Identity } from '@events-circle/types';
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
  @Get('sessions') @ApiOkResponse({ type: [SessionDto] }) sessions(@Actor() a: Identity) {
    return this.users.sessions(a.userId);
  }
  @Delete('sessions/:id') @HttpCode(204) revoke(
    @Actor() a: Identity,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.auth.revoke(a.userId, id);
  }
  @Get('consents') @ApiOkResponse({ type: [ConsentResponseDto] }) consents(@Actor() a: Identity) {
    return this.users.consents(a.userId);
  }
  @Post('consents') @ApiCreatedResponse({ type: ConsentResponseDto }) consent(
    @Actor() a: Identity,
    @Body() data: ConsentDto,
  ) {
    return this.users.consent(a.userId, data);
  }
  @Get('subscriptions') @ApiOkResponse({ type: [SubscriptionDto] }) subscriptions(@Actor() a: Identity) {
    return this.users.subscriptions(a.userId);
  }
  @Get('access')
  @ApiOkResponse({ type: AccessDto })
  access(@Actor() a: Identity) {
    return this.permissions.access(a.userId);
  }
  @Get('notifications') @ApiOkResponse({ type: [NotificationDto] }) notifications(@Actor() a: Identity) {
    return this.users.notifications(a.userId);
  }
  @Patch('notifications/:id/read') @HttpCode(204) read(
    @Actor() a: Identity,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.users.readNotification(a.userId, id);
  }
}
