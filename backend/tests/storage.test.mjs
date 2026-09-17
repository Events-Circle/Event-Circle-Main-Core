import { test, expect } from '@jest/globals';
import { Readable } from 'node:stream';
import { ObjectStore } from '../dist/core/media/object-store.js';
import { runtime } from '../dist/config/runtime.js';
const config = {
  storageUrl: 'https://t3.storageapi.dev',
  storageAccessKeyId: 'test-access',
  storageSecretAccessKey: 'test-secret',
  storageRegion: 'auto',
  storageBucket: 'private-test',
};
test('Railway S3 adapter signs private requests, preserves bytes, and redacts provider failures', async () => {
  const store = new ObjectStore(config);
  const calls = [];
  store.client.config.requestHandler = {
    handle: async (request) => {
      calls.push(request);
      return { response: { statusCode: 200, headers: {}, body: Readable.from([Buffer.from([1, 2, 3])]) } };
    },
  };
  await store.put('org/image.webp', Buffer.from([1, 2, 3]));
  expect(calls[0].method).toBe('PUT');
  expect(calls[0].hostname).toBe('private-test.t3.storageapi.dev');
  expect(calls[0].path).toBe('/org/image.webp');
  expect(calls[0].headers.authorization).toContain('AWS4-HMAC-SHA256 Credential=test-access/');
  expect(calls[0].headers['content-type']).toBe('image/webp');
  expect(await store.get('org/image.webp')).toEqual(Buffer.from([1, 2, 3]));
  expect(calls[1].method).toBe('GET');
  await expect(store.get('../secret')).rejects.toMatchObject({ status: 503 });
  expect(calls).toHaveLength(2);
  store.client.config.requestHandler.handle = async () => {
    throw new Error('private provider details');
  };
  await expect(store.get('org/image.webp')).rejects.toMatchObject({
    status: 503,
    message: 'Media storage unavailable',
  });
  await expect(new ObjectStore({}).put('org/image.webp', Buffer.from([1]))).rejects.toMatchObject({
    status: 503,
  });
  store.onModuleDestroy();
});
test('legacy Railway buckets can use explicitly configured path-style requests', async () => {
  const store = new ObjectStore({ ...config, storageForcePathStyle: true });
  let request;
  store.client.config.requestHandler = {
    handle: async (r) => {
      request = r;
      return { response: { statusCode: 200, headers: {}, body: Readable.from([]) } };
    },
  };
  await store.put('org/image.webp', Buffer.from([1]));
  expect(request.hostname).toBe('t3.storageapi.dev');
  expect(request.path).toBe('/private-test/org/image.webp');
  store.onModuleDestroy();
});
test('storage configuration rejects partial credentials, insecure endpoints and legacy keys', () => {
  const base = {
    JWT_ISSUER: 'https://api.example.com',
    JWT_AUDIENCE: 'circle',
    JWT_KEY_ID: 'test',
    JWT_PRIVATE_KEY_PATH: 'private.pem',
    JWT_PUBLIC_KEY_PATH: 'public.pem',
  };
  const storage = {
    STORAGE_URL: config.storageUrl,
    STORAGE_ACCESS_KEY_ID: 'test',
    STORAGE_SECRET_ACCESS_KEY: 'test',
    STORAGE_BUCKET: config.storageBucket,
    STORAGE_REGION: 'auto',
  };
  expect(runtime({ ...base, ...storage }).storageRegion).toBe('auto');
  expect(() => runtime({ ...base, STORAGE_URL: config.storageUrl })).toThrow('Incomplete');
  for (const url of [
    'http://t3.storageapi.dev',
    'https://user:pass@t3.storageapi.dev',
    'https://t3.storageapi.dev/path',
  ])
    expect(() => runtime({ ...base, ...storage, STORAGE_URL: url })).toThrow();
  expect(() => runtime({ ...base, STORAGE_KEY: 'legacy' })).toThrow('Legacy');
  expect(() => runtime({ ...base, ...storage, STORAGE_FORCE_PATH_STYLE: 'yes' })).toThrow();
});
