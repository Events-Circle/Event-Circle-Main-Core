import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Database } from '../../common/database.js';
import { requestContext } from '../../common/request-context.js';
import { RUNTIME, type Runtime } from '../../config/runtime.js';
import { EventsService } from './events.service.js';

/** At-least-once dispatch. Consumers must deduplicate by event.id.
 * Unhandled events remain pending; no email, AI or provider operation is enabled implicitly.
 */
@Injectable()
export class OutboxWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  constructor(
    private db: Database,
    private events: EventsService,
    @Inject(RUNTIME) private config: Runtime,
  ) {}
  onModuleInit() {
    if (!this.config.outboxWorkerEnabled) return;
    this.timer = setInterval(() => {
      if (!this.running)
        this.running = this.drainOnce()
          .catch(() => console.error('Outbox dispatch unavailable'))
          .finally(() => {
            this.running = undefined;
          });
    }, 1000);
    this.timer.unref();
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
  async drainOnce() {
    const names = this.events.consumerNames();
    if (!names.length) return;
    const now = new Date();
    const eligible = {
      deliveredAt: null,
      attempts: { lt: 10 },
      nextAttemptAt: { lte: now },
      OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
    };
    const pending = await this.db.outboxEvent.findMany({
      where: { ...eligible, name: { in: names } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 25,
    });
    for (const row of pending) {
      const claimToken = randomUUID();
      const claimed = await this.db.outboxEvent.updateMany({
        where: { id: row.id, ...eligible },
        data: { claimToken, lockedUntil: new Date(Date.now() + 60000), attempts: { increment: 1 } },
      });
      if (!claimed.count) continue;
      try {
        await requestContext.run({ correlationId: row.correlationId }, () =>
          this.events.publish({
            id: row.id,
            name: row.name,
            organizationId: row.organizationId,
            occurredAt: row.createdAt.toISOString(),
            correlationId: row.correlationId,
            payload: row.payload,
          }),
        );
        await this.db.outboxEvent.updateMany({
          where: { id: row.id, claimToken },
          data: { deliveredAt: new Date(), lockedUntil: null, claimToken: null, lastError: null },
        });
      } catch {
        await this.db.outboxEvent.updateMany({
          where: { id: row.id, claimToken },
          data: {
            lockedUntil: null,
            claimToken: null,
            lastError: 'HANDLER_FAILED',
            nextAttemptAt: new Date(Date.now() + Math.min(3600000, 1000 * 2 ** row.attempts)),
          },
        });
      }
    }
  }
}
