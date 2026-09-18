import { Module } from '@nestjs/common';
import { CircleAiController } from './api/circle-ai.controller.js';
import { CircleAiService } from './application/circle-ai.service.js';
import { CircleAiRepository } from './infrastructure/circle-ai.repository.js';
@Module({ controllers: [CircleAiController], providers: [CircleAiService, CircleAiRepository] })
export class CircleAiModule {}
