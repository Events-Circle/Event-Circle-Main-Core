import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Headers,
  Param,
  Query,
  Res,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiHeader, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import type { Identity } from '@events-circle/types';
import { Actor, AuthGuard } from '../../../core/auth/auth.guard.js';
import { PageQuery, pageResponse, pageHeaders } from '../../../common/pagination.js';
import { CircleAiService } from '../application/circle-ai.service.js';
import { RequestDto, EditPlanDto, DecisionDto, PlanDto, BriefDto } from './circle-ai.dto.js';
@ApiTags('circle-ai')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Organization-Id', required: true })
@UseGuards(AuthGuard)
@Controller('circle-ai')
export class CircleAiController {
  constructor(private service: CircleAiService) {}
  @Get('brief')
  @ApiOkResponse({ type: BriefDto })
  brief(@Actor() a: Identity, @Headers('x-organization-id') org: string) {
    return this.service.brief(a.userId, org);
  }
  @Get('plans')
  @ApiOkResponse({ type: [PlanDto], headers: pageHeaders })
  async list(
    @Actor() a: Identity,
    @Headers('x-organization-id') org: string,
    @Query() q: PageQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    return pageResponse(await this.service.list(a.userId, org, q), res);
  }
  @Post('plans')
  @ApiCreatedResponse({ type: PlanDto })
  create(@Actor() a: Identity, @Headers('x-organization-id') org: string, @Body() data: RequestDto) {
    return this.service.create(a.userId, org, data);
  }
  @Patch('plans/:id')
  @ApiOkResponse({ type: PlanDto })
  edit(
    @Actor() a: Identity,
    @Headers('x-organization-id') org: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: EditPlanDto,
  ) {
    return this.service.update(a.userId, org, id, data);
  }
  @Post('plans/:id/decision')
  @ApiCreatedResponse({ type: PlanDto })
  decide(
    @Actor() a: Identity,
    @Headers('x-organization-id') org: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: DecisionDto,
  ) {
    return this.service.update(a.userId, org, id, data);
  }
}
