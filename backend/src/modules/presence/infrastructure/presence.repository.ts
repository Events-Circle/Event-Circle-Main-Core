import { eventNames } from '@events-circle/contracts';
import { Injectable } from '@nestjs/common';
import { Database } from '../../../common/database.js';
import { EventsService } from '../../../core/audit/events.service.js';
import { AuditService } from '../../../core/audit/audit.service.js';
import type { Profile } from '../domain/profile.js';
@Injectable()
export class PresenceRepository {
  constructor(
    private db: Database,
    private events: EventsService,
    private audit: AuditService,
  ) {}
  find(supplierId: string) {
    return this.db.presenceProfile.findUnique({ where: { supplierId } });
  }
  publicProfile(slug: string) {
    return this.db.presenceProfile.findFirst({ where: { slug, published: true } });
  }
  save(actorId: string, organizationId: string, data: Profile) {
    return this.db.$transaction(async (tx) => {
      const profile = await tx.presenceProfile.upsert({
        where: { supplierId: data.supplierId },
        create: data,
        update: data,
      });
      await this.audit.record(tx, actorId, 'presence.updated', profile.id);
      await this.events.record(tx, eventNames.presenceUpdated, organizationId, {
        profileId: profile.id,
        supplierId: profile.supplierId,
        published: profile.published,
      });
      return profile;
    });
  }
}
