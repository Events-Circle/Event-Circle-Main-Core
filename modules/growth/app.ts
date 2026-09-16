import { z } from 'zod';
import type { FastifyRequest } from 'fastify';
import { PrismaClient } from '../../generated/growth/index.js';
import type { Config } from '../../packages/runtime/config.js';
import { httpServer, HttpError } from '../../packages/runtime/http.js';
import { bearer, verifier } from '../../packages/runtime/tokens.js';
import { email, identifier, pagination, leadStages } from '../../packages/contracts/index.js';

export async function createGrowth(config: Config, db = new PrismaClient(), coreFetch: typeof fetch = fetch) {
  if (!config.CORE_API_URL) throw new Error('CORE_API_URL is required');
  const app = await httpServer(config, 'growth', () => db.$queryRaw`SELECT 1`);
  app.addHook('onClose', async () => { await db.$disconnect(); });
  const tokens = await verifier(config);
  const authenticate = async (request: FastifyRequest, feature: string) => {
    const raw = bearer(request.headers.authorization);
    const identity = await tokens.verify(raw);
    let response: Response;
    try {
      response = await coreFetch(new URL('/v1/access', config.CORE_API_URL), {
        headers: { Authorization: `Bearer ${raw}` }, signal: AbortSignal.timeout(3000), redirect: 'error',
      });
    } catch { throw new HttpError(503, 'CORE_UNAVAILABLE'); }
    if (response.status === 401) throw new HttpError(401, 'UNAUTHORIZED');
    if (!response.ok) throw new HttpError(503, 'CORE_UNAVAILABLE');
    let access;
    try { access = z.object({ userId: identifier, features: z.array(z.string()) }).parse(await response.json()); }
    catch { throw new HttpError(503, 'CORE_UNAVAILABLE'); }
    if (access.userId !== identity.userId || !access.features.includes(feature)) throw new HttpError(403, 'FORBIDDEN');
    return identity;
  };
  const supplierInput = z.object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(64),
    businessName: z.string().trim().min(1).max(160), description: z.string().trim().max(4000).default(''),
    category: z.string().trim().min(1).max(100), city: z.string().trim().min(1).max(100),
    serviceAreas: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
    published: z.boolean().default(false),
  }).strict();
  app.put('/v1/supplier', async request => {
    const { userId } = await authenticate(request, 'growth:presence');
    const data = supplierInput.parse(request.body);
    return db.$transaction(async tx => {
      const supplier = await tx.supplier.upsert({ where: { coreUserId: userId }, create: { coreUserId: userId, ...data }, update: data });
      await tx.activity.create({ data: { coreUserId: userId, action: 'supplier.saved', targetId: supplier.id } });
      return supplier;
    });
  });
  app.get('/v1/supplier', async request => {
    const { userId } = await authenticate(request, 'growth:presence');
    const supplier = await db.supplier.findUnique({ where: { coreUserId: userId } });
    if (!supplier) throw new HttpError(404, 'NOT_FOUND');
    return supplier;
  });
  app.get('/v1/public/suppliers/:slug', async request => {
    const { slug } = z.object({ slug: supplierInput.shape.slug }).parse(request.params);
    const supplier = await db.supplier.findFirst({ where: { slug, published: true }, select: { slug: true, businessName: true, description: true, category: true, city: true, serviceAreas: true } });
    if (!supplier) throw new HttpError(404, 'NOT_FOUND');
    return supplier;
  });
  app.post('/v1/public/suppliers/:slug/inquiries', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { slug } = z.object({ slug: supplierInput.shape.slug }).parse(request.params);
    const input = z.object({
      name: z.string().trim().min(1).max(100), email: email.optional(),
      phone: z.string().regex(/^\+?[0-9 ()-]{7,25}$/).optional(), message: z.string().trim().min(1).max(4000),
      source: z.enum(['PUBLIC_PROFILE', 'QR', 'SHARED_LINK', 'INSTAGRAM', 'FACEBOOK', 'META_ADS']).default('PUBLIC_PROFILE'),
      campaign: z.string().regex(/^[a-zA-Z0-9._-]{1,100}$/).optional(),
      contactConsent: z.literal(true),
    }).strict().refine(value => value.email || value.phone).parse(request.body);
    const supplier = await db.supplier.findFirst({ where: { slug, published: true } });
    if (!supplier) throw new HttpError(404, 'NOT_FOUND');
    await db.$transaction(async tx => {
      const lead = await tx.lead.create({ data: { supplierId: supplier.id, ...input, contactConsentVersion: 'inquiry-v1' } });
      await tx.activity.create({ data: { coreUserId: supplier.coreUserId, action: 'lead.received', targetId: lead.id } });
    });
    return reply.code(201).send({ received: true });
  });
  app.get('/v1/leads', async request => {
    const { userId } = await authenticate(request, 'growth:leads');
    const { limit, offset, stage } = pagination.extend({ stage: z.enum(leadStages).optional() }).parse(request.query);
    return { items: await db.lead.findMany({ where: { supplier: { coreUserId: userId }, stage }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit, skip: offset }) };
  });
  app.patch('/v1/leads/:id', async (request, reply) => {
    const { userId } = await authenticate(request, 'growth:leads');
    const { id } = z.object({ id: identifier }).parse(request.params);
    const { stage } = z.object({ stage: z.enum(leadStages) }).strict().parse(request.body);
    const changed = await db.$transaction(async tx => {
      const result = await tx.lead.updateMany({ where: { id, supplier: { coreUserId: userId } }, data: { stage } });
      if (result.count) await tx.activity.create({ data: { coreUserId: userId, action: `lead.stage.${stage}`, targetId: id } });
      return result.count;
    });
    if (!changed) throw new HttpError(404, 'NOT_FOUND');
    return reply.code(204).send();
  });
  return app;
}
