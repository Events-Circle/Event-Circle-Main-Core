import { Module, type DynamicModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { CoreModule } from './core/core.module.js';
import { PresenceModule } from './modules/presence/presence.module.js';
import { LeadsModule } from './modules/leads/leads.module.js';
import type { Runtime } from './config/runtime.js';
@Module({})
export class AppModule {
  static forRoot(config: Runtime): DynamicModule {
    return {
      module: AppModule,
      imports: [
        CoreModule.forRoot(config),
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
        ...(config.enabled.includes('presence') ? [PresenceModule] : []),
        ...(config.enabled.includes('leads') ? [LeadsModule] : []),
      ],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    };
  }
}
