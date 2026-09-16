import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/client/index.js';
@Injectable()
export class AuditService {
  record(tx: Prisma.TransactionClient, actorId: string | null, action: string, targetId?: string) {
    return tx.auditLog.create({ data: { actorId, action, targetId } });
  }
}
