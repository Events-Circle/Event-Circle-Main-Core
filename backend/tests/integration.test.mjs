import { beforeAll, afterAll, test, expect } from '@jest/globals';
import request from 'supertest';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../dist/app.js';
import { Database } from '../dist/common/database.js';
let app, db, config, dir;
const cleanup = [];
let a, b, org, supplier, lead, uid;
const password = 'test-only long password 123!';
const suffix = randomUUID();
const auth = (token) => ({ Authorization: `Bearer ${token}` });
const scoped = (token, organization = org) => ({ ...auth(token), 'X-Organization-Id': organization });
const api = () => request(app.getHttpServer());
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'circle-monorepo-'));
  if (!process.env.TEST_DATABASE_URL) {
    const { PGlite } = await import('@electric-sql/pglite');
    const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket');
    const pg = await PGlite.create();
    cleanup.push(() => pg.close());
    await pg.exec(
      await readFile(
        new URL('../prisma/migrations/202609160001_monolith/migration.sql', import.meta.url),
        'utf8',
      ),
    );
    const server = new PGLiteSocketServer({ db: pg, host: '127.0.0.1', port: 0 });
    await server.start();
    cleanup.push(() => server.stop());
    process.env.DATABASE_URL = `postgresql://postgres:postgres@${server.getServerConn()}/postgres?connection_limit=1&sslmode=disable`;
  } else process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  const keys = generateKeyPairSync('ed25519');
  await writeFile(join(dir, 'private.pem'), keys.privateKey.export({ type: 'pkcs8', format: 'pem' }), {
    mode: 0o600,
  });
  await writeFile(join(dir, 'public.pem'), keys.publicKey.export({ type: 'spki', format: 'pem' }));
  config = {
    nodeEnv: 'test',
    host: '127.0.0.1',
    port: 4000,
    issuer: 'http://localhost',
    audience: 'circle-test',
    keyId: 'test',
    privateKeyPath: join(dir, 'private.pem'),
    publicKeyPath: join(dir, 'public.pem'),
    cors: ['https://app.example.com'],
    trustProxy: [],
    edition: 'growth-os',
    enabled: ['presence', 'leads'],
  };
  app = await createApp(config);
  await app.init();
  db = app.get(Database);
}, 120000);
afterAll(async () => {
  if (app) await app.close();
  for (const close of cleanup.reverse()) await close();
  if (dir) await rm(dir, { recursive: true, force: true });
}, 30000);
test('registers accounts, stores only password/refresh hashes, validates profile and login', async () => {
  const register = async (name) =>
    (
      await api()
        .post('/api/v1/core/auth/register')
        .send({ email: `${name}-${suffix}@example.com`, displayName: name, password })
        .expect(201)
    ).body;
  a = await register('a');
  b = await register('b');
  const me = await api().get('/api/v1/core/me').set(auth(a.accessToken)).expect(200);
  uid = me.body.id;
  expect(me.body.passwordHash).toBeUndefined();
  expect((await db.user.findUnique({ where: { id: uid } })).passwordHash).not.toBe(password);
  expect(await db.refreshToken.count({ where: { tokenHash: a.refreshToken } })).toBe(0);
  await api().patch('/api/v1/core/me').set(auth(a.accessToken)).send({ role: 'OWNER' }).expect(400);
  await api()
    .post('/api/v1/core/auth/login')
    .send({ email: me.body.email, password: 'wrong-but-long-password' })
    .expect(401);
  await api()
    .patch('/api/v1/core/me')
    .set(auth(a.accessToken))
    .send({ locale: 'ar', timezone: 'Asia/Beirut', notificationPreferences: { email: true, push: false } })
    .expect(200);
});
test('profile preferences reject malformed values without changing saved preferences', async () => {
  const preferences = { email: true, push: false };
  for (const value of [
    [],
    [preferences],
    null,
    'invalid',
    {},
    { email: true },
    { email: 'true', push: false },
  ]) {
    const response = await api()
      .patch('/api/v1/core/me')
      .set(auth(a.accessToken))
      .send({ notificationPreferences: value });
    expect({ value, status: response.status }).toEqual({ value, status: 400 });
    const me = (await api().get('/api/v1/core/me').set(auth(a.accessToken)).expect(200)).body;
    expect(me.notificationPreferences).toEqual(preferences);
  }
  await api().patch('/api/v1/core/me').set(auth(a.accessToken)).send({ displayName: 'Updated' }).expect(200);
  const me = (await api().get('/api/v1/core/me').set(auth(a.accessToken)).expect(200)).body;
  expect(me.notificationPreferences).toEqual(preferences);
});
test('Core owns supplier and organization; Presence exposes only published profiles', async () => {
  supplier = (
    await api()
      .post('/api/v1/core/suppliers')
      .set(auth(a.accessToken))
      .send({ businessName: 'Test Studio', category: 'Photography', city: 'Beirut', acceptInquiries: true })
      .expect(201)
  ).body;
  org = supplier.organizationId;
  const data = { slug: `studio-${suffix}`, description: 'Studio portfolio', published: false };
  await api().put('/api/v1/presence/profile').set(scoped(a.accessToken)).send(data).expect(200);
  await api().get(`/api/v1/presence/public/${data.slug}`).expect(404);
  await api()
    .put('/api/v1/presence/profile')
    .set(scoped(a.accessToken))
    .send({ ...data, published: true })
    .expect(200);
  const publicProfile = (await api().get(`/api/v1/presence/public/${data.slug}`).expect(200)).body;
  expect(publicProfile.supplier.businessName).toBe('Test Studio');
  expect(publicProfile.supplier.organizationId).toBeUndefined();
  await api().get('/api/v1/core/suppliers/current').set(scoped(b.accessToken)).expect(403);
});
test('captures a consented lead and an outbox event atomically; prevents cross-organization reads and edits', async () => {
  const inquiry = {
    name: 'Prospect',
    email: 'prospect@example.com',
    message: 'Wedding photography',
    source: 'QR',
    contactConsent: true,
    contactConsentVersion: 'v1',
  };
  await api()
    .post(`/api/v1/leads/public/${supplier.id}`)
    .send({ ...inquiry, contactConsent: false })
    .expect(400);
  await api()
    .post(`/api/v1/leads/public/${supplier.id}`)
    .send({ ...inquiry, email: undefined })
    .expect(400);
  lead = (await api().post(`/api/v1/leads/public/${supplier.id}`).send(inquiry).expect(201)).body.id;
  expect(await db.outboxEvent.count({ where: { name: 'leads.lead.created.v1', organizationId: org } })).toBe(
    1,
  );
  await api().get('/api/v1/leads').set(scoped(b.accessToken)).expect(403);
  await api()
    .patch(`/api/v1/leads/${lead}/stage`)
    .set(scoped(b.accessToken))
    .send({ stage: 'WON' })
    .expect(403);
  const owned = (await api().get('/api/v1/leads').set(scoped(a.accessToken)).expect(200)).body;
  expect(owned[0].id).toBe(lead);
  await api()
    .patch(`/api/v1/leads/${lead}/stage`)
    .set(scoped(a.accessToken))
    .send({ stage: 'QUALIFIED' })
    .expect(200);
  const other = (
    await api()
      .post('/api/v1/core/suppliers')
      .set(auth(b.accessToken))
      .send({ businessName: 'Other', category: 'Venue', city: 'Beirut' })
      .expect(201)
  ).body;
  await api()
    .patch(`/api/v1/leads/${lead}/stage`)
    .set(scoped(b.accessToken, other.organizationId))
    .send({ stage: 'WON' })
    .expect(404);
});
test('VIEWER membership allows reads but denies writes; expired subscription grants disappear', async () => {
  const otherUser = (await api().get('/api/v1/core/me').set(auth(b.accessToken))).body.id;
  await db.membership.create({ data: { userId: otherUser, organizationId: org, role: 'VIEWER' } });
  await api().get('/api/v1/leads').set(scoped(b.accessToken)).expect(200);
  await api()
    .patch(`/api/v1/leads/${lead}/stage`)
    .set(scoped(b.accessToken))
    .send({ stage: 'WON' })
    .expect(403);
  const sub = await db.subscription.create({
    data: {
      userId: uid,
      planCode: 'test',
      status: 'active',
      provider: 'test',
      providerReference: suffix,
      features: ['leads.automation'],
      startsAt: new Date(Date.now() - 1000),
      endsAt: new Date(Date.now() + 60000),
    },
  });
  expect((await api().get('/api/v1/core/access').set(auth(a.accessToken))).body.features).toContain(
    'leads.automation',
  );
  await db.subscription.update({ where: { id: sub.id }, data: { endsAt: new Date(Date.now() - 1) } });
  expect((await api().get('/api/v1/core/access').set(auth(a.accessToken))).body.features).not.toContain(
    'leads.automation',
  );
});
test('Core and each module operate without the other module; disabled routes are absent', async () => {
  await db.$disconnect(); // The portable PGlite adapter accepts one active client at a time.
  for (const enabled of [[], ['presence'], ['leads']]) {
    const isolated = await createApp({ ...config, enabled });
    await isolated.init();
    try {
      const client = request(isolated.getHttpServer());
      await client.get('/api/v1/core/health').expect(200);
      if (!enabled.includes('presence'))
        await client.get('/api/v1/presence/profile').set(scoped(a.accessToken)).expect(404);
      else await client.get('/api/v1/presence/profile').set(scoped(a.accessToken)).expect(200);
      if (!enabled.includes('leads'))
        await client.get('/api/v1/leads').set(scoped(a.accessToken)).expect(404);
      else {
        await client.get('/api/v1/leads').set(scoped(a.accessToken)).expect(200);
        await client
          .post(`/api/v1/leads/public/${supplier.id}`)
          .send({
            name: 'Standalone',
            phone: '+961 1234567',
            message: 'Inquiry',
            contactConsent: true,
            contactConsentVersion: 'v1',
          })
          .expect(201);
      }
    } finally {
      await isolated.close();
    }
  }
});
test('refresh rotation detects reuse and immediately revokes access; logout revokes sessions', async () => {
  const refresh = (
    await api().post('/api/v1/core/auth/refresh').send({ refreshToken: a.refreshToken }).expect(200)
  ).body;
  expect(refresh.refreshToken).not.toBe(a.refreshToken);
  await api().post('/api/v1/core/auth/refresh').send({ refreshToken: a.refreshToken }).expect(401);
  await api().get('/api/v1/core/me').set(auth(refresh.accessToken)).expect(401);
  await api().post('/api/v1/core/auth/logout').set(auth(b.accessToken)).expect(204);
  await api().get('/api/v1/core/me').set(auth(b.accessToken)).expect(401);
});

test('database failure leaves liveness healthy and readiness unavailable', async () => {
  const query = db.$queryRaw;
  db.$queryRaw = async () => {
    throw new Error('Simulated database outage');
  };
  try {
    await api().get('/api/v1/core/health').expect(200);
    await api().get('/api/v1/core/health/ready').expect(503);
  } finally {
    db.$queryRaw = query;
  }
});

test('rotating untrusted forwarded headers cannot bypass the request limit', async () => {
  let response;
  for (let i = 0; i < 121; i++) {
    response = await api()
      .get('/api/v1/core/health')
      .set('X-Forwarded-For', `192.0.2.${i + 1}`);
    expect([200, 429]).toContain(response.status);
  }
  expect(response.status).toBe(429);
});
