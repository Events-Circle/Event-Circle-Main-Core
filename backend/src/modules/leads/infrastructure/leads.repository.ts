import { eventNames } from '@events-circle/contracts';
import { Injectable } from '@nestjs/common';
import { Database } from '../../../common/database.js';
import { EventsService } from '../../../core/audit/events.service.js';
import { AuditService } from '../../../core/audit/audit.service.js';
import type { LeadInput } from '../domain/lead.js';
import type { LeadStage } from '@events-circle/contracts';
@Injectable()
export class LeadsRepository {
  constructor(
    private db: Database,
    private events: EventsService,
    private audit: AuditService,
  ) {}
  create(supplierId: string, organizationId: string, data: LeadInput) {
    return this.db.$transaction(async (tx) => {
      const lead = await tx.leadOpportunity.create({ data: { ...data, supplierId, organizationId } });
      await this.events.record(tx, eventNames.leadCreated, organizationId, { leadId: lead.id, supplierId });
      return { id: lead.id };
    });
  }
  list(organizationId: string) {
    return this.db.leadOpportunity.findMany({
      where: { organizationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
  }
  update(actorId: string, organizationId: string, id: string, stage: LeadStage) {
    return this.db.$transaction(async (tx) => {
      const result = await tx.leadOpportunity.updateMany({ where: { id, organizationId }, data: { stage } });
      if (!result.count) return null;
      await this.audit.record(tx, actorId, eventNames.leadStageChanged, id);
      await this.events.record(tx, eventNames.leadStageChanged, organizationId, { leadId: id, stage });
      return tx.leadOpportunity.findFirst({ where: { id, organizationId } });
    });
  }
}
