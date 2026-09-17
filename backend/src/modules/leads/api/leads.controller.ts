import { Controller, Get, Post, Patch, Body, Headers, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiHeader, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Identity } from '@events-circle/types';
import { Actor, AuthGuard } from '../../../core/auth/auth.guard.js';
import { LeadsService } from '../application/leads.service.js';
import { LeadDto, StageDto, LeadResponseDto, ReceiptDto } from './leads.dto.js';
@ApiTags('leads')
@Controller('leads')
export class LeadsController {
  constructor(private leads: LeadsService) {}
  @Post('public/:supplierId')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiCreatedResponse({ type: ReceiptDto })
  capture(@Param('supplierId', ParseUUIDPipe) id: string, @Body() data: LeadDto) {
    return this.leads.capture(id, data);
  }
  @Get()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Organization-Id', required: true })
  @ApiOkResponse({ type: [LeadResponseDto] })
  list(@Actor() a: Identity, @Headers('x-organization-id') org: string) {
    return this.leads.list(a.userId, org);
  }
  @Patch(':id/stage')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Organization-Id', required: true })
  @ApiOkResponse({ type: LeadResponseDto })
  update(
    @Actor() a: Identity,
    @Headers('x-organization-id') org: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: StageDto,
  ) {
    return this.leads.update(a.userId, org, id, data.stage);
  }
}
