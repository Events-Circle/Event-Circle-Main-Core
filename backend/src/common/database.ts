import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/client/index.js';
@Injectable()
export class Database extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
