import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, rm, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SignJWT, importPKCS8 } from 'jose';
import { hashPassword, checkPassword, issuer, verifier } from '../dist/packages/runtime/tokens.js';
import { configuration } from '../dist/packages/runtime/config.js';
import { httpServer } from '../dist/packages/runtime/http.js';

export async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'circle-test-'));
  const keys = generateKeyPairSync('ed25519');
  const pem = keys.privateKey.export({ type: 'pkcs8', format: 'pem' });
  await writeFile(join(directory, 'private.pem'), pem, { mode: 0o600 });
  await writeFile(join(directory, 'public.pem'), keys.publicKey.export({ type: 'spki', format: 'pem' }));
  const config = configuration({ NODE_ENV: 'test', JWT_ISSUER: 'http://localhost:4000', JWT_AUDIENCE: 'events-circle', JWT_KEY_ID: 'test', JWT_PRIVATE_KEY_PATH: join(directory, 'private.pem'), JWT_PUBLIC_KEY_PATH: join(directory, 'public.pem'), CORE_API_URL: 'http://localhost:4000' });
  return { config, pem, cleanup: () => rm(directory, { recursive: true, force: true }) };
}
test('salted password hashes verify and reject wrong passwords', async () => {
  const password = 'test passphrase 0123456789';
  const hash = await hashPassword(password);
  assert.notEqual(hash, await hashPassword(password));
  assert.equal(await checkPassword(password, hash), true);
  assert.equal(await checkPassword('wrong password', hash), false);
  assert.equal(await checkPassword(password, 'corrupt'), false);
});
test('tokens require correct signature, issuer, audience, expiry, and type', async t => {
  const f = await fixture(); t.after(f.cleanup);
  const signing = await issuer(f.config);
  const verifyOnly = await verifier({ ...f.config, JWT_PRIVATE_KEY_PATH: undefined });
  const identity = { userId: randomUUID(), sessionId: randomUUID() };
  const valid = await signing.sign(identity);
  assert.deepEqual(await verifyOnly.verify(valid), identity);
  assert.equal(signing.jwks.keys[0].d, undefined);
  await assert.rejects(verifyOnly.verify(valid.slice(0, -8) + 'invalid!'));
  const key = await importPKCS8(f.pem, 'EdDSA');
  for (const [iss, aud, exp, typ] of [
    ['wrong', f.config.JWT_AUDIENCE, '10m', 'at+jwt'],
    [f.config.JWT_ISSUER, 'wrong', '10m', 'at+jwt'],
    [f.config.JWT_ISSUER, f.config.JWT_AUDIENCE, '-1s', 'at+jwt'],
    [f.config.JWT_ISSUER, f.config.JWT_AUDIENCE, '10m', 'JWT'],
  ]) {
    const token = await new SignJWT({ sid: identity.sessionId }).setProtectedHeader({ alg: 'EdDSA', kid: 'test', typ }).setSubject(identity.userId).setIssuer(iss).setAudience(aud).setIssuedAt().setExpirationTime(exp).sign(key);
    await assert.rejects(verifyOnly.verify(token));
  }
});
test('API liveness survives unavailable database; ready fails closed', async t => {
  const f = await fixture(); t.after(f.cleanup);
  const app = await httpServer(f.config, 'test', async () => { throw new Error('offline'); });
  t.after(() => app.close());
  assert.equal((await app.inject('/health/live')).statusCode, 200);
  assert.equal((await app.inject('/health/ready')).statusCode, 503);
});
test('untrusted forwarded headers cannot bypass application rate limits', async t => {
  const f = await fixture(); t.after(f.cleanup);
  const app = await httpServer(f.config, 'test', async () => {}); t.after(() => app.close());
  app.get('/limited', { config: { rateLimit: { max: 1, timeWindow: '1 minute' } } }, async () => ({ ok: true }));
  assert.equal((await app.inject({ url: '/limited', headers: { 'x-forwarded-for': '1.1.1.1' } })).statusCode, 200);
  assert.equal((await app.inject({ url: '/limited', headers: { 'x-forwarded-for': '2.2.2.2' } })).statusCode, 429);
});
test('module source cannot import shared database or authentication implementation', async () => {
  async function walk(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (file.endsWith('.ts')) assert.doesNotMatch(await readFile(file, 'utf8'), /from\s+['"][^'"]*(?:generated\/core|shared\/)/, file);
    }
  }
  await walk('modules');
});
