import { test, expect } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const migration = (name) =>
  readFile(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url), 'utf8');
const org = '10000000-0000-4000-8000-000000000001';
const supplier = '10000000-0000-4000-8000-000000000002';
const profile = '10000000-0000-4000-8000-000000000003';
const lead = '10000000-0000-4000-8000-000000000004';
async function baseline() {
  const pg = await PGlite.create();
  await pg.exec(await migration('202609160001_monolith'));
  await pg.query('INSERT INTO core_organizations (id,name) VALUES ($1,$2)', [org, 'Existing studio']);
  await pg.query(
    'INSERT INTO core_suppliers (id,"organizationId","businessName",category,city,"serviceAreas","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,now())',
    [supplier, org, 'Existing studio', 'Venue', 'Beirut', []],
  );
  return pg;
}
test('integrity upgrade preserves valid existing profiles and leads; outbox upgrade preserves pending rows', async () => {
  const pg = await baseline();
  try {
    await pg.query(
      'INSERT INTO presence_profiles (id,"supplierId",slug,"updatedAt") VALUES ($1,$2,$3,now())',
      [profile, supplier, 'existing-studio'],
    );
    await pg.query(
      'INSERT INTO lead_opportunities (id,"supplierId","organizationId",name,email,message,"contactConsent","contactConsentVersion","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,true,$7,now())',
      [lead, supplier, org, 'Existing prospect', 'prospect@example.com', 'Existing inquiry', 'v1'],
    );
    await pg.query(
      'INSERT INTO core_outbox_events (id,name,"organizationId",payload,"correlationId") VALUES ($1,$2,$3,$4,$5)',
      [lead, 'leads.lead.created.v1', org, '{}', 'existing-correlation'],
    );
    await pg.exec(await migration('202609170001_integrity'));
    await pg.exec(await migration('202609170002_outbox_delivery'));
    expect((await pg.query('SELECT email FROM lead_opportunities WHERE id=$1', [lead])).rows[0].email).toBe(
      'prospect@example.com',
    );
    expect((await pg.query('SELECT slug FROM presence_profiles WHERE id=$1', [profile])).rows[0].slug).toBe(
      'existing-studio',
    );
    const event = (await pg.query('SELECT * FROM core_outbox_events WHERE id=$1', [lead])).rows[0];
    expect(event.deliveredAt).toBe(null);
    expect(event.attempts).toBe(0);
    expect(event.nextAttemptAt).toBeTruthy();
    expect(event.correlationId).toBe('existing-correlation');
  } finally {
    await pg.close();
  }
});
test('integrity upgrade refuses an existing orphan without silently deleting it', async () => {
  const pg = await baseline();
  try {
    await pg.query(
      'INSERT INTO presence_profiles (id,"supplierId",slug,"updatedAt") VALUES ($1,$2,$3,now())',
      [profile, lead, 'orphan'],
    );
    await expect(pg.exec(await migration('202609170001_integrity'))).rejects.toMatchObject({ code: '23503' });
    await pg.exec('ROLLBACK');
    expect((await pg.query('SELECT count(*) FROM presence_profiles')).rows[0].count).toBe(1);
  } finally {
    await pg.close();
  }
});
test('integrity upgrade refuses an existing tenant mismatch without rewriting the record', async () => {
  const pg = await baseline();
  try {
    await pg.query(
      'INSERT INTO lead_opportunities (id,"supplierId","organizationId",name,email,message,"contactConsent","contactConsentVersion","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,true,$7,now())',
      [lead, supplier, profile, 'Existing prospect', 'prospect@example.com', 'Existing inquiry', 'v1'],
    );
    await expect(pg.exec(await migration('202609170001_integrity'))).rejects.toMatchObject({ code: '23503' });
    await pg.exec('ROLLBACK');
    expect(
      (await pg.query('SELECT "organizationId" FROM lead_opportunities WHERE id=$1', [lead])).rows[0]
        .organizationId,
    ).toBe(profile);
  } finally {
    await pg.close();
  }
});
