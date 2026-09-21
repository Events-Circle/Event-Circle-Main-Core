export const leadStages = ['NEW', 'HOT', 'FOLLOW_UP', 'QUALIFIED', 'WON', 'LOST'] as const;
export type LeadStage = (typeof leadStages)[number];
export interface DomainEvent<T = unknown> {
  id: string;
  name: string;
  organizationId: string;
  occurredAt: string;
  correlationId: string;
  payload: T;
}
export interface LeadCreated {
  leadId: string;
  supplierId: string;
}
export const eventNames = {
  leadCreated: 'leads.lead.created.v1',
  leadStageChanged: 'leads.stage.changed.v1',
  presenceUpdated: 'presence.profile.updated.v1',
} as const;
export * from './presence.js';
export * from './circle-ai.js';
