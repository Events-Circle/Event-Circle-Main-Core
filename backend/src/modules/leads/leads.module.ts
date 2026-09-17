import { Module } from '@nestjs/common';
import { LeadsController } from './api/leads.controller.js';
import { LeadsService } from './application/leads.service.js';
import { LeadsRepository } from './infrastructure/leads.repository.js';
@Module({ controllers: [LeadsController], providers: [LeadsService, LeadsRepository] })
export class LeadsModule {}
