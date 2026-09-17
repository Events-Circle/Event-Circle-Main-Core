import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { RUNTIME, type Runtime } from '../../config/runtime.js';

/** Private Supabase bucket. No client-supplied URLs or storage keys are accepted. */
@Injectable()
export class ObjectStore {
  constructor(@Inject(RUNTIME) private config: Runtime) {}
  private async request(key: string, method: string, body?: Buffer) {
    const { storageUrl, storageKey, storageBucket } = this.config;
    if (!storageUrl || !storageKey || !storageBucket)
      throw new ServiceUnavailableException('Media storage unavailable');
    const response = await fetch(
      `${storageUrl}/storage/v1/object/${method === 'GET' ? 'authenticated/' : ''}${storageBucket}/${key}`,
      {
        method,
        headers: { Authorization: `Bearer ${storageKey}`, apikey: storageKey, 'Content-Type': 'image/webp' },
        body: body ? new Uint8Array(body) : undefined,
        signal: AbortSignal.timeout(15000),
        redirect: 'error',
      },
    ).catch(() => {
      throw new ServiceUnavailableException();
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new ServiceUnavailableException();
    }
    return response;
  }
  async put(key: string, bytes: Buffer) {
    await (await this.request(key, 'POST', bytes)).body?.cancel();
  }
  async get(key: string) {
    return Buffer.from(await (await this.request(key, 'GET')).arrayBuffer());
  }
}
