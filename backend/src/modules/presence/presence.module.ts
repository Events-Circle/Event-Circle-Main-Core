import { Module } from '@nestjs/common';
import { PresenceController } from './api/presence.controller.js';
import { PresenceService } from './application/presence.service.js';
import { PresenceRepository } from './infrastructure/expansion.repository.js';
import { ContentController, PublicContentController } from './api/content.controller.js';
import { PRESENCE_QUERIES } from './contracts/index.js';
@Module({
  controllers: [PresenceController, ContentController, PublicContentController],
  providers: [
    PresenceService,
    PresenceRepository,
    { provide: PRESENCE_QUERIES, useExisting: PresenceService },
  ],
  exports: [PRESENCE_QUERIES],
})
export class PresenceModule {}
