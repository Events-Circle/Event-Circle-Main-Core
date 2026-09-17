import { test, expect } from '@jest/globals';
import { ObjectStore } from '../dist/core/media/object-store.js';
test('private storage adapter uses server authorization, fixed paths and fails closed', async () => {
  const original = globalThis.fetch;
  const calls = [];
  const store = new ObjectStore({
    storageUrl: 'https://test.supabase.co',
    storageKey: 'test-only-key',
    storageBucket: 'private-test',
  });
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
  };
  try {
    await store.put('org/image.webp', Buffer.from([1, 2, 3]));
    expect(calls[0].url).toBe('https://test.supabase.co/storage/v1/object/private-test/org/image.webp');
    expect(calls[0].options.headers.Authorization).toBe('Bearer test-only-key');
    expect(await store.get('org/image.webp')).toEqual(Buffer.from([1, 2, 3]));
    expect(calls[1].url).toContain('/object/authenticated/private-test/');
    expect(calls[1].options.redirect).toBe('error');
    globalThis.fetch = async () => new Response('provider details must not leak', { status: 403 });
    await expect(store.get('org/image.webp')).rejects.toMatchObject({ status: 503 });
    await expect(new ObjectStore({}).put('org/image.webp', Buffer.from([1]))).rejects.toMatchObject({
      status: 503,
    });
  } finally {
    globalThis.fetch = original;
  }
});
