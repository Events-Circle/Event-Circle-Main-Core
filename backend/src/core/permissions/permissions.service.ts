import { Inject, Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { Database } from '../../common/database.js';
import { RUNTIME, type Runtime } from '../../config/runtime.js';
const rolePermissions: Record<string, string[]> = {
  OWNER: [
    'suppliers.read',
    'suppliers.write',
    'presence.read',
    'presence.write',
    'leads.read',
    'leads.write',
  ],
  EDITOR: ['suppliers.read', 'presence.read', 'presence.write', 'leads.read', 'leads.write'],
  VIEWER: ['suppliers.read', 'presence.read', 'leads.read'],
};
@Injectable()
export class PermissionsService {
  constructor(
    private db: Database,
    @Inject(RUNTIME) private config: Runtime,
  ) {}
  async require(userId: string, organizationId: string | undefined, permission: string) {
    if (!organizationId || !isUUID(organizationId)) throw new BadRequestException();
    const membership = await this.db.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    if (!membership || !rolePermissions[membership.role]?.includes(permission))
      throw new ForbiddenException();
    const module = permission.split('.')[0]!;
    if (
      module !== 'suppliers' &&
      (!this.config.enabled.includes(module) || !(await this.access(userId)).features.includes(permission))
    )
      throw new ForbiddenException();
    return organizationId;
  }
  async access(userId: string) {
    const now = new Date();
    const paid = await this.db.subscription.findMany({
      where: { userId, status: { in: ['active', 'trialing'] }, startsAt: { lte: now }, endsAt: { gt: now } },
      select: { features: true },
    });
    return {
      userId,
      features: [
        ...new Set([
          'presence.read',
          'presence.write',
          'leads.read',
          'leads.write',
          ...paid.flatMap((p) => p.features),
        ]),
      ].filter((p) => this.config.enabled.includes(p.split('.')[0]!)),
    };
  }
}
