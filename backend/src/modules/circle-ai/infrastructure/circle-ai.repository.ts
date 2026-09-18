import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { Database } from '../../../common/database.js';
import { AuditService } from '../../../core/audit/audit.service.js';
import { EventsService } from '../../../core/audit/events.service.js';
import { preparePlan } from '../domain/planning.js';
import type { RequestDto, EditPlanDto, DecisionDto } from '../api/circle-ai.dto.js';
import { paginate, type PageQuery } from '../../../common/pagination.js';
const select = {
  id: true,
  kind: true,
  prompt: true,
  title: true,
  response: true,
  draft: true,
  blockedReason: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} as const;
@Injectable()
export class CircleAiRepository {
  constructor(
    private db: Database,
    private audit: AuditService,
    private events: EventsService,
  ) {}
  list(organizationId: string, query: PageQuery) {
    return paginate(
      query,
      (id) => this.db.circleAiPlan.findFirst({ where: { id, organizationId }, select: { id: true } }),
      (args) =>
        this.db.circleAiPlan.findMany({
          where: { organizationId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select,
          ...args,
        }),
    );
  }
  async brief(organizationId: string) {
    const count = (status: string) => this.db.circleAiPlan.count({ where: { organizationId, status } });
    const [draftCount, approvedCount, rejectedCount] = await Promise.all(
      ['DRAFT', 'APPROVED', 'REJECTED'].map(count),
    );
    return {
      providerReady: false,
      executionReady: false,
      draftCount,
      approvedCount,
      rejectedCount,
      notice:
        'Planning foundation: no AI provider or external execution adapter is connected. Approval records a plan only. Lead, campaign and publishing metrics are unavailable, not zero.',
    };
  }
  async create(actorId: string, organizationId: string, input: RequestDto) {
    const where = { organizationId_requestId: { organizationId, requestId: input.requestId } };
    const replay = async () => {
      const existing = await this.db.circleAiPlan.findUnique({ where });
      if (!existing) return null;
      if (existing.prompt !== input.prompt || existing.kind !== input.kind || existing.actorId !== actorId)
        throw new ConflictException('Request ID was already used');
      return this.db.circleAiPlan.findUnique({ where, select });
    };
    const existing = await replay();
    if (existing) return existing;
    try {
      return await this.db.$transaction(async (tx) => {
        const row = await tx.circleAiPlan.create({
          data: { actorId, organizationId, ...input, ...preparePlan(input.prompt, input.kind) },
          select,
        });
        await this.audit.record(tx, actorId, 'circle-ai.plan.created.v1', row.id);
        await this.events.record(tx, 'circle-ai.plan.created.v1', organizationId, {
          planId: row.id,
          kind: row.kind,
        });
        return row;
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        const recovered = await replay();
        if (recovered) return recovered;
      }
      throw error;
    }
  }
  async update(actorId: string, organizationId: string, id: string, input: EditPlanDto | DecisionDto) {
    return this.db.$transaction(async (tx) => {
      const row = await tx.circleAiPlan.findFirst({ where: { id, organizationId }, select });
      if (!row) throw new NotFoundException();
      const changed = await tx.circleAiPlan.updateMany({
        where: { id, organizationId, version: input.version, status: 'DRAFT' },
        data: {
          ...('draft' in input ? { draft: input.draft } : { status: input.decision }),
          version: { increment: 1 },
        },
      });
      if (!changed.count) throw new ConflictException('Reload the current draft before changing it');
      const event = 'draft' in input ? 'circle-ai.plan.edited.v1' : 'circle-ai.plan.decided.v1';
      await this.audit.record(tx, actorId, event, id);
      await this.events.record(tx, event, organizationId, {
        planId: id,
        ...('decision' in input ? { decision: input.decision } : {}),
      });
      return tx.circleAiPlan.findFirstOrThrow({ where: { id, organizationId }, select });
    });
  }
}
