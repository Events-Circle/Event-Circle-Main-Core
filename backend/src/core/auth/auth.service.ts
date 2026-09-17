import { Inject, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { Database } from '../../common/database.js';
import { RUNTIME, type Runtime } from '../../config/runtime.js';
import { issuer, hashPassword, checkPassword, opaqueToken, tokenHash, bearer } from './tokens.js';
import { RegisterDto, LoginDto } from './auth.dto.js';
import { requestContext } from '../../common/request-context.js';
@Injectable()
export class AuthService implements OnModuleInit {
  private tokens!: Awaited<ReturnType<typeof issuer>>;
  private dummy!: string;
  constructor(
    private db: Database,
    @Inject(RUNTIME) private config: Runtime,
  ) {}
  async onModuleInit() {
    this.tokens = await issuer(this.config);
    this.dummy = await hashPassword(opaqueToken());
  }
  async session(userId: string) {
    const refreshToken = opaqueToken();
    const session = await this.db.session.create({
      data: {
        userId,
        expiresAt: new Date(Date.now() + 30 * 86400000),
        tokens: { create: { tokenHash: tokenHash(refreshToken) } },
      },
    });
    return {
      accessToken: await this.tokens.sign({ userId, sessionId: session.id }),
      refreshToken,
      expiresIn: 600,
      tokenType: 'Bearer',
    };
  }
  async register(input: RegisterDto) {
    const passwordHash = await hashPassword(input.password);
    const user = await this.db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: input.email, displayName: input.displayName, passwordHash },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'core.account.created',
          correlationId: requestContext.getStore()?.correlationId,
        },
      });
      return user;
    });
    return this.session(user.id);
  }
  async login(input: LoginDto) {
    const user = await this.db.user.findUnique({ where: { email: input.email } });
    const valid = await checkPassword(input.password, user?.passwordHash ?? this.dummy);
    if (!user || !valid) throw new UnauthorizedException();
    return this.session(user.id);
  }
  async authenticate(header?: string) {
    const identity = await this.tokens.verify(bearer(header));
    const session = await this.db.session.findFirst({
      where: {
        id: identity.sessionId,
        userId: identity.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!session) throw new UnauthorizedException();
    return identity;
  }
  async refresh(raw: string) {
    const replacement = opaqueToken();
    const identity = await this.db.$transaction(async (tx) => {
      const previous = await tx.refreshToken.findUnique({
        where: { tokenHash: tokenHash(raw) },
        include: { session: true },
      });
      if (!previous || previous.session.revokedAt || previous.session.expiresAt <= new Date()) return null;
      const consumed = await tx.refreshToken.updateMany({
        where: { id: previous.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (!consumed.count) {
        await tx.session.update({ where: { id: previous.sessionId }, data: { revokedAt: new Date() } });
        await tx.auditLog.create({
          data: {
            actorId: previous.session.userId,
            action: 'core.session.refresh_reuse',
            correlationId: requestContext.getStore()?.correlationId,
          },
        });
        return null;
      }
      await tx.refreshToken.create({
        data: { sessionId: previous.sessionId, tokenHash: tokenHash(replacement) },
      });
      return { userId: previous.session.userId, sessionId: previous.sessionId };
    });
    if (!identity) throw new UnauthorizedException();
    return {
      accessToken: await this.tokens.sign(identity),
      refreshToken: replacement,
      expiresIn: 600,
      tokenType: 'Bearer',
    };
  }
  async revoke(userId: string, sessionId: string) {
    await this.db.$transaction([
      this.db.session.updateMany({ where: { id: sessionId, userId }, data: { revokedAt: new Date() } }),
      this.db.auditLog.create({
        data: {
          actorId: userId,
          action: 'core.session.revoked',
          targetId: sessionId,
          correlationId: requestContext.getStore()?.correlationId,
        },
      }),
    ]);
  }
  jwks() {
    return this.tokens.jwks;
  }
}
