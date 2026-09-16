import { z } from 'zod';
import { PrismaClient } from '../generated/core/index.js';
import type { Config } from '../packages/runtime/config.js';
import { httpServer, HttpError } from '../packages/runtime/http.js';
import { issuer } from '../packages/runtime/tokens.js';
import { freeFeatures, identifier, pagination } from '../packages/contracts/index.js';
import { authRoutes } from './auth.js';

export async function createCore(config: Config, db = new PrismaClient()) {
  const app = await httpServer(config, 'core', () => db.$queryRaw`SELECT 1`);
  app.addHook('onClose', async () => { await db.$disconnect(); });
  const tokens = await issuer(config);
  const authenticate = await authRoutes(app, db, tokens);
  app.get('/.well-known/jwks.json', async () => tokens.jwks);
  const profileSelect = { id: true, email: true, displayName: true, locale: true, timezone: true, notificationPreferences: true, createdAt: true } as const;
  app.get('/v1/me', async request => {
    const { userId } = await authenticate(request);
    return db.user.findUniqueOrThrow({ where: { id: userId }, select: profileSelect });
  });
  app.patch('/v1/me', async request => {
    const { userId } = await authenticate(request);
    const data = z.object({
      displayName: z.string().trim().min(1).max(100).optional(),
      locale: z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/).max(35).optional(),
      timezone: z.string().max(100).refine(value => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; } }).optional(),
      notificationPreferences: z.object({ email: z.boolean(), push: z.boolean() }).strict().optional(),
    }).strict().parse(request.body);
    return db.$transaction(async tx => {
      const profile = await tx.user.update({ where: { id: userId }, data, select: profileSelect });
      await tx.auditLog.create({ data: { actorId: userId, action: 'profile.updated' } });
      return profile;
    });
  });
  app.get('/v1/access', async request => {
    const { userId } = await authenticate(request);
    const now = new Date();
    const active = await db.subscription.findMany({ where: { userId, status: { in: ['active', 'trialing'] }, startsAt: { lte: now }, endsAt: { gt: now } }, select: { features: true } });
    return { userId, features: [...new Set([...freeFeatures, ...active.flatMap(s => s.features)])] };
  });
  app.get('/v1/subscriptions', async request => {
    const { userId } = await authenticate(request);
    return { items: await db.subscription.findMany({ where: { userId }, select: { id: true, planCode: true, status: true, startsAt: true, endsAt: true, cancelAtPeriodEnd: true }, orderBy: { createdAt: 'desc' }, take: 100 }) };
  });
  app.get('/v1/sessions', async request => {
    const { userId } = await authenticate(request);
    return { items: await db.session.findMany({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, createdAt: true, expiresAt: true }, orderBy: { createdAt: 'desc' }, take: 100 }) };
  });
  app.delete('/v1/sessions/:id', async (request, reply) => {
    const { userId } = await authenticate(request);
    const { id } = z.object({ id: identifier }).parse(request.params);
    const changed = await db.$transaction(async tx => {
      const result = await tx.session.updateMany({ where: { id, userId, revokedAt: null }, data: { revokedAt: new Date() } });
      if (result.count) await tx.auditLog.create({ data: { actorId: userId, action: 'session.revoked', targetId: id } });
      return result.count;
    });
    if (!changed) throw new HttpError(404, 'NOT_FOUND');
    return reply.code(204).send();
  });
  app.post('/v1/consents', async (request, reply) => {
    const { userId } = await authenticate(request);
    const data = z.object({ purpose: z.enum(['marketing', 'analytics']), version: z.string().regex(/^[a-zA-Z0-9._-]{1,40}$/), granted: z.boolean() }).strict().parse(request.body);
    const consent = await db.$transaction(async tx => {
      const row = await tx.consent.create({ data: { userId, ...data } });
      await tx.auditLog.create({ data: { actorId: userId, action: 'consent.recorded', targetId: row.id } });
      return row;
    });
    return reply.code(201).send(consent);
  });
  app.get('/v1/consents', async request => {
    const { userId } = await authenticate(request);
    const { limit, offset } = pagination.parse(request.query);
    return { items: await db.consent.findMany({ where: { userId }, orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }], take: limit, skip: offset }) };
  });
  app.get('/v1/notifications', async request => {
    const { userId } = await authenticate(request);
    const { limit, offset } = pagination.parse(request.query);
    return { items: await db.notification.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit, skip: offset }) };
  });
  app.patch('/v1/notifications/:id/read', async (request, reply) => {
    const { userId } = await authenticate(request);
    const { id } = z.object({ id: identifier }).parse(request.params);
    const result = await db.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } });
    if (!result.count) throw new HttpError(404, 'NOT_FOUND');
    return reply.code(204).send();
  });
  return app;
}
