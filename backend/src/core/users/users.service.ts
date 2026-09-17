import { Injectable, NotFoundException } from '@nestjs/common';
import { Database } from '../../common/database.js';
import { ProfileDto, ConsentDto } from './users.dto.js';
import { paginate, PageQuery } from '../../common/pagination.js';
const safeUser = {
  id: true,
  email: true,
  displayName: true,
  locale: true,
  timezone: true,
  notificationPreferences: true,
} as const;
@Injectable()
export class UsersService {
  constructor(private db: Database) {}
  me(id: string) {
    return this.db.user.findUniqueOrThrow({ where: { id }, select: safeUser });
  }
  update(id: string, data: ProfileDto) {
    return this.db.user.update({
      where: { id },
      data: {
        ...data,
        notificationPreferences: data.notificationPreferences
          ? { ...data.notificationPreferences }
          : undefined,
      },
      select: safeUser,
    });
  }
  memberships(userId: string) {
    return this.db.membership.findMany({
      where: { userId },
      select: { organizationId: true, role: true, organization: { select: { name: true } } },
    });
  }
  sessions(userId: string, query: PageQuery) {
    const where = { userId, revokedAt: null, expiresAt: { gt: new Date() } };
    return paginate(
      query,
      (id) => this.db.session.findFirst({ where: { ...where, id }, select: { id: true } }),
      (args) =>
        this.db.session.findMany({
          where,
          select: { id: true, createdAt: true, expiresAt: true },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          ...args,
        }),
    );
  }
  consents(userId: string, query: PageQuery) {
    return paginate(
      query,
      (id) => this.db.consent.findFirst({ where: { id, userId }, select: { id: true } }),
      (args) =>
        this.db.consent.findMany({
          where: { userId },
          orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
          ...args,
        }),
    );
  }
  consent(userId: string, data: ConsentDto) {
    return this.db.consent.create({ data: { userId, ...data } });
  }
  subscriptions(userId: string, query: PageQuery) {
    return paginate(
      query,
      (id) => this.db.subscription.findFirst({ where: { id, userId }, select: { id: true } }),
      (args) =>
        this.db.subscription.findMany({
          where: { userId },
          select: {
            id: true,
            planCode: true,
            status: true,
            features: true,
            startsAt: true,
            endsAt: true,
            cancelAtPeriodEnd: true,
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          ...args,
        }),
    );
  }
  notifications(userId: string, query: PageQuery) {
    return paginate(
      query,
      (id) => this.db.notification.findFirst({ where: { id, userId }, select: { id: true } }),
      (args) =>
        this.db.notification.findMany({
          where: { userId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          ...args,
        }),
    );
  }
  async readNotification(userId: string, id: string) {
    const result = await this.db.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
    if (!result.count) throw new NotFoundException();
  }
}
