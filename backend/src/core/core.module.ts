import { Global, Module, type DynamicModule } from '@nestjs/common';
import { Database } from '../common/database.js';
import { RUNTIME, type Runtime } from '../config/runtime.js';
import { AuthService } from './auth/auth.service.js';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthController } from './auth/auth.controller.js';
import { PermissionsService } from './permissions/permissions.service.js';
import { SuppliersService } from './suppliers/suppliers.service.js';
import { SuppliersController } from './suppliers/suppliers.controller.js';
import { UsersService } from './users/users.service.js';
import { UsersController } from './users/users.controller.js';
import { HealthController } from './health/health.controller.js';
import { RegistryController } from './module-registry/registry.controller.js';
import { EventsService } from './audit/events.service.js';
import { AuditService } from './audit/audit.service.js';
import { OutboxWorker } from './audit/outbox.worker.js';
import { MediaService } from './media/media.service.js';
import { MediaController } from './media/media.controller.js';
import { ObjectStore } from './media/object-store.js';
import { CatalogsService } from './catalogs/catalogs.service.js';
import { CatalogsController } from './catalogs/catalogs.controller.js';
@Global()
@Module({})
export class CoreModule {
  static forRoot(config: Runtime): DynamicModule {
    return {
      module: CoreModule,
      providers: [
        { provide: RUNTIME, useValue: config },
        Database,
        AuthService,
        AuthGuard,
        PermissionsService,
        SuppliersService,
        UsersService,
        EventsService,
        AuditService,
        OutboxWorker,
        MediaService,
        ObjectStore,
        CatalogsService,
      ],
      controllers: [
        AuthController,
        SuppliersController,
        UsersController,
        HealthController,
        RegistryController,
        MediaController,
        CatalogsController,
      ],
      exports: [
        RUNTIME,
        Database,
        AuthGuard,
        AuthService,
        PermissionsService,
        SuppliersService,
        EventsService,
        AuditService,
        MediaService,
        CatalogsService,
      ],
    };
  }
}
