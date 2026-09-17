import { Module } from '@nestjs/common';
import { PresenceController } from './api/presence.controller.js';
import { PresenceService } from './application/presence.service.js';
import { PresenceRepository } from './infrastructure/presence.repository.js';
@Module({ controllers: [PresenceController], providers: [PresenceService, PresenceRepository] })
export class PresenceModule {}
