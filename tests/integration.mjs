import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCore } from '../dist/shared/app.js';
import { createGrowth } from '../dist/modules/growth/app.js';
import { PrismaClient as CoreDb } from '../generated/core/index.js';
import { PrismaClient as GrowthDb } from '../generated/growth/index.js';
import { configuration } from '../dist/packages/runtime/config.js';

test('complete identity and supplier isolation flow against separate databases', { timeout: 120000 }, async t => {
  const resources = [];
  const dir = await mkdtemp(join(tmpdir(), 'circle-integration-'));
  t.after(async () => {
    for (const cleanup of resources.reverse()) await cleanup();
    await rm(dir, { recursive: true, force: true });
  });
  let coreUrl = process.env.CORE_DATABASE_URL;
  let growthUrl = process.env.GROWTH_DATABASE_URL;
  if (!!coreUrl !== !!growthUrl) throw new Error('Provide both test database URLs or neither');
  if (!coreUrl) {
    // Portable Postgres/WASM fallback; native PostgreSQL is also tested in CI.
    const { PGlite } = await import('@electric-sql/pglite');
    const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket');
    const urls = [];
    for (const path of ['shared', 'modules/growth']) {
      const pg = await PGlite.create();
      resources.push(() => pg.close());
      await pg.exec(await readFile(`${path}/migrations/202609160001_init/migration.sql`, 'utf8'));
      const server = new PGLiteSocketServer({ db: pg, host: '127.0.0.1', port: 0 });
      await server.start(); resources.push(() => server.stop());
      urls.push(`postgresql://postgres:postgres@${server.getServerConn()}/postgres?connection_limit=1&sslmode=disable`);
    }
    [coreUrl, growthUrl] = urls;
  }
  const coreDb = new CoreDb({ datasources: { db: { url: coreUrl } } });
  const growthDb = new GrowthDb({ datasources: { db: { url: growthUrl } } });
  const keys = generateKeyPairSync('ed25519');
  await writeFile(join(dir, 'private.pem'), keys.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  await writeFile(join(dir, 'public.pem'), keys.publicKey.export({ type: 'spki', format: 'pem' }));
  const config = configuration({ NODE_ENV: 'test', JWT_ISSUER: 'http://localhost:4000', JWT_AUDIENCE: 'events-circle', JWT_KEY_ID: 'integration', JWT_PUBLIC_KEY_PATH: join(dir, 'public.pem'), JWT_PRIVATE_KEY_PATH: join(dir, 'private.pem'), CORE_API_URL: 'http://localhost:4000' });
  const core = await createCore(config, coreDb); resources.push(() => core.close());
  // Use a real HTTP Core service for the module's session/access checks.
  const coreAddress = await core.listen({ port: 0, host: '127.0.0.1' });
  assert.equal((await core.inject('/health/ready')).statusCode, 200);
  const growth = await createGrowth({ ...config, CORE_API_URL: coreAddress, JWT_PRIVATE_KEY_PATH: undefined }, growthDb);
  resources.push(() => growth.close());
  const password = 'test-only long password 123!';
  const suffix = randomUUID();
  const register = async name => {
    const response = await core.inject({ method: 'POST', url: '/v1/auth/register', payload: { email: `${name}-${suffix}@example.com`, password, displayName: name } });
    assert.equal(response.statusCode, 201, response.body);
    return response.json();
  };
  const a = await register('supplier-a');
  const b = await register('supplier-b');
  const headers = token => ({ authorization: `Bearer ${token}` });
  const me = await core.inject({ url: '/v1/me', headers: headers(a.accessToken) });
  assert.equal(me.statusCode, 200); assert.equal(me.json().passwordHash, undefined);
  const uid = me.json().id;
  const stored = await coreDb.user.findUnique({ where: { id: uid } });
  assert.notEqual(stored.passwordHash, password);
  assert.equal(await coreDb.refreshToken.count({ where: { tokenHash: a.refreshToken } }), 0);
  assert.equal((await core.inject({ method: 'PATCH', url: '/v1/me', headers: headers(a.accessToken), payload: { role: 'admin' } })).statusCode, 400);
  assert.equal((await core.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: stored.email, password: 'wrong-but-long-password' } })).statusCode, 401);
  const slug = `studio-${suffix}`;
  const supplier = await growth.inject({ method: 'PUT', url: '/v1/supplier', headers: headers(a.accessToken), payload: { slug, businessName: 'Test Studio', category: 'Photography', city: 'Beirut' } });
  assert.equal(supplier.statusCode, 200, supplier.body);
  assert.equal((await growth.inject(`/v1/public/suppliers/${slug}`)).statusCode, 404);
  const published = await growth.inject({ method: 'PUT', url: '/v1/supplier', headers: headers(a.accessToken), payload: { slug, businessName: 'Test Studio', category: 'Photography', city: 'Beirut', published: true } });
  assert.equal(published.statusCode, 200);
  const publicProfile = await growth.inject(`/v1/public/suppliers/${slug}`);
  assert.equal(publicProfile.statusCode, 200); assert.equal(publicProfile.json().coreUserId, undefined);
  const inquiry = { name: 'Prospect', email: 'prospect@example.com', message: 'Wedding photography inquiry', contactConsent: true, source: 'QR' };
  const leadResponse = await growth.inject({ method: 'POST', url: `/v1/public/suppliers/${slug}/inquiries`, payload: inquiry });
  assert.equal(leadResponse.statusCode, 201, leadResponse.body);
  assert.deepEqual(leadResponse.json(), { received: true });
  assert.equal((await growth.inject({ method: 'POST', url: `/v1/public/suppliers/${slug}/inquiries`, payload: { ...inquiry, contactConsent: false } })).statusCode, 400);
  const leadsA = await growth.inject({ url: '/v1/leads', headers: headers(a.accessToken) });
  assert.equal(leadsA.json().items.length, 1);
  const leadId = leadsA.json().items[0].id;
  assert.equal((await growth.inject({ url: '/v1/leads', headers: headers(b.accessToken) })).json().items.length, 0);
  assert.equal((await growth.inject({ method: 'PATCH', url: `/v1/leads/${leadId}`, headers: headers(b.accessToken), payload: { stage: 'WON' } })).statusCode, 404);
  assert.equal((await growth.inject({ method: 'PATCH', url: `/v1/leads/${leadId}`, headers: headers(a.accessToken), payload: { stage: 'QUALIFIED' } })).statusCode, 204);
  assert.equal((await growth.inject({ url: '/v1/leads', headers: headers(a.accessToken) })).json().items[0].stage, 'QUALIFIED');
  const sub = await coreDb.subscription.create({ data: { userId: uid, planCode: 'test-plan', status: 'active', provider: 'test', providerReference: suffix, features: ['growth:automation'], startsAt: new Date(Date.now() - 1000), endsAt: new Date(Date.now() + 60000) } });
  assert.ok((await core.inject({ url: '/v1/access', headers: headers(a.accessToken) })).json().features.includes('growth:automation'));
  await coreDb.subscription.update({ where: { id: sub.id }, data: { endsAt: new Date(Date.now() - 1) } });
  assert.ok(!(await core.inject({ url: '/v1/access', headers: headers(a.accessToken) })).json().features.includes('growth:automation'));
  const refresh = await core.inject({ method: 'POST', url: '/v1/auth/refresh', payload: { refreshToken: a.refreshToken } });
  assert.equal(refresh.statusCode, 200, refresh.body);
  assert.notEqual(refresh.json().refreshToken, a.refreshToken);
  assert.equal((await core.inject({ method: 'POST', url: '/v1/auth/refresh', payload: { refreshToken: a.refreshToken } })).statusCode, 401);
  assert.equal((await core.inject({ url: '/v1/me', headers: headers(refresh.json().accessToken) })).statusCode, 401);
  assert.equal((await growth.inject({ url: '/v1/leads', headers: headers(refresh.json().accessToken) })).statusCode, 401);
  assert.equal((await core.inject({ method: 'POST', url: '/v1/auth/logout', headers: headers(b.accessToken) })).statusCode, 204);
  assert.equal((await core.inject({ url: '/v1/me', headers: headers(b.accessToken) })).statusCode, 401);
  // Database isolation is real: neither database contains the other's tables.
  const coreTables = await coreDb.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
  const growthTables = await growthDb.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
  assert.ok(!coreTables.some(row => row.table_name === 'Supplier'));
  assert.ok(!growthTables.some(row => row.table_name === 'User'));
  // A stopped module must not prevent shared identity from responding.
  await growth.close();
  assert.equal((await core.inject('/health/ready')).statusCode, 200);
});
