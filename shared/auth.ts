import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { PrismaClient } from '../generated/core/index.js';
import { credentials, registration, type TokenPair } from '../packages/contracts/index.js';
import { bearer, checkPassword, hashPassword, issuer, opaqueToken, tokenHash } from '../packages/runtime/tokens.js';
import { HttpError } from '../packages/runtime/http.js';

export async function authRoutes(app: FastifyInstance, db: PrismaClient, tokens: Awaited<ReturnType<typeof issuer>>) {
  const dummyHash = await hashPassword(opaqueToken());
  const authenticate = async (request: FastifyRequest) => {
    const identity = await tokens.verify(bearer(request.headers.authorization));
    const session = await db.session.findFirst({ where: { id: identity.sessionId, userId: identity.userId, revokedAt: null, expiresAt: { gt: new Date() } } });
    if (!session) throw new HttpError(401, 'UNAUTHORIZED');
    return identity;
  };
  const issueSession = async (userId: string): Promise<TokenPair> => {
    const refreshToken = opaqueToken();
    const session = await db.session.create({ data: {
      userId, expiresAt: new Date(Date.now() + 30 * 86400000),
      tokens: { create: { tokenHash: tokenHash(refreshToken) } },
    } });
    return { accessToken: await tokens.sign({ userId, sessionId: session.id }), refreshToken, expiresIn: 600, tokenType: 'Bearer' };
  };
  const authLimit = { rateLimit: { max: 10, timeWindow: '1 minute' } };
  app.post('/v1/auth/register', { config: authLimit }, async (request, reply) => {
    const input = registration.parse(request.body);
    const passwordHash = await hashPassword(input.password);
    const user = await db.$transaction(async tx => {
      const user = await tx.user.create({ data: { email: input.email, displayName: input.displayName, passwordHash } });
      await tx.auditLog.create({ data: { actorId: user.id, action: 'account.created' } });
      return user;
    });
    return reply.code(201).send(await issueSession(user.id));
  });
  app.post('/v1/auth/login', { config: authLimit }, async request => {
    const input = credentials.parse(request.body);
    const user = await db.user.findUnique({ where: { email: input.email } });
    const valid = await checkPassword(input.password, user?.passwordHash ?? dummyHash);
    if (!user || !valid) throw new HttpError(401, 'INVALID_CREDENTIALS');
    await db.auditLog.create({ data: { actorId: user.id, action: 'session.created' } });
    return issueSession(user.id);
  });
  app.post('/v1/auth/refresh', { config: authLimit }, async request => {
    const { refreshToken } = z.object({ refreshToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict().parse(request.body);
    const nextToken = opaqueToken();
    const result = await db.$transaction(async tx => {
      const previous = await tx.refreshToken.findUnique({ where: { tokenHash: tokenHash(refreshToken) }, include: { session: true } });
      if (!previous || previous.session.revokedAt || previous.session.expiresAt <= new Date()) return null;
      const consumed = await tx.refreshToken.updateMany({ where: { id: previous.id, usedAt: null }, data: { usedAt: new Date() } });
      if (consumed.count !== 1) {
        await tx.session.update({ where: { id: previous.sessionId }, data: { revokedAt: new Date() } });
        await tx.auditLog.create({ data: { actorId: previous.session.userId, action: 'session.refresh_reuse', targetId: previous.sessionId } });
        return null; // Commit the family revocation before returning an error.
      }
      await tx.refreshToken.create({ data: { sessionId: previous.sessionId, tokenHash: tokenHash(nextToken) } });
      return { userId: previous.session.userId, sessionId: previous.sessionId };
    });
    if (!result) throw new HttpError(401, 'INVALID_REFRESH_TOKEN');
    return { accessToken: await tokens.sign(result), refreshToken: nextToken, expiresIn: 600, tokenType: 'Bearer' };
  });
  app.post('/v1/auth/logout', async (request, reply) => {
    const identity = await authenticate(request);
    await db.$transaction([
      db.session.update({ where: { id: identity.sessionId }, data: { revokedAt: new Date() } }),
      db.auditLog.create({ data: { actorId: identity.userId, action: 'session.revoked', targetId: identity.sessionId } }),
    ]);
    return reply.code(204).send();
  });
  return authenticate;
}
