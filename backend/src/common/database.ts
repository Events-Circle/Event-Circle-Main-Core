import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { PrismaClient } from '../../generated/client/index.js';
@Injectable()
export class Database extends PrismaClient implements OnApplicationShutdown {
  // Workers finish their onModuleDestroy hooks before the shared connection closes.
  async onApplicationShutdown() {
    await this.$disconnect();
  }
}
