// Read-only source audit; every database write below targets a fresh disposable PGlite instance.
// Run after pnpm generate && pnpm --filter @events-circle/backend build.
// Exit 1 means a required behavior failed, not that the runner failed to start.
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { createApp, specification } from '../dist/app.js';
import { Database } from '../dist/common/database.js';
import { EventsService } from '../dist/core/audit/events.service.js';
import { runtime } from '../dist/config/runtime.js';

const results = [];
async function check(name, run) {
  try {
    const evidence = await run();
    results.push({ name, status: 'PASS', evidence });
  } catch (error) {
    results.push({ name, status: 'FAIL', evidence: error.message });
  }
  console.log(`${results.at(-1).status}: ${name}`);
}
const dir = await mkdtemp(join(tmpdir(), 'events-circle-audit-'));
const pg = await PGlite.create();
let server, app;
try {
  await pg.exec(
    await readFile(
      new URL('../prisma/migrations/202609160001_monolith/migration.sql', import.meta.url),
      'utf8',
    ),
  );
  server = new PGLiteSocketServer({ db: pg, host: '127.0.0.1', port: 0 });
  await server.start();
  // Never use any configured live or test database URL.
  process.env.DATABASE_URL = `postgresql://postgres:postgres@${server.getServerConn()}/postgres?connection_limit=1&sslmode=disable`;
  const keys = generateKeyPairSync('ed25519');
  await writeFile(join(dir, 'private.pem'), keys.privateKey.export({ type: 'pkcs8', format: 'pem' }), {
    mode: 0o600,
  });
  await writeFile(join(dir, 'public.pem'), keys.publicKey.export({ type: 'spki', format: 'pem' }));
  const config = {
    nodeEnv: 'test',
    host: '127.0.0.1',
    port: 4000,
    issuer: 'http://localhost',
    audience: 'audit',
    keyId: 'audit',
    privateKeyPath: join(dir, 'private.pem'),
    publicKeyPath: join(dir, 'public.pem'),
    cors: ['https://supplier.example.com'],
    trustProxy: [],
    edition: 'growth-os',
    enabled: ['presence', 'leads'],
  };
  app = await createApp(config);
  await app.init();
  const db = app.get(Database);
  const api = () => request(app.getHttpServer());
  const auth = (account) => ({ Authorization: `Bearer ${account.accessToken}` });
  const scope = (account, supplier) => ({ ...auth(account), 'X-Organization-Id': supplier.organizationId });
  const password = 'Audit only password 123!';
  const register = async (name) =>
    (
      await api()
        .post('/api/v1/core/auth/register')
        .send({ email: `${name}@example.com`, displayName: name, password })
        .expect(201)
    ).body;
  const supplierInput = {
    businessName: 'Audit Studio',
    category: 'Photography',
    city: 'Beirut',
    acceptInquiries: true,
  };
  const inquiry = {
    name: 'Audit Prospect',
    email: 'prospect@example.com',
    message: 'Availability?',
    contactConsent: true,
    contactConsentVersion: 'v1',
  };
  await check('Fresh migration contains no business records', async () => {
    for (const model of [
      'user',
      'organization',
      'supplier',
      'presenceProfile',
      'leadOpportunity',
      'subscription',
    ])
      assert.equal(await db[model].count(), 0);
  });
  const owner = await register('owner');
  const outsider = await register('outsider');
  const uid = (await api().get('/api/v1/core/me').set(auth(owner))).body.id;
  const outsiderId = (await api().get('/api/v1/core/me').set(auth(outsider))).body.id;
  const supplier = (
    await api().post('/api/v1/core/suppliers').set(auth(owner)).send(supplierInput).expect(201)
  ).body;
  const otherSupplier = (
    await api()
      .post('/api/v1/core/suppliers')
      .set(auth(outsider))
      .send({ ...supplierInput, businessName: 'Other' })
      .expect(201)
  ).body;
  await check('Normalized duplicate account rejected', async () => {
    await api()
      .post('/api/v1/core/auth/register')
      .send({ email: 'OWNER@example.com', displayName: 'duplicate', password })
      .expect(409);
  });
  await check('Protected Core, Presence and Leads reads require authentication', async () => {
    for (const path of [
      'core/me',
      'core/memberships',
      'core/sessions',
      'core/consents',
      'core/subscriptions',
      'core/access',
      'core/notifications',
      'core/suppliers/current',
      'presence/profile',
      'leads',
    ])
      await api().get(`/api/v1/${path}`).expect(401);
  });
  await check('Supplier creation atomically owns organization, OWNER membership and audit', async () => {
    const membership = await db.membership.findUnique({
      where: { userId_organizationId: { userId: uid, organizationId: supplier.organizationId } },
    });
    assert.equal(membership.role, 'OWNER');
    assert.equal(
      await db.auditLog.count({
        where: { actorId: uid, action: 'core.supplier.created', targetId: supplier.id },
      }),
      1,
    );
  });
  await check('Organization headers are required and validated', async () => {
    for (const path of ['core/suppliers/current', 'presence/profile', 'leads']) {
      await api().get(`/api/v1/${path}`).set(auth(owner)).expect(400);
      await api()
        .get(`/api/v1/${path}`)
        .set({ ...auth(owner), 'X-Organization-Id': 'invalid' })
        .expect(400);
    }
  });
  await check('Cross-organization supplier and Presence writes are forbidden', async () => {
    await api()
      .put('/api/v1/core/suppliers/current')
      .set(scope(outsider, supplier))
      .send(supplierInput)
      .expect(403);
    await api()
      .put('/api/v1/presence/profile')
      .set(scope(outsider, supplier))
      .send({ slug: 'stolen-profile', description: '', published: true })
      .expect(403);
  });
  await check('Notification records are scoped and read markers cannot cross users', async () => {
    const note = await db.notification.create({
      data: { userId: uid, kind: 'audit', title: 'Test', body: 'Test' },
    });
    assert.equal(
      (await api().get('/api/v1/core/notifications').set(auth(outsider)).expect(200)).body.length,
      0,
    );
    await api().patch(`/api/v1/core/notifications/${note.id}/read`).set(auth(outsider)).expect(404);
    assert.equal((await db.notification.findUnique({ where: { id: note.id } })).readAt, null);
    await api().patch(`/api/v1/core/notifications/${note.id}/read`).set(auth(owner)).expect(204);
    assert.ok((await db.notification.findUnique({ where: { id: note.id } })).readAt);
  });
  await check('Consent history is append-only and private to its user', async () => {
    for (const granted of [true, false])
      await api()
        .post('/api/v1/core/consents')
        .set(auth(owner))
        .send({ purpose: 'marketing', version: 'v1', granted })
        .expect(201);
    assert.equal((await api().get('/api/v1/core/consents').set(auth(owner))).body.length, 2);
    assert.equal((await api().get('/api/v1/core/consents').set(auth(outsider))).body.length, 0);
  });
  await check('Session lists redact tokens and another user cannot revoke a session', async () => {
    const sessions = (await api().get('/api/v1/core/sessions').set(auth(owner)).expect(200)).body;
    assert.deepEqual(Object.keys(sessions[0]).sort(), ['createdAt', 'expiresAt', 'id']);
    await api().delete(`/api/v1/core/sessions/${sessions[0].id}`).set(auth(outsider)).expect(204);
    await api().get('/api/v1/core/me').set(auth(owner)).expect(200);
  });
  await check('Inactive and future subscriptions do not grant paid features', async () => {
    const now = Date.now();
    for (const [status, start, end] of [
      ['active', 60000, 120000],
      ['canceled', -60000, 60000],
      ['active', -120000, -60000],
    ])
      await db.subscription.create({
        data: {
          userId: uid,
          planCode: 'audit',
          status,
          provider: 'test',
          providerReference: randomUUID(),
          features: ['leads.automation'],
          startsAt: new Date(now + start),
          endsAt: new Date(now + end),
        },
      });
    const access = (await api().get('/api/v1/core/access').set(auth(owner)).expect(200)).body;
    assert.equal(access.features.includes('leads.automation'), false);
    assert.equal(access.features.includes('leads.read'), true);
    const subscriptions = (await api().get('/api/v1/core/subscriptions').set(auth(owner))).body;
    assert.ok(subscriptions.every((s) => !('providerReference' in s)));
  });
  const profile = { slug: 'audit-studio', description: 'Audit portfolio', published: false };
  await check('Presence drafts, publication and unpublication respect privacy', async () => {
    await api().put('/api/v1/presence/profile').set(scope(owner, supplier)).send(profile).expect(200);
    await api().get('/api/v1/presence/public/audit-studio').expect(404);
    await api()
      .put('/api/v1/presence/profile')
      .set(scope(owner, supplier))
      .send({ ...profile, published: true })
      .expect(200);
    const published = (await api().get('/api/v1/presence/public/audit-studio').expect(200)).body;
    assert.deepEqual(Object.keys(published.supplier).sort(), [
      'businessName',
      'category',
      'city',
      'id',
      'serviceAreas',
    ]);
    await api().put('/api/v1/presence/profile').set(scope(owner, supplier)).send(profile).expect(200);
    await api().get('/api/v1/presence/public/audit-studio').expect(404);
  });
  await check('Conflicting public slugs return 409 without partial writes', async () => {
    await api().put('/api/v1/presence/profile').set(scope(outsider, otherSupplier)).send(profile).expect(409);
    assert.equal(await db.presenceProfile.count({ where: { supplierId: otherSupplier.id } }), 0);
  });
  await check('Outbox failure rolls back Presence changes', async () => {
    const events = app.get(EventsService);
    const original = events.record;
    events.record = async () => {
      throw new Error('Audit simulated outbox failure');
    };
    try {
      await api()
        .put('/api/v1/presence/profile')
        .set(scope(owner, supplier))
        .send({ ...profile, description: 'Must roll back' })
        .expect(500);
    } finally {
      events.record = original;
    }
    assert.equal(
      (await db.presenceProfile.findUnique({ where: { supplierId: supplier.id } })).description,
      profile.description,
    );
  });
  await check('Inquiry opt-out blocks capture', async () => {
    await api()
      .put('/api/v1/core/suppliers/current')
      .set(scope(owner, supplier))
      .send({ ...supplierInput, acceptInquiries: false })
      .expect(200);
    await api().post(`/api/v1/leads/public/${supplier.id}`).send(inquiry).expect(404);
    await api()
      .put('/api/v1/core/suppliers/current')
      .set(scope(owner, supplier))
      .send(supplierInput)
      .expect(200);
  });
  const receipt = await api().post(`/api/v1/leads/public/${supplier.id}`).send(inquiry).expect(201);
  await check('Lead intake stores canonical tenant, consent, source and private outbox payload', async () => {
    assert.deepEqual(Object.keys(receipt.body), ['id']);
    const lead = await db.leadOpportunity.findUnique({ where: { id: receipt.body.id } });
    assert.equal(lead.organizationId, supplier.organizationId);
    assert.equal(lead.supplierId, supplier.id);
    assert.equal(lead.source, 'DIRECT');
    assert.equal(lead.stage, 'NEW');
    assert.equal(lead.contactConsent, true);
    const event = await db.outboxEvent.findFirst({ where: { name: 'leads.lead.created.v1' } });
    assert.deepEqual(Object.keys(event.payload).sort(), ['leadId', 'supplierId']);
  });
  await check('Client cannot inject tenant, stage or internal IDs into lead intake', async () => {
    await api()
      .post(`/api/v1/leads/public/${supplier.id}`)
      .send({ ...inquiry, organizationId: otherSupplier.organizationId, stage: 'WON', id: randomUUID() })
      .expect(400);
  });
  await check('Invalid stage is rejected and valid stage updates audit and outbox', async () => {
    const path = `/api/v1/leads/${receipt.body.id}/stage`;
    await api().patch(path).set(scope(owner, supplier)).send({ stage: 'INVALID' }).expect(400);
    await api().patch(path).set(scope(owner, supplier)).send({ stage: 'QUALIFIED' }).expect(200);
    assert.equal(
      await db.auditLog.count({ where: { action: 'leads.stage.changed.v1', targetId: receipt.body.id } }),
      1,
    );
  });
  await check('EDITOR can manage Presence but cannot edit Core supplier identity', async () => {
    await db.membership.create({
      data: { userId: outsiderId, organizationId: supplier.organizationId, role: 'EDITOR' },
    });
    await api()
      .put('/api/v1/core/suppliers/current')
      .set(scope(outsider, supplier))
      .send(supplierInput)
      .expect(403);
    await api().put('/api/v1/presence/profile').set(scope(outsider, supplier)).send(profile).expect(200);
  });
  await check('Planned modules have no routes and are honestly marked unimplemented', async () => {
    const modules = (await api().get('/api/v1/core/modules').expect(200)).body;
    assert.equal(modules.length, 8);
    assert.deepEqual(
      modules.filter((m) => m.implemented).map((m) => m.id),
      ['presence', 'leads'],
    );
    for (const m of modules.filter((m) => !m.implemented)) {
      assert.equal(m.enabled, false);
      await api().get(`/api/v1/${m.id}`).expect(404);
    }
  });
  await check(
    'Valid runtime configuration rejects bad modules, broad proxies and unsafe production issuer',
    async () => {
      const env = {
        JWT_ISSUER: 'https://api.example.com',
        JWT_AUDIENCE: 'audit',
        JWT_KEY_ID: 'audit',
        JWT_PRIVATE_KEY_PATH: 'private.pem',
        JWT_PUBLIC_KEY_PATH: 'public.pem',
      };
      assert.deepEqual(runtime(env).enabled, ['presence', 'leads']);
      for (const override of [
        { ENABLED_MODULES: 'content' },
        { ENABLED_MODULES: 'leads,leads' },
        { TRUST_PROXY_CIDRS: '0.0.0.0/0' },
        { NODE_ENV: 'production', JWT_ISSUER: 'http://api.example.com' },
        { PORT: 'NaN' },
      ])
        assert.throws(() => runtime({ ...env, ...override }));
    },
  );
  // Data-correctness probes below deliberately assert desired behavior, exposing current defects.
  await check('DATA-01: punctuation-only phone numbers must be rejected', async () => {
    const response = await api()
      .post(`/api/v1/leads/public/${supplier.id}`)
      .send({ ...inquiry, email: undefined, phone: '-------' });
    assert.equal(
      response.status,
      400,
      `Expected 400; received ${response.status} for phone ------- without email`,
    );
  });
  await check('DATA-02: whitespace-only business identity must be rejected', async () => {
    const response = await api()
      .post('/api/v1/core/suppliers')
      .set(auth(owner))
      .send({ businessName: ' ', city: ' ', category: ' ' });
    assert.equal(
      response.status,
      400,
      `Expected 400; received ${response.status} for blank businessName/category/city`,
    );
  });
  await check(
    'DATA-03: whitespace-only lead name, message and consent version must be rejected',
    async () => {
      const response = await api()
        .post(`/api/v1/leads/public/${supplier.id}`)
        .send({ ...inquiry, name: ' ', message: ' ', contactConsentVersion: ' ' });
      assert.equal(response.status, 400, `Expected 400; received ${response.status} for blank lead fields`);
    },
  );
  await check('CONTRACT-01: nullable stored lead contacts must match the response schema', async () => {
    const lead = (await api().get('/api/v1/leads').set(scope(owner, supplier)).expect(200)).body.find(
      (item) => item.id === receipt.body.id,
    );
    assert.equal(lead.phone, null);
    const property = specification(app).components.schemas.LeadResponseDto.properties.phone;
    assert.equal(
      property.nullable,
      true,
      `API returned phone:null but schema is ${JSON.stringify(property)}`,
    );
  });
  await check('TRACE-01: outbox correlation must match the originating API request', async () => {
    const event = await db.outboxEvent.findFirst({
      where: { name: 'leads.lead.created.v1', payload: { path: ['leadId'], equals: receipt.body.id } },
    });
    assert.equal(
      event.correlationId,
      receipt.headers['x-request-id'],
      'Outbox correlationId differs from the originating X-Request-Id',
    );
  });
  await check('INTEGRITY-01: Presence records must not reference nonexistent suppliers', async () => {
    let rejected = false;
    try {
      await db.presenceProfile.create({ data: { supplierId: randomUUID(), slug: 'orphan-profile' } });
    } catch (error) {
      if (error.code === 'P2003') rejected = true;
      else throw error;
    }
    assert.ok(rejected, 'Database accepted Presence profile with nonexistent supplierId');
  });
  await check('INTEGRITY-02: lead tenant and supplier references must stay consistent', async () => {
    let rejected = false;
    try {
      await db.leadOpportunity.create({
        data: { ...inquiry, supplierId: supplier.id, organizationId: otherSupplier.organizationId },
      });
    } catch (error) {
      if (error.code === 'P2003') rejected = true;
      else throw error;
    }
    assert.ok(rejected, 'Database accepted a lead whose organization differs from its supplier organization');
  });
  await check(
    'INTEGRITY-03: deleting an organization must not silently orphan its module records',
    async () => {
      const org = await db.organization.create({ data: { name: 'Deletion probe' } });
      const target = await db.supplier.create({
        data: {
          organizationId: org.id,
          businessName: 'Deletion probe',
          city: 'Beirut',
          category: 'Venue',
          serviceAreas: [],
        },
      });
      await db.presenceProfile.create({ data: { supplierId: target.id, slug: 'deleted-supplier-profile' } });
      let restricted = false;
      try {
        await db.organization.delete({ where: { id: org.id } });
      } catch (error) {
        if (error.code === 'P2003') restricted = true;
        else throw error;
      }
      assert.ok(
        restricted || (await db.presenceProfile.count({ where: { supplierId: target.id } })) === 0,
        'Supplier was cascaded away but its Presence profile remains',
      );
    },
  );
  const report = {
    auditedCommit: 'e3b0c5cbbaf3252bca78d5235c3d18f3630b7f5f',
    database: 'Fresh disposable PGlite; no live database accessed',
    passed: results.filter((r) => r.status === 'PASS').length,
    failed: results.filter((r) => r.status === 'FAIL').length,
    results,
  };
  console.log(JSON.stringify(report, null, 2));
  if (process.argv[2]) await writeFile(process.argv[2], `${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.failed ? 1 : 0;
} finally {
  if (app) await app.close();
  if (server) await server.stop();
  await pg.close();
  await rm(dir, { recursive: true, force: true });
}
