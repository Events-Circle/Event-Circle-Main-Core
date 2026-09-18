import { beforeAll, afterAll, test, expect } from '@jest/globals';
import request from 'supertest';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { migrateDisposable } from './migrations.mjs';
import { createApp, specification } from '../dist/app.js';
import { Database } from '../dist/common/database.js';
import { ObjectStore } from '../dist/core/media/object-store.js';
import { EventsService } from '../dist/core/audit/events.service.js';
let app,
  db,
  dir,
  pg,
  server,
  owner,
  other,
  supplier,
  otherSupplier,
  image,
  media,
  listing,
  project,
  gallery,
  config;
const suffix = randomUUID();
const slug = `presence-${suffix}`;
const categoryId = '20000000-0000-4000-8000-000000000001';
const api = () => request(app.getHttpServer());
const auth = (user = owner, target = supplier) => ({
  Authorization: `Bearer ${user.accessToken}`,
  'X-Organization-Id': target.organizationId,
});
const path = (c, id = '') => `/api/v1/presence/collections/${c}${id ? '/' + id : ''}`;
const pub = (c, id = '') => `/api/v1/presence/public/${slug}/collections/${c}${id ? '/' + id : ''}`;
const current = async () => (await api().get('/api/v1/presence/profile').set(auth()).expect(200)).body;
const payload = () => ({
  title: 'Wedding package',
  description: 'Photography for your event',
  categoryId,
  media: [{ mediaId: media.id, role: 'COVER', altText: 'Wedding reception' }],
});
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'presence-api-'));
  if (!process.env.TEST_DATABASE_URL) {
    const { PGlite } = await import('@electric-sql/pglite');
    const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket');
    pg = await PGlite.create();
    await migrateDisposable(pg);
    server = new PGLiteSocketServer({ db: pg, host: '127.0.0.1', port: 0 });
    await server.start();
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
    audience: 'test',
    keyId: 'test',
    privateKeyPath: join(dir, 'private.pem'),
    publicKeyPath: join(dir, 'public.pem'),
    cors: [],
    trustProxy: [],
    edition: 'growth-os',
    enabled: ['presence', 'leads'],
    publicWebUrl: 'https://presence.example.com',
  };
  app = await createApp(config);
  await app.init();
  db = app.get(Database);
  const objects = new Map();
  const store = app.get(ObjectStore);
  store.put = async (key, bytes) => {
    objects.set(key, bytes);
  };
  store.get = async (key) => objects.get(key);
  image = await sharp({ create: { width: 16, height: 12, channels: 3, background: '#234567' } })
    .png()
    .toBuffer();
  const register = async (name) =>
    (
      await api()
        .post('/api/v1/core/auth/register')
        .send({
          email: `${name}-${suffix}@example.com`,
          displayName: name,
          password: 'Testing long password 123!',
        })
        .expect(201)
    ).body;
  owner = await register('owner');
  other = await register('other');
  const create = async (user) =>
    (
      await api()
        .post('/api/v1/core/suppliers')
        .set({ Authorization: `Bearer ${user.accessToken}` })
        .send({ businessName: 'Studio', category: 'Photography', city: 'Beirut', acceptInquiries: true })
        .expect(201)
    ).body;
  supplier = await create(owner);
  otherSupplier = await create(other);
}, 120000);
afterAll(async () => {
  await app?.close();
  await server?.stop();
  await pg?.close();
  if (dir) await rm(dir, { recursive: true, force: true });
}, 30000);

test('Core processes images, rejects unsafe bytes, and masks foreign media IDs', async () => {
  await api().post('/api/v1/core/media').attach('file', image, 'photo.png').expect(401);
  await api()
    .post('/api/v1/core/media')
    .set(auth())
    .attach('file', Buffer.from('<svg/>'), 'image.svg')
    .expect(400);
  media = (await api().post('/api/v1/core/media').set(auth()).attach('file', image, 'photo.png').expect(201))
    .body;
  expect(media).toMatchObject({ status: 'READY', mimeType: 'image/webp', width: 16, height: 12 });
  expect(media.objectKey).toBeUndefined();
  const owned = (await api().get('/api/v1/core/media').set(auth()).expect(200)).body;
  expect(owned.some((row) => row.id === media.id)).toBe(true);
  expect(
    (await api().get('/api/v1/core/media').set(auth(other, otherSupplier)).expect(200)).body,
  ).toHaveLength(0);
  await api().get(`/api/v1/core/media/${media.id}/file`).set(auth(other, otherSupplier)).expect(404);
  const file = await api().get(`/api/v1/core/media/${media.id}/file`).set(auth()).expect(200);
  expect((await sharp(file.body).metadata()).format).toBe('webp');
});

test('OpenAPI preserves nullable scalar types and required optimistic response versions', () => {
  const schemas = specification(app).components.schemas;
  expect(schemas.PresenceDto.properties.logoMediaId).toMatchObject({ type: 'string', nullable: true });
  expect(schemas.ContentWriteDto.properties.amountMinor).toMatchObject({ type: 'number', nullable: true });
  expect(schemas.ContentResponseDto.required).toContain('version');
  expect(schemas.PresenceResponseDto.required).toContain('version');
});
test('profile readiness, safe social links, logo ownership, normalization and publication', async () => {
  await api()
    .put('/api/v1/presence/profile')
    .set(auth())
    .send({ slug: ` ${slug.toUpperCase()} `, description: 'Our studio', published: false })
    .expect(200);
  const ready = (await api().get('/api/v1/presence/readiness').set(auth()).expect(200)).body;
  expect(ready.missing).toEqual(['logoMediaId']);
  const profile = await current();
  const blocked = await api()
    .post('/api/v1/presence/profile/publish')
    .set(auth())
    .send({ version: profile.version })
    .expect(422);
  expect(blocked.body.code).toBe('PRESENCE_NOT_READY');
  expect(blocked.body.details.missing).toContain('logoMediaId');
  await api()
    .put('/api/v1/presence/profile')
    .set(auth(other, otherSupplier))
    .send({ slug: `other-${suffix}`, description: 'Other', published: false, logoMediaId: media.id })
    .expect(404);
  await api()
    .put('/api/v1/presence/profile')
    .set(auth())
    .send({
      slug,
      description: 'Studio',
      published: false,
      socialLinks: [{ provider: 'WEBSITE', url: 'javascript:alert(1)' }],
    })
    .expect(422);
  await api()
    .put('/api/v1/presence/profile')
    .set(auth())
    .send({
      slug,
      description: 'Studio',
      published: false,
      logoMediaId: media.id,
      seoTitle: 'Studio',
      socialLinks: [{ provider: 'WEBSITE', url: 'https://example.com' }],
    })
    .expect(200);
  await api()
    .post('/api/v1/presence/profile/publish')
    .set(auth())
    .send({ version: (await current()).version })
    .expect(201);
  const count = await db.outboxEvent.count({
    where: { organizationId: supplier.organizationId, name: 'presence.profile.published.v1' },
  });
  await api()
    .post('/api/v1/presence/profile/publish')
    .set(auth())
    .send({ version: (await current()).version })
    .expect(201);
  expect(
    await db.outboxEvent.count({
      where: { organizationId: supplier.organizationId, name: 'presence.profile.published.v1' },
    }),
  ).toBe(count);
});
test('category details validate, persist, preserve omitted values and publish only with the profile', async () => {
  const schemas = (await api().get('/api/v1/presence/detail-types').expect(200)).body;
  expect(schemas.map((s) => s.id)).toEqual(['VENUE', 'PHOTO_VIDEO', 'CATERING', 'ENTERTAINMENT', 'GENERAL']);
  const save = async (details, version) => {
    const p = await current();
    return api()
      .put('/api/v1/presence/profile')
      .set(auth())
      .send({
        slug: p.slug,
        description: p.description,
        published: p.published,
        version: version ?? p.version,
        ...(details === undefined ? {} : { categoryDetails: details }),
      });
  };
  const details = { type: 'VENUE', values: { seatedCapacity: 120, parking: false, spaceType: 'Outdoor' } };
  const initial = await current();
  expect((await save(details)).status).toBe(200);
  expect((await current()).categoryDetails).toEqual(details);
  expect((await api().get(`/api/v1/presence/public/${slug}`).expect(200)).body.categoryDetails).toEqual(
    details,
  );
  expect((await save(undefined)).status).toBe(200);
  expect((await current()).categoryDetails).toEqual(details);
  expect((await save(details, initial.version)).status).toBe(409);
  for (const invalid of [
    null,
    [],
    { type: 'UNKNOWN', values: {} },
    { type: 'VENUE', values: { deliveryDays: 2 } },
    { type: 'VENUE', values: { seatedCapacity: -1 } },
    { type: 'VENUE', values: { seatedCapacity: 2.5 } },
    { type: 'VENUE', values: { parking: 'yes' } },
    { type: 'VENUE', values: { parking: null } },
    { type: 'CATERING', values: { minimumGuests: 100, maximumGuests: 20 } },
    { type: 'CATERING', values: { dietaryOptions: ['Vegan', 'Vegan'] } },
    { type: 'GENERAL', values: { specialties: 'x'.repeat(501) } },
  ]) {
    expect((await save(invalid)).status).toBe(400);
  }
  expect((await current()).categoryDetails).toEqual(details);
  const switched = { type: 'ENTERTAINMENT', values: { setupMinutes: 0, equipmentIncluded: false } };
  expect((await save(switched)).status).toBe(200);
  expect((await current()).categoryDetails).toEqual(switched);
  expect((await save({ type: 'GENERAL', values: {} })).status).toBe(200);
  expect((await current()).categoryDetails.values).toEqual({});
});

test('create, publish, public aggregate, private drafts and inquiry handoff form a complete backend journey', async () => {
  listing = (
    await api()
      .post(path('listings'))
      .set(auth())
      .send({ ...payload(), type: 'PACKAGE', pricingMode: 'FIXED', amountMinor: 10000, currency: 'USD' })
      .expect(201)
  ).body;
  project = (await api().post(path('portfolio')).set(auth()).send(payload()).expect(201)).body;
  gallery = (await api().post(path('gallery')).set(auth()).send(payload()).expect(201)).body;
  await api().get(pub('listings', listing.id)).expect(404);
  for (const [collection, row] of [
    ['listings', listing],
    ['portfolio', project],
    ['gallery', gallery],
  ]) {
    const response = await api()
      .post(path(collection, row.id) + '/publish')
      .set(auth())
      .send({ version: row.version })
      .expect(201);
    row.version = response.body.version;
  }
  await api()
    .post(path('portfolio'))
    .set(auth())
    .send({ ...payload(), title: 'Private draft' })
    .expect(201);
  const page = (await api().get(`/api/v1/presence/public/${slug}`).expect(200)).body;
  expect(page.portfolio).toHaveLength(1);
  expect(page.listings).toHaveLength(1);
  expect(page.gallery).toHaveLength(1);
  expect(page.listings[0].supplierId).toBeUndefined();
  expect(page.listings[0].status).toBeUndefined();
  expect(page.supplier.organizationId).toBeUndefined();
  expect(page.inquiriesEnabled).toBe(true);
  await api().get(`/api/v1/presence/public/${slug}/media/${media.id}`).expect(200);
  const share = (await api().get(`/api/v1/presence/public/${slug}/share`).expect(200)).body;
  expect(share.qrPayload).toBe(`https://presence.example.com/p/${slug}`);
  const lead = (
    await api()
      .post(page.inquiryPath)
      .send({
        name: 'Visitor',
        email: 'visitor@example.com',
        message: 'Interested in this package',
        source: 'PROFILE',
        contactConsent: true,
        contactConsentVersion: 'v1',
      })
      .expect(201)
  ).body;
  expect(
    (await api().get('/api/v1/leads').set(auth()).expect(200)).body.some((row) => row.id === lead.id),
  ).toBe(true);
});
test('tenant isolation masks guessed IDs and rejects foreign media/reorder; stale edits conflict', async () => {
  await api()
    .put('/api/v1/presence/profile')
    .set(auth(other, otherSupplier))
    .send({ slug: `other-${suffix}`, description: 'Other', published: false })
    .expect(200);
  for (const collection of ['portfolio', 'listings', 'gallery']) {
    const row = { portfolio: project, listings: listing, gallery }[collection];
    await api().get(path(collection, row.id)).set(auth(other, otherSupplier)).expect(404);
    await api()
      .put(path(collection, row.id))
      .set(auth(other, otherSupplier))
      .send({ ...payload(), version: row.version })
      .expect(404);
    await api()
      .post(path(collection, row.id) + '/publish')
      .set(auth(other, otherSupplier))
      .send({ version: row.version })
      .expect(404);
    await api()
      .delete(path(collection, row.id))
      .set(auth(other, otherSupplier))
      .send({ version: row.version })
      .expect(404);
  }
  await api().post(path('portfolio')).set(auth(other, otherSupplier)).send(payload()).expect(404);
  await api()
    .put(path('portfolio', project.id))
    .set(auth())
    .send({ ...payload(), version: 1 })
    .expect(409);
  const version = (await current()).version;
  await api()
    .post(path('listings') + '/reorder')
    .set(auth())
    .send({ ids: [randomUUID()], version })
    .expect(422);
  expect((await current()).version).toBe(version);
});
test('publication, ordering and media attachment roll back if outbox writing fails', async () => {
  const events = app.get(EventsService),
    original = events.record;
  const before = await current();
  events.record = async () => {
    throw new Error('Simulated failure');
  };
  try {
    await api()
      .post(path('portfolio'))
      .set(auth())
      .send({ ...payload(), title: 'Rollback' })
      .expect(500);
    await api()
      .post(path('listings') + '/reorder')
      .set(auth())
      .send({ ids: [listing.id], version: before.version })
      .expect(500);
    await api()
      .post(path('listings', listing.id) + '/unpublish')
      .set(auth())
      .send({ version: listing.version })
      .expect(500);
  } finally {
    events.record = original;
  }
  expect((await current()).version).toBe(before.version);
  expect(await db.presenceContent.count({ where: { supplierId: supplier.id, title: 'Rollback' } })).toBe(0);
  await api().get(pub('listings', listing.id)).expect(200);
});
test('pagination is bounded; reordering is versioned; archived content is private and restores to draft', async () => {
  const page = await api()
    .get(path('portfolio') + '?limit=1')
    .set(auth())
    .expect(200);
  expect(page.body).toHaveLength(1);
  expect(page.headers['x-next-cursor']).toBeTruthy();
  const second = await api()
    .get(path('portfolio') + `?limit=1&cursor=${page.headers['x-next-cursor']}`)
    .set(auth())
    .expect(200);
  expect(second.body[0].id).not.toBe(page.body[0].id);
  await api()
    .get(path('portfolio') + '?limit=101')
    .set(auth())
    .expect(400);
  const version = (await current()).version;
  await api()
    .post(path('listings') + '/reorder')
    .set(auth())
    .send({ ids: [listing.id], version })
    .expect(201);
  await api()
    .post(path('listings') + '/reorder')
    .set(auth())
    .send({ ids: [listing.id], version })
    .expect(409);
  const archived = (
    await api().delete(path('gallery', gallery.id)).set(auth()).send({ version: gallery.version }).expect(200)
  ).body;
  await api().get(pub('gallery', gallery.id)).expect(404);
  const restored = (
    await api()
      .post(path('gallery', gallery.id) + '/restore')
      .set(auth())
      .send({ version: archived.version })
      .expect(201)
  ).body;
  expect(restored.status).toBe('DRAFT');
  await api().get(pub('gallery', gallery.id)).expect(404);
});
test('expired offers disappear at query time without a worker; profile withdrawal hides content and media', async () => {
  let offer = (
    await api()
      .post(path('listings'))
      .set(auth())
      .send({
        ...payload(),
        type: 'OFFER',
        pricingMode: 'FREE',
        validUntil: new Date(Date.now() + 60000).toISOString(),
      })
      .expect(201)
  ).body;
  offer = (
    await api()
      .post(path('listings', offer.id) + '/publish')
      .set(auth())
      .send({ version: offer.version })
      .expect(201)
  ).body;
  await db.presenceContent.update({
    where: { id: offer.id },
    data: { validUntil: new Date(Date.now() - 1000) },
  });
  await api().get(pub('listings', offer.id)).expect(404);
  expect(await db.presenceContent.findUnique({ where: { id: offer.id } })).toBeTruthy();
  await api()
    .post('/api/v1/presence/profile/unpublish')
    .set(auth())
    .send({ version: (await current()).version })
    .expect(201);
  await api().get(pub('portfolio', project.id)).expect(404);
  await api().get(`/api/v1/presence/public/${slug}/media/${media.id}`).expect(404);
  await api().get(`/api/v1/presence/public/${slug}/share`).expect(404);
});

test('Core catalogs validate kinds; contact visibility is explicit and ETags revalidate publication', async () => {
  const categories = (await api().get('/api/v1/core/catalogs/categories').expect(200)).body;
  expect(categories.some((c) => c.id === categoryId)).toBe(true);
  const input = {
    businessName: 'Studio',
    category: 'Photography',
    city: 'Beirut',
    acceptInquiries: true,
    contactEmail: 'public@example.com',
    contactPhone: '+9611234567',
  };
  await api()
    .put('/api/v1/core/suppliers/current')
    .set(auth())
    .send({ ...input, categoryId: '20000000-0000-4000-8000-000000000101' })
    .expect(400);
  await api().put('/api/v1/core/suppliers/current').set(auth()).send(input).expect(200);
  await api()
    .post('/api/v1/presence/profile/publish')
    .set(auth())
    .send({ version: (await current()).version })
    .expect(201);
  let response = await api().get(`/api/v1/presence/public/${slug}`).expect(200);
  expect(response.body.supplier.contactEmail).toBeUndefined();
  await api().get(`/api/v1/presence/public/${slug}`).set('If-None-Match', response.headers.etag).expect(304);
  await api()
    .put('/api/v1/presence/profile')
    .set(auth())
    .send({ slug, description: 'Studio', published: true, showEmail: true })
    .expect(200);
  const changed = await api()
    .get(`/api/v1/presence/public/${slug}`)
    .set('If-None-Match', response.headers.etag)
    .expect(200);
  expect(changed.body.supplier.contactEmail).toBe(input.contactEmail);
  expect(changed.body.supplier.contactPhone).toBeUndefined();
  await api()
    .post('/api/v1/presence/profile/unpublish')
    .set(auth())
    .send({ version: (await current()).version })
    .expect(201);
  await api().get(`/api/v1/presence/public/${slug}`).set('If-None-Match', changed.headers.etag).expect(404);
});

test('VIEWER cannot upload/write/publish; EDITOR can publish through Core permissions', async () => {
  const uid = (await api().get('/api/v1/core/me').set(auth(other, otherSupplier))).body.id;
  const membership = await db.membership.create({
    data: { userId: uid, organizationId: supplier.organizationId, role: 'VIEWER' },
  });
  await api().get(path('listings')).set(auth(other, supplier)).expect(200);
  await api().post(path('listings')).set(auth(other, supplier)).send(payload()).expect(403);
  await api()
    .post('/api/v1/core/media')
    .set(auth(other, supplier))
    .attach('file', image, 'photo.png')
    .expect(403);
  await api()
    .post('/api/v1/presence/profile/publish')
    .set(auth(other, supplier))
    .send({ version: (await current()).version })
    .expect(403);
  await db.membership.update({ where: { id: membership.id }, data: { role: 'EDITOR' } });
  await api()
    .post('/api/v1/presence/profile/publish')
    .set(auth(other, supplier))
    .send({ version: (await current()).version })
    .expect(201);
});

test('Presence-only edition serves published content without an inquiry CTA; Core-only has no Presence routes', async () => {
  await db.$disconnect();
  for (const enabled of [['presence'], []]) {
    const isolated = await createApp({
      ...config,
      enabled,
      edition: enabled.length ? 'circle-presence' : 'growth-os',
    });
    await isolated.init();
    try {
      const response = await request(isolated.getHttpServer())
        .get(`/api/v1/presence/public/${slug}`)
        .expect(enabled.length ? 200 : 404);
      if (enabled.length) {
        expect(response.body.inquiriesEnabled).toBe(false);
        expect(response.body.inquiryPath).toBe(null);
        expect(response.body.portfolio).toHaveLength(1);
      }
    } finally {
      await isolated.close();
    }
  }
});
