import { randomUUID } from 'node:crypto';
import type { Prisma } from '../../../generated/client/index.js';
import { Injectable } from '@nestjs/common';
import type { DomainEvent } from '@events-circle/contracts';
import { requestContext } from '../../common/request-context.js';
/** In-process delivery port. Durable outbox rows are the source for retryable work.
 * No external side-effect consumers are activated in this foundation. */
@Injectable()
export class EventsService {
  record(
    tx: Prisma.TransactionClient,
    name: string,
    organizationId: string,
    payload: Prisma.InputJsonValue,
    correlationId = requestContext.getStore()?.correlationId ?? randomUUID(),
  ) {
    return tx.outboxEvent.create({ data: { name, organizationId, payload, correlationId } });
  }
  private listeners = new Map<string, Set<(event: DomainEvent) => Promise<void>>>();
  subscribe(name: string, handler: (event: DomainEvent) => Promise<void>) {
    const list = this.listeners.get(name) ?? new Set();
    list.add(handler);
    this.listeners.set(name, list);
    return () => list.delete(handler);
  }
  async publish(event: DomainEvent) {
    const handlers = [...(this.listeners.get(event.name) ?? [])];
    if (!handlers.length) throw new Error('No event consumer registered');
    for (const handler of handlers) await handler(event);
  }
  consumerNames() {
    return [...this.listeners.entries()].filter(([, handlers]) => handlers.size).map(([name]) => name);
  }
}
