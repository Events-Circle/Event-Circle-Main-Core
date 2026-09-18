import { Injectable } from '@nestjs/common';
import { PermissionsService } from '../../../core/permissions/permissions.service.js';
import { CircleAiRepository } from '../infrastructure/circle-ai.repository.js';
import type { PageQuery } from '../../../common/pagination.js';
import type { RequestDto, EditPlanDto, DecisionDto } from '../api/circle-ai.dto.js';
@Injectable()
export class CircleAiService {
  constructor(
    private permissions: PermissionsService,
    private repository: CircleAiRepository,
  ) {}
  async brief(actor: string, org: string) {
    await this.permissions.require(actor, org, 'circle-ai.read');
    return this.repository.brief(org);
  }
  async list(actor: string, org: string, query: PageQuery) {
    await this.permissions.require(actor, org, 'circle-ai.read');
    return this.repository.list(org, query);
  }
  async create(actor: string, org: string, input: RequestDto) {
    await this.permissions.require(actor, org, 'circle-ai.write');
    return this.repository.create(actor, org, input);
  }
  async update(actor: string, org: string, id: string, input: EditPlanDto | DecisionDto) {
    await this.permissions.require(actor, org, 'decision' in input ? 'circle-ai.approve' : 'circle-ai.write');
    return this.repository.update(actor, org, id, input);
  }
}
