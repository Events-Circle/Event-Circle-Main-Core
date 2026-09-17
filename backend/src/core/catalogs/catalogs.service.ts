import { Injectable, BadRequestException } from '@nestjs/common';
import { Database } from '../../common/database.js';
import type { CatalogKind, Prisma } from '../../../generated/client/index.js';
@Injectable()
export class CatalogsService {
  constructor(private db: Database) {}
  list(kind: CatalogKind) {
    return this.db.coreCatalog.findMany({
      where: { kind, active: true },
      orderBy: { label: 'asc' },
      take: 100,
    });
  }
  async require(id: string | null | undefined, kind: CatalogKind, tx: Prisma.TransactionClient = this.db) {
    if (!id || !(await tx.coreCatalog.findFirst({ where: { id, kind, active: true } })))
      throw new BadRequestException('Invalid catalog reference');
    return id;
  }
}
