import { Controller, Post, Get, Put, Body, Headers, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiHeader, ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import type { Identity } from '@events-circle/types';
import { AuthGuard, Actor } from '../auth/auth.guard.js';
import { PermissionsService } from '../permissions/permissions.service.js';
import { SuppliersService } from './suppliers.service.js';
import { SupplierDto, SupplierResponseDto } from './suppliers.dto.js';
@ApiTags('core.suppliers')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('core/suppliers')
export class SuppliersController {
  constructor(
    private suppliers: SuppliersService,
    private permissions: PermissionsService,
  ) {}
  @Post() @ApiCreatedResponse({ type: SupplierResponseDto }) create(
    @Actor() actor: Identity,
    @Body() data: SupplierDto,
  ) {
    return this.suppliers.create(actor.userId, data);
  }
  @Put('current')
  @ApiHeader({ name: 'X-Organization-Id', required: true })
  @ApiOkResponse({ type: SupplierResponseDto })
  async update(
    @Actor() actor: Identity,
    @Headers('x-organization-id') org: string,
    @Body() data: SupplierDto,
  ) {
    return this.suppliers.update(
      actor.userId,
      await this.permissions.require(actor.userId, org, 'suppliers.write'),
      data,
    );
  }
  @Get('current')
  @ApiHeader({ name: 'X-Organization-Id', required: true })
  @ApiOkResponse({ type: SupplierResponseDto })
  async current(@Actor() actor: Identity, @Headers('x-organization-id') org: string) {
    return this.suppliers.forOrganization(
      await this.permissions.require(actor.userId, org, 'suppliers.read'),
    );
  }
}
