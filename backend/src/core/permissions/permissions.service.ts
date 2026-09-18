import { Inject, Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { Database } from '../../common/database.js';
import { RUNTIME, type Runtime } from '../../config/runtime.js';
const rolePermissions: Record<string, string[]> = {
  OWNER: [
    'circle-ai.read',
    'circle-ai.write',
    'circle-ai.approve',
    'suppliers.read',
    'suppliers.write',
    'presence.read',
    'presence.write',
    'leads.read',
    'leads.write',
    'media.read',
    'media.write',
  ],
  EDITOR: [
    'circle-ai.read',
    'circle-ai.write',
    'suppliers.read',
    'presence.read',
    'presence.write',
    'leads.read',
    'leads.write',
    'media.read',
    'media.write',
  ],
  VIEWER: ['suppliers.read', 'presence.read', 'leads.read', 'media.read', 'circle-ai.read'],
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
      !['suppliers', 'media'].includes(module) &&
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
          'circle-ai.read',
          'circle-ai.write',
          'circle-ai.approve',
          'presence.write',
          'leads.read',
          'leads.write',
          ...paid.flatMap((p) => p.features),
        ]),
      ].filter((p) => this.config.enabled.includes(p.split('.')[0]!)),
    };
  }
}
