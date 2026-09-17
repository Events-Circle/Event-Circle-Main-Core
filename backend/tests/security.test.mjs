import { test, expect } from '@jest/globals';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SignJWT, importPKCS8 } from 'jose';
import { hashPassword, checkPassword, issuer, verifier } from '../dist/core/auth/tokens.js';

test('password hashes use unique salts and reject incorrect or corrupt credentials', async () => {
  const password = 'test-only long password 123!';
  const hash = await hashPassword(password);
  expect(hash).not.toBe(await hashPassword(password));
  expect(await checkPassword(password, hash)).toBe(true);
  expect(await checkPassword('wrong password', hash)).toBe(false);
  expect(await checkPassword(password, 'corrupt')).toBe(false);
});

test('JWT verification rejects tampering, wrong issuer/audience/key/type and expired tokens', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'circle-security-'));
  try {
    const keys = generateKeyPairSync('ed25519');
    const pem = keys.privateKey.export({ type: 'pkcs8', format: 'pem' });
    const config = {
      issuer: 'http://localhost:4000',
      audience: 'events-circle',
      keyId: 'test',
      privateKeyPath: join(dir, 'private.pem'),
      publicKeyPath: join(dir, 'public.pem'),
    };
    await writeFile(config.privateKeyPath, pem, { mode: 0o600 });
    await writeFile(config.publicKeyPath, keys.publicKey.export({ type: 'spki', format: 'pem' }));
    const signing = await issuer(config);
    const verifyOnly = await verifier({ ...config, privateKeyPath: undefined });
    const identity = { userId: randomUUID(), sessionId: randomUUID() };
    const valid = await signing.sign(identity);
    expect(await verifyOnly.verify(valid)).toEqual(identity);
    expect(signing.jwks.keys[0].d).toBeUndefined();
    await expect(verifyOnly.verify(valid.slice(0, -8) + 'invalid!')).rejects.toThrow();
    const key = await importPKCS8(pem, 'EdDSA');
    for (const overrides of [
      { iss: 'wrong' },
      { aud: 'wrong' },
      { exp: '-1s' },
      { typ: 'JWT' },
      { kid: 'wrong' },
    ]) {
      const values = {
        iss: config.issuer,
        aud: config.audience,
        exp: '10m',
        typ: 'at+jwt',
        kid: config.keyId,
        ...overrides,
      };
      const token = await new SignJWT({ sid: identity.sessionId })
        .setProtectedHeader({ alg: 'EdDSA', kid: values.kid, typ: values.typ })
        .setSubject(identity.userId)
        .setIssuer(values.iss)
        .setAudience(values.aud)
        .setIssuedAt()
        .setExpirationTime(values.exp)
        .sign(key);
      await expect(verifyOnly.verify(token)).rejects.toThrow();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
