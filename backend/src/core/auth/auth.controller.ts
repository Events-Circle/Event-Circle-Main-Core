import { Body, Controller, Get, Post, HttpCode, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Identity } from '@events-circle/types';
import { AuthService } from './auth.service.js';
import { AuthGuard, Actor } from './auth.guard.js';
import { RegisterDto, LoginDto, RefreshDto, TokensDto } from './auth.dto.js';
@ApiTags('core.auth')
@Controller('core/auth')
export class AuthController {
  constructor(private auth: AuthService) {}
  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiCreatedResponse({ type: TokensDto })
  register(@Body() input: RegisterDto) {
    return this.auth.register(input);
  }
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOkResponse({ type: TokensDto })
  login(@Body() input: LoginDto) {
    return this.auth.login(input);
  }
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOkResponse({ type: TokensDto })
  refresh(@Body() input: RefreshDto) {
    return this.auth.refresh(input.refreshToken);
  }
  @Post('logout') @HttpCode(204) @ApiBearerAuth() @UseGuards(AuthGuard) logout(@Actor() identity: Identity) {
    return this.auth.revoke(identity.userId, identity.sessionId);
  }
  @Get('jwks') jwks() {
    return this.auth.jwks();
  }
}
