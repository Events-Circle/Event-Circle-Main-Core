import { beforeAll, afterAll, test, expect } from '@jest/globals';
import request from 'supertest';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { migrateDisposable } from './migrations.mjs';
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
    await migrateDisposable(pg);
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
    enabled: ['circle-ai'],
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

test('Circle AI works with Core alone and rejects anonymous access', async () => {
  await api().get('/api/v1/circle-ai/brief').expect(401);
  a = (
    await api()
      .post('/api/v1/core/auth/register')
      .send({ email: `ai-a-${suffix}@example.com`, displayName: 'Owner', password })
      .expect(201)
  ).body;
  b = (
    await api()
      .post('/api/v1/core/auth/register')
      .send({ email: `ai-b-${suffix}@example.com`, displayName: 'Other', password })
      .expect(201)
  ).body;
  supplier = (
    await api()
      .post('/api/v1/core/suppliers')
      .set(auth(a.accessToken))
      .send({ businessName: 'AI Studio', category: 'Photography', city: 'Beirut' })
      .expect(201)
  ).body;
  org = supplier.organizationId;
  const brief = (await api().get('/api/v1/circle-ai/brief').set(scoped(a.accessToken)).expect(200)).body;
  expect(brief.providerReady).toBe(false);
  expect(brief.executionReady).toBe(false);
  expect(brief.draftCount).toBe(0);
  await api().get('/api/v1/circle-ai/plans').set(scoped(b.accessToken)).expect(403);
});
test('request validation, idempotency and atomic audit/outbox', async () => {
  const body = {
    requestId: randomUUID(),
    kind: 'CREATE_POST',
    prompt: 'Create a post for my bridal package',
  };
  await api()
    .post('/api/v1/circle-ai/plans')
    .set(scoped(a.accessToken))
    .send({ ...body, prompt: '  ' })
    .expect(400);
  lead = (await api().post('/api/v1/circle-ai/plans').set(scoped(a.accessToken)).send(body).expect(201)).body;
  expect(lead.status).toBe('DRAFT');
  expect(lead.organizationId).toBeUndefined();
  expect(lead.response).toContain('Nothing has been generated');
  const replay = (
    await api().post('/api/v1/circle-ai/plans').set(scoped(a.accessToken)).send(body).expect(201)
  ).body;
  expect(replay.id).toBe(lead.id);
  await api()
    .post('/api/v1/circle-ai/plans')
    .set(scoped(a.accessToken))
    .send({ ...body, prompt: 'Changed prompt' })
    .expect(409);
  expect(
    await db.outboxEvent.count({ where: { organizationId: org, name: 'circle-ai.plan.created.v1' } }),
  ).toBe(1);
  expect(await db.auditLog.count({ where: { targetId: lead.id, action: 'circle-ai.plan.created.v1' } })).toBe(
    1,
  );
  const event = await db.outboxEvent.findFirst({ where: { organizationId: org } });
  expect(JSON.stringify(event.payload)).not.toContain('bridal');
});
test('versioned edits, owner approval and tenant isolation', async () => {
  const otherOrg = (
    await api()
      .post('/api/v1/core/suppliers')
      .set(auth(b.accessToken))
      .send({ businessName: 'Other Studio', category: 'Venue', city: 'Beirut' })
      .expect(201)
  ).body.organizationId;
  await api()
    .patch(`/api/v1/circle-ai/plans/${lead.id}`)
    .set(scoped(b.accessToken, otherOrg))
    .send({ version: 1, draft: 'Foreign' })
    .expect(404);
  uid = (await api().get('/api/v1/core/me').set(auth(b.accessToken))).body.id;
  const member = await db.membership.create({ data: { userId: uid, organizationId: org, role: 'VIEWER' } });
  await api().get('/api/v1/circle-ai/plans').set(scoped(b.accessToken)).expect(200);
  await api()
    .patch(`/api/v1/circle-ai/plans/${lead.id}`)
    .set(scoped(b.accessToken))
    .send({ version: 1, draft: 'No' })
    .expect(403);
  await db.membership.update({ where: { id: member.id }, data: { role: 'EDITOR' } });
  lead = (
    await api()
      .patch(`/api/v1/circle-ai/plans/${lead.id}`)
      .set(scoped(b.accessToken))
      .send({ version: 1, draft: 'Edited proposal' })
      .expect(200)
  ).body;
  expect(lead.version).toBe(2);
  await api()
    .post(`/api/v1/circle-ai/plans/${lead.id}/decision`)
    .set(scoped(b.accessToken))
    .send({ version: 2, decision: 'APPROVED' })
    .expect(403);
  await api()
    .post(`/api/v1/circle-ai/plans/${lead.id}/decision`)
    .set(scoped(a.accessToken))
    .send({ version: 1, decision: 'APPROVED' })
    .expect(409);
  const approved = (
    await api()
      .post(`/api/v1/circle-ai/plans/${lead.id}/decision`)
      .set(scoped(a.accessToken))
      .send({ version: 2, decision: 'APPROVED' })
      .expect(201)
  ).body;
  expect(approved.status).toBe('APPROVED');
  expect(approved.blockedReason).toBeTruthy();
  await api()
    .patch(`/api/v1/circle-ai/plans/${lead.id}`)
    .set(scoped(a.accessToken))
    .send({ version: 3, draft: 'Change approved content' })
    .expect(409);
  const brief = (await api().get('/api/v1/circle-ai/brief').set(scoped(a.accessToken))).body;
  expect(brief.approvedCount).toBe(1);
  expect(brief.executionReady).toBe(false);
});
test('failed outbox write rolls back plan creation', async () => {
  const { EventsService } = await import('../dist/core/audit/events.service.js');
  const events = app.get(EventsService),
    original = events.record;
  const requestId = randomUUID();
  events.record = async () => {
    throw new Error('Injected outbox failure');
  };
  try {
    await api()
      .post('/api/v1/circle-ai/plans')
      .set(scoped(a.accessToken))
      .send({ requestId, kind: 'GENERAL', prompt: 'Failure check' })
      .expect(500);
  } finally {
    events.record = original;
  }
  expect(await db.circleAiPlan.count({ where: { requestId } })).toBe(0);
});
test('disabling Circle AI removes its routes and leaves Core healthy', async () => {
  await db.$disconnect();
  const isolated = await createApp({ ...config, enabled: [] });
  await isolated.init();
  try {
    await request(isolated.getHttpServer())
      .get('/api/v1/circle-ai/brief')
      .set(scoped(a.accessToken))
      .expect(404);
    await request(isolated.getHttpServer()).get('/api/v1/core/health').expect(200);
  } finally {
    await isolated.close();
  }
});
