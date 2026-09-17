import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SuppliersService } from '../../../core/suppliers/suppliers.service.js';
import { PermissionsService } from '../../../core/permissions/permissions.service.js';
import { LeadsRepository } from '../infrastructure/leads.repository.js';
import { hasContact, type LeadInput } from '../domain/lead.js';
import type { LeadStage } from '@events-circle/contracts';
@Injectable()
export class LeadsService {
  constructor(
    private suppliers: SuppliersService,
    private permissions: PermissionsService,
    private repository: LeadsRepository,
  ) {}
  async capture(supplierId: string, data: LeadInput) {
    if (!hasContact(data)) throw new BadRequestException();
    const supplier = await this.suppliers.inquiryTarget(supplierId);
    return this.repository.create(supplier.id, supplier.organizationId, data);
  }
  async list(userId: string, org: string) {
    return this.repository.list(await this.permissions.require(userId, org, 'leads.read'));
  }
  async update(userId: string, org: string, id: string, stage: LeadStage) {
    await this.permissions.require(userId, org, 'leads.write');
    const lead = await this.repository.update(userId, org, id, stage);
    if (!lead) throw new NotFoundException();
    return lead;
  }
}
